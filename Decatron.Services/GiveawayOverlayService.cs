using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services.Accounts;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Estado del giveaway para el overlay de OBS (Giveaways F3b, .dev/plans/giveaways/PLAN.md).
    /// El servidor decide todo: la fase, el ganador y los tiempos. El navegador solo dibuja. El estado se calcula desde la
    /// base (no vive en memoria), así que un refresco de OBS o un reinicio no pierde el sorteo: al conectar, el overlay
    /// pide la foto completa; después llegan eventos. Todo se emite a UN solo grupo, overlay_{OverlayKey}
    /// (ver .dev/plans/MULTIPLATAFORMA_PATRON.md).
    /// </summary>
    public class GiveawayOverlayService
    {
        public const string StateEvent = "GiveawayState";
        private const int RecentEntries = 10;
        private const int MaxCandidates = 40;

        private static readonly ConcurrentDictionary<string, string> _lastPublished = new();

        private readonly DecatronDbContext _context;
        private readonly AccountChannelResolver _accounts;
        private readonly IHubContext<OverlayHub> _hub;
        private readonly ILogger<GiveawayOverlayService> _logger;

        public GiveawayOverlayService(DecatronDbContext context, AccountChannelResolver accounts,
            IHubContext<OverlayHub> hub, ILogger<GiveawayOverlayService> logger)
        {
            _context = context;
            _accounts = accounts;
            _hub = hub;
            _logger = logger;
        }

        public record EntryView(string DisplayName, string Platform, DateTime EnteredAt);
        public record WinnerView(int Position, string DisplayName, string Platform, string State, DateTime? Deadline, bool WasBackup);

        public record Snapshot(
            string Phase,
            int? SessionId,
            string? Prize,
            string? Command,
            bool AllowAutoEntry,
            bool Twitch,
            bool Kick,
            int ParticipantCount,
            DateTime? EndsAt,
            DateTime? DrawnAt,
            int RevealSeconds,
            int ResultSeconds,
            int ResponseTimeoutSeconds,
            IReadOnlyList<EntryView> Recent,
            IReadOnlyList<string> Candidates,
            IReadOnlyList<WinnerView> Winners,
            DateTime ServerNow);

        /// <summary>A qué clave de overlay pertenece este canal de Twitch (el login de la fila principal de la cuenta).</summary>
        public async Task<string?> OverlayKeyAsync(string channelId)
        {
            var row = await _context.Users.AsNoTracking().Where(u => u.TwitchId == channelId)
                .Select(u => new { u.Id, u.Login }).FirstOrDefaultAsync();
            if (row == null) return null;
            var account = await _accounts.ResolveByUserIdAsync(row.Id);
            return account?.OverlayKey ?? row.Login;
        }

        /// <summary>Resuelve el alias del enlace del overlay a la cuenta y su giveaway (público: lo pregunta OBS).</summary>
        public async Task<(string OverlayKey, string Variant, string? TwitchId)?> ResolveAsync(string alias)
        {
            var resolved = await _accounts.ResolveAliasAsync(alias);
            if (resolved == null) return null;
            return (resolved.Account.OverlayKey, resolved.LegacyVariant, resolved.Account.TwitchId);
        }

        public async Task<Snapshot> BuildSnapshotAsync(string channelId)
        {
            var now = DateTime.UtcNow;
            var session = await _context.GiveawaySessions.AsNoTracking()
                .Where(s => s.ChannelId == channelId)
                .OrderByDescending(s => s.UpdatedAt)
                .FirstOrDefaultAsync();

            if (session == null) return Idle(now);

            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot) ?? new GiveawayConfig();
            var gs = GiveawaySettings.Parse(config.Settings);
            var reveal = Math.Max(0, gs.Overlay.RevealSeconds);
            var resultSeconds = Math.Max(0, gs.Overlay.ResultSeconds);

            var recent = await _context.GiveawayParticipants.AsNoTracking()
                .Where(p => p.SessionId == session.Id)
                .OrderByDescending(p => p.EnteredAt)
                .Take(RecentEntries)
                .Select(p => new EntryView(p.DisplayName, p.Platform, p.EnteredAt))
                .ToListAsync();

            var common = new Snapshot("idle", session.Id, session.PrizeName, NormalizeCommand(config.EntryCommand), config.AllowAutoEntry,
                gs.Platforms.Twitch, gs.Platforms.Kick, session.TotalParticipants, session.EndsAt, session.EndedAt, reveal, resultSeconds,
                config.WinnerResponseTimeout, recent, Array.Empty<string>(), Array.Empty<WinnerView>(), now);

            switch (session.Status)
            {
                case "active":
                    return common with { Phase = "open" };

                case "selecting_winners":
                case "completed":
                {
                    var winners = await LoadWinnersAsync(session.Id, config.WinnerResponseTimeout);
                    var endedAt = session.EndedAt ?? now;
                    var revealEnds = endedAt.AddSeconds(reveal);

                    if (now < revealEnds)
                    {
                        // La ruleta de nombres recorre candidatos reales y termina en el ganador que el servidor ya eligió
                        var candidates = await _context.GiveawayParticipants.AsNoTracking()
                            .Where(p => p.SessionId == session.Id)
                            .Select(p => p.DisplayName).Take(2000).ToListAsync();
                        return common with { Phase = "drawing", Winners = winners, Candidates = Shuffle(candidates).Take(MaxCandidates).ToList() };
                    }

                    var pending = winners.Any(w => w.State == "pending");
                    if (session.Status == "selecting_winners" || pending)
                        return common with { Phase = pending ? "winner" : "result", Winners = winners };

                    // completed: el resultado se queda ResultSeconds desde que terminó el último plazo
                    var closeAt = session.UpdatedAt.AddSeconds(resultSeconds);
                    return now < closeAt
                        ? common with { Phase = "result", Winners = winners }
                        : common with { Phase = "idle", Winners = Array.Empty<WinnerView>() };
                }

                case "cancelled":
                {
                    var closeAt = (session.EndedAt ?? session.UpdatedAt).AddSeconds(resultSeconds);
                    return now < closeAt ? common with { Phase = "cancelled" } : Idle(now);
                }

                default:
                    return Idle(now);
            }
        }

        /// <summary>Emite la foto del estado al overlay SOLO si cambió desde la última emisión.</summary>
        public async Task PublishIfChangedAsync(string channelId, bool force = false)
        {
            try
            {
                var key = await OverlayKeyAsync(channelId);
                if (key == null) return;

                var snapshot = await BuildSnapshotAsync(channelId);
                // Sin sesión visible no se publica nada: el servicio de fondo corre una vez por tenant y cada uno solo ve sus
                // filas; publicar «idle» por un canal ajeno apagaría el overlay de otro streamer
                if (snapshot.SessionId == null) return;
                var fingerprint = JsonSerializer.Serialize(snapshot with { ServerNow = default });
                if (!force && _lastPublished.TryGetValue(channelId, out var last) && last == fingerprint) return;
                _lastPublished[channelId] = fingerprint;

                await _hub.Clients.Group($"overlay_{key}").SendAsync(StateEvent, snapshot);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo publicar el estado del giveaway de {ChannelId} al overlay", channelId);
            }
        }

        /// <summary>
        /// Pasada del servicio de fondo: revisa los giveaways activos o terminados hace poco de ESTE tenant y emite el estado
        /// si cambió (cubre las transiciones por tiempo: fin del revelado, plazos y ocultar el resultado).
        /// </summary>
        public async Task PublishRecentAsync()
        {
            var since = DateTime.UtcNow.AddMinutes(-10);
            var channels = await _context.GiveawaySessions.AsNoTracking()
                .Where(s => s.Status == "active" || s.Status == "selecting_winners" || s.UpdatedAt >= since)
                .Select(s => s.ChannelId).Distinct().ToListAsync();
            foreach (var channelId in channels)
                await PublishIfChangedAsync(channelId);
        }

        private async Task<IReadOnlyList<WinnerView>> LoadWinnersAsync(int sessionId, int timeoutSeconds)
        {
            var rows = await (from w in _context.GiveawayWinners.AsNoTracking()
                              join p in _context.GiveawayParticipants.AsNoTracking() on w.ParticipantId equals p.Id
                              where w.SessionId == sessionId && !w.WasDisqualified
                              select new { w, p.DisplayName, p.Platform }).ToListAsync();

            // Por posición manda la fila vigente: un respaldo promovido reemplaza al titular que no respondió
            return rows.Where(r => !r.w.IsBackup)
                .GroupBy(r => r.w.Position)
                .Select(g => g.OrderByDescending(r => r.w.SelectedAt).First())
                .OrderBy(r => r.w.Position)
                .Select(r =>
                {
                    var state = r.w.HasResponded ? "responded" : r.w.TimeoutProcessed ? "timeout" : "pending";
                    return new WinnerView(r.w.Position, r.DisplayName, r.Platform, state,
                        state == "pending" ? r.w.SelectedAt.AddSeconds(timeoutSeconds) : null, r.w.PromotedAt != null);
                })
                .ToList();
        }

        private static Snapshot Idle(DateTime now) =>
            new("idle", null, null, null, false, true, false, 0, null, null, 0, 0, 0,
                Array.Empty<EntryView>(), Array.Empty<string>(), Array.Empty<WinnerView>(), now);

        private static string NormalizeCommand(string? command)
        {
            var cmd = (command ?? "!join").Trim().ToLowerInvariant();
            if (cmd.Length == 0) cmd = "!join";
            return cmd.StartsWith('!') ? cmd : "!" + cmd;
        }

        private static List<string> Shuffle(List<string> items)
        {
            for (var i = items.Count - 1; i > 0; i--)
            {
                var j = RandomNumberGenerator.GetInt32(i + 1);
                (items[i], items[j]) = (items[j], items[i]);
            }
            return items;
        }
    }
}
