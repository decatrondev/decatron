using Decatron.Core.Interfaces;
using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Dia de partida de Fortnite (.dev/torneos/15-fortnite.md F3): check-in por
    /// sesion, codigo de la partida personalizada que solo ven los jugadores con
    /// check-in, estados de cada partida y avisos (chat del canal sin el codigo, DM
    /// de Discord con el codigo).
    /// </summary>
    public class TournamentFortniteMatchdayService
    {
        public static readonly string[] SessionStatuses = { "scheduled", "check_in", "in_progress", "finished" };
        public static readonly string[] GameStatuses = { "waiting", "revealed", "playing", "reporting", "closed" };

        // Estados en los que el jugador con check-in ve el codigo.
        public static readonly string[] CodeVisibleStatuses = { "revealed", "playing" };

        private readonly TournamentFortniteFormatService _format;
        private readonly IMessageSender _messageSender;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<TournamentFortniteMatchdayService> _logger;

        public TournamentFortniteMatchdayService(
            TournamentFortniteFormatService format,
            IMessageSender messageSender,
            IServiceScopeFactory scopeFactory,
            ILogger<TournamentFortniteMatchdayService> logger)
        {
            _format = format;
            _messageSender = messageSender;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        // ─── Quien juega cada sesion ───────────────────────────────────────────

        /// <summary>
        /// Jugadores que pueden hacer check-in en la sesion: aprobados, y si la sesion
        /// es de un grupo, solo los de los equipos de ese grupo. En una sesion de un
        /// solo lobby no hace falta tener equipo todavia.
        /// </summary>
        public async Task<List<TournamentParticipant>> GetEligibleParticipantsAsync(DecatronDbContext db, TournamentFortniteSession session, CancellationToken ct = default)
        {
            var query = db.TournamentParticipants.Where(p => p.TournamentEditionId == session.TournamentEditionId && p.Status == "approved");
            if (session.GroupId != null)
            {
                var teamIds = db.TournamentFortniteGroupTeams.Where(gt => gt.GroupId == session.GroupId).Select(gt => gt.TeamId);
                query = query.Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value));
            }
            return await query.OrderBy(p => p.TeamId).ThenBy(p => p.DisplayName).ToListAsync(ct);
        }

        public async Task<bool> IsEligibleAsync(DecatronDbContext db, TournamentFortniteSession session, TournamentParticipant participant, CancellationToken ct = default)
        {
            if (participant.Status != "approved" || participant.TournamentEditionId != session.TournamentEditionId) return false;
            if (session.GroupId == null) return true;
            return participant.TeamId != null &&
                   await db.TournamentFortniteGroupTeams.AnyAsync(gt => gt.GroupId == session.GroupId && gt.TeamId == participant.TeamId, ct);
        }

        // ─── Sesion ────────────────────────────────────────────────────────────

        public string? ValidateSessionTransition(string from, string to)
        {
            if (!SessionStatuses.Contains(to)) return "Estado no válido";
            var allowed = from switch
            {
                "scheduled" => new[] { "check_in" },
                "check_in" => new[] { "scheduled", "in_progress" },
                "in_progress" => new[] { "check_in", "finished" },
                "finished" => new[] { "in_progress" },
                _ => Array.Empty<string>(),
            };
            return allowed.Contains(to) ? null : "No se puede pasar a ese estado desde el actual";
        }

        // ─── Check-in ──────────────────────────────────────────────────────────

        public async Task<string?> SelfCheckInAsync(DecatronDbContext db, TournamentFortniteSession session, TournamentParticipant participant, CancellationToken ct = default)
        {
            if (session.Status != "check_in")
                return "El check-in de esta sesión no está abierto";
            if (!await IsEligibleAsync(db, session, participant, ct))
                return "No juegas en esta sesión";
            await SetCheckInAsync(db, session.Id, participant.Id, true, "self", ct);
            return null;
        }

        public async Task SetCheckInAsync(DecatronDbContext db, long sessionId, long participantId, bool checkedIn, string by, CancellationToken ct = default)
        {
            var row = await db.TournamentFortniteSessionCheckins.FirstOrDefaultAsync(c => c.SessionId == sessionId && c.ParticipantId == participantId, ct);
            if (checkedIn && row == null)
                db.TournamentFortniteSessionCheckins.Add(new TournamentFortniteSessionCheckin { SessionId = sessionId, ParticipantId = participantId, CheckedInBy = by });
            else if (!checkedIn && row != null)
                db.TournamentFortniteSessionCheckins.Remove(row);
            await db.SaveChangesAsync(ct);
        }

        // ─── Partidas ──────────────────────────────────────────────────────────

        public string? ValidateGameTransition(TournamentFortniteGame game, string to)
        {
            if (!GameStatuses.Contains(to)) return "Estado no válido";
            if (to != "waiting" && string.IsNullOrWhiteSpace(game.CustomCode))
                return "Primero pon el código de la partida personalizada";
            return null;
        }

        public void ApplyGameStatus(TournamentFortniteGame game, string to)
        {
            game.Status = to;
            var now = DateTime.UtcNow;
            if (to == "revealed") game.RevealedAt ??= now;
            if (to == "playing") game.StartedAt ??= now;
            if (to is "reporting" or "closed") game.EndedAt ??= now;
            if (to == "waiting") { game.RevealedAt = null; game.StartedAt = null; game.EndedAt = null; }
        }

        public class RevealResult
        {
            public bool ChatAnnounced { get; set; }
            public int DiscordDmsQueued { get; set; }
        }

        /// <summary>
        /// Revela el codigo de una partida: la sesion pasa a "en juego" si estaba en
        /// check-in, la partida a "codigo revelado", y opcionalmente avisa en el chat
        /// (sin el codigo) y manda el codigo por DM de Discord a los jugadores con
        /// check-in. Los DMs salen en segundo plano para no trabar la respuesta.
        /// </summary>
        public async Task<RevealResult> RevealAsync(
            DecatronDbContext db, TournamentEdition edition, TournamentFortniteSession session, TournamentFortniteGame game,
            bool announceInChat, bool sendDiscordDm, CancellationToken ct = default)
        {
            if (session.Status is "scheduled" or "check_in") session.Status = "in_progress";
            ApplyGameStatus(game, "revealed");
            await db.SaveChangesAsync(ct);

            var result = new RevealResult();

            if (announceInChat)
            {
                var channel = await GetChatChannelAsync(db, edition.ChannelOwnerId, ct);
                if (channel != null)
                {
                    try
                    {
                        await _messageSender.SendMessageAsync(channel,
                            $"{edition.Name}: la partida {game.GameNumber} de {session.Name} está lista. Los que hicieron check-in tienen el código en su panel del torneo" +
                            (sendDiscordDm ? " y por DM de Discord." : "."));
                        result.ChatAnnounced = true;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Torneo Fortnite: no se pudo avisar en el chat de {Channel}", channel);
                    }
                }
            }

            if (sendDiscordDm)
            {
                var discordIds = await GetCheckedInDiscordIdsAsync(db, session.Id, ct);
                result.DiscordDmsQueued = discordIds.Count;
                var message = $"**{edition.Name}** — {session.Name}, partida {game.GameNumber}\n" +
                              $"Código de la partida personalizada: `{game.CustomCode}`\n" +
                              "No lo compartas: es solo para los jugadores del torneo.";
                _ = Task.Run(async () =>
                {
                    using var scope = _scopeFactory.CreateScope();
                    var dm = scope.ServiceProvider.GetRequiredService<IDiscordDmSender>();
                    foreach (var id in discordIds)
                    {
                        try { await dm.SendDmAsync(id, message); }
                        catch (Exception ex) { _logger.LogWarning(ex, "Torneo Fortnite: fallo el DM a {DiscordId}", id); }
                    }
                });
            }

            return result;
        }

        /// <summary>Login de Twitch del canal, o el id de Kick si el canal es solo de Kick (igual que MessageSenderRouter).</summary>
        private static async Task<string?> GetChatChannelAsync(DecatronDbContext db, long channelOwnerId, CancellationToken ct)
        {
            var owner = await db.Users.Where(u => u.Id == channelOwnerId)
                .Select(u => new { u.Login, u.TwitchId, u.KickId })
                .FirstOrDefaultAsync(ct);
            if (owner == null) return null;
            if (string.IsNullOrEmpty(owner.TwitchId) && !string.IsNullOrEmpty(owner.KickId)) return owner.KickId;
            return owner.Login;
        }

        /// <summary>
        /// Discord de cada jugador con check-in: el que dejo al inscribirse por el bot
        /// de Discord, o el de su cuenta del bot (misma persona, cualquier plataforma).
        /// </summary>
        private static async Task<List<string>> GetCheckedInDiscordIdsAsync(DecatronDbContext db, long sessionId, CancellationToken ct)
        {
            var participants = await db.TournamentParticipants
                .Where(p => db.TournamentFortniteSessionCheckins.Any(c => c.SessionId == sessionId && c.ParticipantId == p.Id))
                .Select(p => new { p.AccountId, p.DiscordUserId })
                .ToListAsync(ct);

            var ids = participants.Where(p => !string.IsNullOrEmpty(p.DiscordUserId)).Select(p => p.DiscordUserId!).ToList();
            var accountIds = participants.Where(p => string.IsNullOrEmpty(p.DiscordUserId) && p.AccountId != null).Select(p => p.AccountId!.Value).ToList();
            if (accountIds.Count > 0)
            {
                var fromUsers = await db.Users
                    .Where(u => u.DiscordId != null && (accountIds.Contains(u.Id) || (u.AccountId != null && accountIds.Contains(u.AccountId.Value))))
                    .Select(u => u.DiscordId!)
                    .ToListAsync(ct);
                ids.AddRange(fromUsers);
            }
            return ids.Distinct().ToList();
        }
    }
}
