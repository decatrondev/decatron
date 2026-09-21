using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Decatron.Services.GameData.Riot;

namespace Decatron.Services.Tournament
{
    public class RegisterParticipantRequest
    {
        public string DisplayName { get; set; } = "";
        public string? RiotId { get; set; }
        public string? RiotTagLine { get; set; }
        public string? PrimaryRole { get; set; }
        public string? Nationality { get; set; }
        public string? TwitchChannel { get; set; }
        public string? KickChannel { get; set; }
        public string? TwitterHandle { get; set; }
        public long? AccountId { get; set; }
        public string? DiscordUserId { get; set; }

        /// <summary>
        /// PUUID ya resuelto de antemano (cuenta de Riot vinculada y verificada en
        /// Settings, ver RiotAccountController) — si viene seteado, se salta el
        /// llamado en vivo a la Riot API mas abajo (ya se resolvio y verifico antes).
        /// </summary>
        public string? RiotPuuid { get; set; }
        public long? LinkedRiotAccountId { get; set; }
    }

    public class RegisterParticipantResult
    {
        public bool Success { get; set; }
        public string? Error { get; set; }
        public TournamentParticipant? Participant { get; set; }
    }

    /// <summary>
    /// Alta de inscripcion compartida — el diseno final (fase 5) la invoca tanto
    /// desde el form publico de la web como desde un comando del bot de Discord
    /// (fase 8), por eso vive como servicio, no logica de controller. Siempre crea
    /// en "pending_approval": la aprobacion es un paso de staff aparte
    /// (TournamentRegistrationAdminController), nunca automatica.
    /// </summary>
    public class TournamentRegistrationService
    {
        private readonly RiotApiClient _riotClient;

        public TournamentRegistrationService(RiotApiClient riotClient)
        {
            _riotClient = riotClient;
        }

        public async Task<RegisterParticipantResult> RegisterAsync(
            DecatronDbContext db, TournamentEdition edition, RegisterParticipantRequest request, string source, CancellationToken ct = default)
        {
            if (edition.Status != "registration_open")
                return new RegisterParticipantResult { Success = false, Error = "Las inscripciones no están abiertas para este torneo" };

            if (string.IsNullOrWhiteSpace(request.DisplayName))
                return new RegisterParticipantResult { Success = false, Error = "El nombre es requerido" };

            // Evita que la misma persona (ya sea por cuenta de Decatron o por Discord)
            // se anote dos veces a la misma edicion.
            if (request.AccountId.HasValue)
            {
                var alreadyByAccount = await db.TournamentParticipants.AnyAsync(p =>
                    p.TournamentEditionId == edition.Id && p.AccountId == request.AccountId.Value, ct);
                if (alreadyByAccount)
                    return new RegisterParticipantResult { Success = false, Error = "Ya estás inscripto en este torneo" };
            }
            if (!string.IsNullOrEmpty(request.DiscordUserId))
            {
                var alreadyByDiscord = await db.TournamentParticipants.AnyAsync(p =>
                    p.TournamentEditionId == edition.Id && p.DiscordUserId == request.DiscordUserId, ct);
                if (alreadyByDiscord)
                    return new RegisterParticipantResult { Success = false, Error = "Ya estás inscripto en este torneo" };
            }

            string? resolvedPuuid = request.RiotPuuid;
            if (resolvedPuuid != null)
            {
                var alreadyByPuuid = await db.TournamentParticipants.AnyAsync(p =>
                    p.TournamentEditionId == edition.Id && p.RiotPuuid == resolvedPuuid, ct);
                if (alreadyByPuuid)
                    return new RegisterParticipantResult { Success = false, Error = "Esa cuenta de Riot ya está inscripta en este torneo" };
            }
            else if (!string.IsNullOrWhiteSpace(request.RiotId) && !string.IsNullOrWhiteSpace(request.RiotTagLine))
            {
                var riotConfig = await db.TournamentRiotConfigs.FirstOrDefaultAsync(c => c.ChannelOwnerId == edition.ChannelOwnerId && c.IsActive, ct);
                if (riotConfig != null)
                {
                    var (ok, puuid, error) = await _riotClient.ResolvePuuidAsync(
                        edition.Region, request.RiotId.Trim(), request.RiotTagLine.Trim(), riotConfig.ApiKey);

                    if (!ok || string.IsNullOrEmpty(puuid))
                        return new RegisterParticipantResult
                        {
                            Success = false,
                            Error = $"No se encontró la cuenta de Riot '{request.RiotId}#{request.RiotTagLine}' en la región {edition.Region}. Verificá el nombre y el tag exactos.",
                        };

                    resolvedPuuid = puuid;

                    var alreadyByPuuid = await db.TournamentParticipants.AnyAsync(p =>
                        p.TournamentEditionId == edition.Id && p.RiotPuuid == resolvedPuuid, ct);
                    if (alreadyByPuuid)
                        return new RegisterParticipantResult { Success = false, Error = "Esa cuenta de Riot ya está inscripta en este torneo" };
                }
            }

            var participant = new TournamentParticipant
            {
                TournamentEditionId = edition.Id,
                DisplayName = request.DisplayName.Trim(),
                RiotId = request.RiotId,
                RiotTagLine = request.RiotTagLine,
                RiotPuuid = resolvedPuuid,
                PrimaryRole = request.PrimaryRole,
                Nationality = request.Nationality,
                TwitchChannel = request.TwitchChannel,
                KickChannel = request.KickChannel,
                TwitterHandle = request.TwitterHandle,
                AccountId = request.AccountId,
                DiscordUserId = request.DiscordUserId,
                LinkedRiotAccountId = request.LinkedRiotAccountId,
                Status = "pending_approval",
                RegisteredVia = source,
            };

            db.TournamentParticipants.Add(participant);
            await db.SaveChangesAsync(ct);

            return new RegisterParticipantResult { Success = true, Participant = participant };
        }
    }
}
