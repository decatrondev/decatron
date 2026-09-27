using System.Text.Json;
using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Resultados de Fortnite con pruebas (.dev/torneos/15-fortnite.md F4). Cada
    /// jugador reporta el puesto de su equipo y SUS eliminaciones con captura; el
    /// sistema marca lo sospechoso; el organizador aprueba, corrige o rechaza. Toda
    /// carga o correccion del organizador lleva motivo y justificante, y queda en un
    /// historial que ven los participantes.
    /// </summary>
    public class TournamentFortniteResultsService
    {
        public static readonly string[] ProofModes = { "always", "on_conflict", "staff_only" };

        // Estados de partida en los que un jugador puede reportar.
        private static readonly string[] ReportableGameStatuses = { "playing", "reporting" };

        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly TournamentFortniteFormatService _format;
        private readonly IConfiguration _config;

        public TournamentFortniteResultsService(TournamentFortniteFormatService format, IConfiguration config)
        {
            _format = format;
            _config = config;
        }

        // Carpeta privada, fuera del sitio publico. El backend corre como root, igual
        // que brand-assets.
        public string FilesPath => _config["Tournament:FilesPath"] ?? "/var/www/html/decatron/tournament-files";

        // ─── Archivos ──────────────────────────────────────────────────────────

        /// <summary>
        /// Guarda una imagen ya procesada (JPEG sin metadatos, ver
        /// TournamentImageProcessor en los controllers, que tiene ImageSharp).
        /// </summary>
        public async Task<TournamentFortniteFile> StoreJpegAsync(
            DecatronDbContext db, long editionId, byte[] jpeg, string kind, long userId, CancellationToken ct = default)
        {
            var dir = Path.Combine(FilesPath, editionId.ToString());
            Directory.CreateDirectory(dir);
            var fileName = $"{Guid.NewGuid():N}.jpg";
            await File.WriteAllBytesAsync(Path.Combine(dir, fileName), jpeg, ct);

            var file = new TournamentFortniteFile
            {
                TournamentEditionId = editionId,
                FileName = fileName,
                ContentType = "image/jpeg",
                Kind = kind,
                UploadedByUserId = userId,
            };
            db.TournamentFortniteFiles.Add(file);
            await db.SaveChangesAsync(ct);
            return file;
        }

        public string PathFor(TournamentFortniteFile file) =>
            Path.Combine(FilesPath, file.TournamentEditionId.ToString(), Path.GetFileName(file.FileName));

        // ─── Quien tiene que reportar ──────────────────────────────────────────

        public class ExpectedPlayer
        {
            public long ParticipantId { get; set; }
            public string DisplayName { get; set; } = "";
            public string? GameAccountName { get; set; }
            public long? TeamId { get; set; }
        }

        /// <summary>
        /// Jugadores con check-in en la sesion de la partida. Los equipos que juegan la
        /// partida son los de estos jugadores; un equipo sin nadie con check-in no jugo.
        /// </summary>
        public Task<List<ExpectedPlayer>> GetCheckedInPlayersAsync(DecatronDbContext db, long sessionId, CancellationToken ct = default) =>
            db.TournamentParticipants
                .Where(p => db.TournamentFortniteSessionCheckins.Any(c => c.SessionId == sessionId && c.ParticipantId == p.Id))
                .Select(p => new ExpectedPlayer { ParticipantId = p.Id, DisplayName = p.DisplayName, GameAccountName = p.GameAccountName, TeamId = p.TeamId })
                .ToListAsync(ct);

        public static DateTime? ReportDeadline(TournamentFortniteGame game, TournamentFortniteConfig config) =>
            game.EndedAt?.AddMinutes(config.ReportWindowMinutes);

        // ─── Reporte del jugador ───────────────────────────────────────────────

        /// <summary>null si el jugador puede reportar esta partida; si no, el motivo.</summary>
        public async Task<string?> CanReportAsync(
            DecatronDbContext db, TournamentFortniteConfig config, TournamentFortniteSession session, TournamentFortniteGame game, TournamentParticipant participant, CancellationToken ct = default)
        {
            if (config.ProofMode == "staff_only") return "En este torneo los resultados los carga el organizador";
            if (!ReportableGameStatuses.Contains(game.Status)) return "Esta partida no está abierta para reportar";
            var deadline = ReportDeadline(game, config);
            if (deadline != null && DateTime.UtcNow > deadline) return "Se terminó el tiempo para reportar esta partida";
            if (!await db.TournamentFortniteSessionCheckins.AnyAsync(c => c.SessionId == session.Id && c.ParticipantId == participant.Id, ct))
                return "No hiciste check-in en esta sesión";
            if (participant.TeamId == null) return "El organizador todavía no armó los equipos";
            if (await db.TournamentFortniteResults.AnyAsync(r => r.GameId == game.Id && r.TeamId == participant.TeamId, ct))
                return "El resultado de tu equipo ya fue revisado";
            return null;
        }

        public async Task<string?> SubmitReportAsync(
            DecatronDbContext db, TournamentFortniteConfig config, TournamentFortniteGame game, TournamentParticipant participant,
            int placement, int eliminations, TournamentFortniteFile? screenshot, CancellationToken ct = default)
        {
            if (placement < 1 || placement > 100) return "El puesto tiene que estar entre 1 y 100";
            if (eliminations < 0 || eliminations > 99) return "Las eliminaciones tienen que estar entre 0 y 99";

            var report = await db.TournamentFortniteReports.FirstOrDefaultAsync(r => r.GameId == game.Id && r.ParticipantId == participant.Id, ct);
            var hasScreenshot = screenshot != null || report?.ScreenshotFileId != null;
            if (config.ProofMode == "always" && !hasScreenshot)
                return "Sube la captura de la pantalla final: sin captura no se cuenta el reporte";

            if (report == null)
            {
                report = new TournamentFortniteReport { GameId = game.Id, ParticipantId = participant.Id };
                db.TournamentFortniteReports.Add(report);
            }
            report.TeamId = participant.TeamId;
            report.Placement = (short)placement;
            report.Eliminations = (short)eliminations;
            if (screenshot != null) report.ScreenshotFileId = screenshot.Id;
            report.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return null;
        }

        // ─── Revision del organizador ──────────────────────────────────────────

        public class ReviewMember
        {
            public long ParticipantId { get; set; }
            public string DisplayName { get; set; } = "";
            public string? GameAccountName { get; set; }
            public bool Reported { get; set; }
            public int? Placement { get; set; }
            public int? Eliminations { get; set; }
            public long? ScreenshotFileId { get; set; }
        }

        public class ReviewTeam
        {
            public long TeamId { get; set; }
            public string TeamName { get; set; } = "";
            public List<ReviewMember> Members { get; set; } = new();
            // Puesto en el que coinciden todos los que reportaron; null si no reporto
            // nadie o si no coinciden.
            public int? ReportedPlacement { get; set; }
            public int ReportedEliminations { get; set; }
            public List<string> Flags { get; set; } = new();
            public TournamentFortniteResult? Result { get; set; }
            public int? Points { get; set; }
        }

        public class GameReview
        {
            public List<ReviewTeam> Teams { get; set; } = new();
            public List<string> GameFlags { get; set; } = new();
            public DateTime? Deadline { get; set; }
        }

        /// <summary>
        /// Arma la vista de revision de una partida: por equipo, lo que reporto cada
        /// jugador, el resultado oficial si ya hay, y las alertas.
        /// </summary>
        public async Task<GameReview> BuildReviewAsync(
            DecatronDbContext db, TournamentFortniteConfig config, TournamentFortniteSession session, TournamentFortniteGame game, CancellationToken ct = default)
        {
            var players = await GetCheckedInPlayersAsync(db, session.Id, ct);
            var reports = await db.TournamentFortniteReports.Where(r => r.GameId == game.Id).ToListAsync(ct);
            var results = await db.TournamentFortniteResults.Where(r => r.GameId == game.Id).ToListAsync(ct);

            // Equipos que juegan: los de los jugadores con check-in, mas cualquiera que ya
            // tenga resultado o reporte (por si se quito un check-in despues).
            var teamIds = players.Where(p => p.TeamId != null).Select(p => p.TeamId!.Value)
                .Concat(results.Select(r => r.TeamId))
                .Concat(reports.Where(r => r.TeamId != null).Select(r => r.TeamId!.Value))
                .Distinct().ToList();
            var teamNames = await db.TournamentTeams.Where(t => teamIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Name, ct);
            var members = await db.TournamentParticipants.Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value))
                .Select(p => new { p.Id, p.DisplayName, p.GameAccountName, p.TeamId })
                .ToListAsync(ct);
            var checkedIn = players.Select(p => p.ParticipantId).ToHashSet();

            var ranges = TournamentFortniteFormatService.ParsePlacement(config.PlacementPoints);
            var review = new GameReview { Deadline = ReportDeadline(game, config) };

            foreach (var teamId in teamIds)
            {
                var team = new ReviewTeam { TeamId = teamId, TeamName = teamNames.GetValueOrDefault(teamId, $"Equipo {teamId}") };
                foreach (var m in members.Where(m => m.TeamId == teamId && (checkedIn.Contains(m.Id) || reports.Any(r => r.ParticipantId == m.Id))))
                {
                    var r = reports.FirstOrDefault(x => x.ParticipantId == m.Id);
                    team.Members.Add(new ReviewMember
                    {
                        ParticipantId = m.Id,
                        DisplayName = m.DisplayName,
                        GameAccountName = m.GameAccountName,
                        Reported = r != null,
                        Placement = r?.Placement,
                        Eliminations = r?.Eliminations,
                        ScreenshotFileId = r?.ScreenshotFileId,
                    });
                }

                var teamReports = team.Members.Where(m => m.Reported).ToList();
                var placements = teamReports.Select(m => m.Placement!.Value).Distinct().ToList();
                team.ReportedPlacement = placements.Count == 1 ? placements[0] : null;
                team.ReportedEliminations = teamReports.Sum(m => m.Eliminations ?? 0);
                team.Result = results.FirstOrDefault(r => r.TeamId == teamId);
                if (team.Result != null)
                    team.Points = team.Result.Status == "approved" && team.Result.Placement != null
                        ? TournamentFortniteFormatService.PointsFor(ranges, config.PointsPerElimination, team.Result.Placement.Value, team.Result.Eliminations)
                        : 0;

                if (teamReports.Count == 0) team.Flags.Add("no_report");
                else
                {
                    if (placements.Count > 1) team.Flags.Add("placement_mismatch");
                    if (teamReports.Count < team.Members.Count) team.Flags.Add("missing_member_reports");
                }
                review.Teams.Add(team);
            }

            // Alertas que comparan equipos entre si.
            var expectedTeams = review.Teams.Count;
            var byPlacement = review.Teams.Where(t => t.ReportedPlacement != null).GroupBy(t => t.ReportedPlacement!.Value);
            foreach (var group in byPlacement.Where(g => g.Count() > 1))
                foreach (var t in group) t.Flags.Add("duplicate_placement");
            foreach (var t in review.Teams.Where(t => t.ReportedPlacement > expectedTeams))
                t.Flags.Add("placement_out_of_range");

            // En modo "solo si hay conflicto", un equipo con alertas necesita captura.
            if (config.ProofMode == "on_conflict")
                foreach (var t in review.Teams.Where(t => t.Flags.Any(f => f != "missing_member_reports") && t.Members.Any(m => m.Reported && m.ScreenshotFileId == null)))
                    t.Flags.Add("screenshot_needed");

            var totalElims = review.Teams.Sum(t => t.ReportedEliminations);
            var totalPlayers = players.Count;
            if (totalPlayers > 0 && totalElims > totalPlayers - 1)
                review.GameFlags.Add("too_many_eliminations");

            review.Teams = review.Teams.OrderBy(t => t.ReportedPlacement ?? int.MaxValue).ThenBy(t => t.TeamName).ToList();
            return review;
        }

        // ─── Acciones del organizador ──────────────────────────────────────────

        private static string? Snapshot(TournamentFortniteResult? r) =>
            r == null ? null : JsonSerializer.Serialize(new { placement = r.Placement, eliminations = r.Eliminations, status = r.Status }, Json);

        private static async Task<string> ActorNameAsync(DecatronDbContext db, long userId, CancellationToken ct) =>
            await db.Users.Where(u => u.Id == userId).Select(u => u.DisplayName ?? u.Login).FirstOrDefaultAsync(ct) ?? "Organizador";

        /// <summary>Otro equipo ya tiene aprobado ese puesto en esta partida.</summary>
        private static Task<bool> PlacementTakenAsync(DecatronDbContext db, long gameId, long teamId, int placement, CancellationToken ct) =>
            db.TournamentFortniteResults.AnyAsync(r => r.GameId == gameId && r.TeamId != teamId && r.Status == "approved" && r.Placement == placement, ct);

        /// <summary>
        /// Aprueba lo que reporto el equipo tal cual (puesto en el que coinciden y suma
        /// de eliminaciones). No hace falta justificante: no cambia nada de lo reportado.
        /// </summary>
        public async Task<string?> ApproveAsync(
            DecatronDbContext db, long editionId, TournamentFortniteGame game, ReviewTeam team, long actorUserId, CancellationToken ct = default)
        {
            if (team.Result != null) return "Ese equipo ya tiene resultado";
            if (team.ReportedPlacement == null)
                return team.Flags.Contains("placement_mismatch")
                    ? "Los jugadores reportaron puestos distintos: corrige el resultado con el puesto real"
                    : "Ese equipo no reportó";
            if (await PlacementTakenAsync(db, game.Id, team.TeamId, team.ReportedPlacement.Value, ct))
                return $"Otro equipo ya tiene aprobado el puesto {team.ReportedPlacement}";

            var result = new TournamentFortniteResult
            {
                GameId = game.Id,
                TeamId = team.TeamId,
                Placement = (short)team.ReportedPlacement.Value,
                Eliminations = (short)team.ReportedEliminations,
                Status = "approved",
                Source = "players",
                ReviewedByUserId = actorUserId,
            };
            db.TournamentFortniteResults.Add(result);
            db.TournamentFortniteResultAudits.Add(new TournamentFortniteResultAudit
            {
                TournamentEditionId = editionId,
                GameId = game.Id,
                TeamId = team.TeamId,
                Action = "approve",
                ActorUserId = actorUserId,
                ActorName = await ActorNameAsync(db, actorUserId, ct),
                AfterJson = Snapshot(result),
            });
            await db.SaveChangesAsync(ct);
            return null;
        }

        public class StaffRow
        {
            public long TeamId { get; set; }
            // "approved" | "rejected" | "reopen" (quita el resultado para volver a revisarlo)
            public string Status { get; set; } = "approved";
            public int? Placement { get; set; }
            public int Eliminations { get; set; }
        }

        /// <summary>
        /// El organizador carga, corrige, rechaza o reabre resultados de una partida.
        /// Siempre con motivo; cargar o corregir un resultado (a nombre del equipo)
        /// ademas exige al menos un justificante. Queda todo en el historial.
        /// </summary>
        public async Task<string?> StaffSetAsync(
            DecatronDbContext db, long editionId, TournamentFortniteGame game, List<StaffRow> rows, string? reason,
            List<long> evidenceFileIds, long actorUserId, HashSet<long> validTeamIds, CancellationToken ct = default)
        {
            if (rows.Count == 0) return "No hay cambios";
            if (string.IsNullOrWhiteSpace(reason)) return "Escribe el motivo del cambio";
            if (rows.Any(r => r.Status == "approved") && evidenceFileIds.Count == 0)
                return "Para cargar o corregir un resultado sube al menos un justificante (captura)";
            if (rows.Select(r => r.TeamId).Distinct().Count() != rows.Count) return "Hay equipos repetidos";

            foreach (var row in rows)
            {
                if (!validTeamIds.Contains(row.TeamId)) return "Ese equipo no juega esta partida";
                if (row.Status is not ("approved" or "rejected" or "reopen")) return "Estado no válido";
                if (row.Status == "approved")
                {
                    if (row.Placement is null or < 1 or > 100) return "El puesto tiene que estar entre 1 y 100";
                    if (row.Eliminations is < 0 or > 99) return "Las eliminaciones tienen que estar entre 0 y 99";
                }
            }

            // Puestos repetidos entre las filas nuevas o contra lo ya aprobado.
            var newPlacements = rows.Where(r => r.Status == "approved").Select(r => r.Placement!.Value).ToList();
            if (newPlacements.Count != newPlacements.Distinct().Count()) return "Dos equipos no pueden tener el mismo puesto";
            var changingTeams = rows.Select(r => r.TeamId).ToHashSet();
            var taken = await db.TournamentFortniteResults
                .Where(r => r.GameId == game.Id && r.Status == "approved" && !changingTeams.Contains(r.TeamId))
                .Select(r => r.Placement)
                .ToListAsync(ct);
            var clash = newPlacements.FirstOrDefault(p => taken.Contains((short)p));
            if (clash != 0) return $"Otro equipo ya tiene aprobado el puesto {clash}";

            var actorName = await ActorNameAsync(db, actorUserId, ct);
            var cleanReason = reason.Trim()[..Math.Min(reason.Trim().Length, 1000)];

            foreach (var row in rows)
            {
                var existing = await db.TournamentFortniteResults.FirstOrDefaultAsync(r => r.GameId == game.Id && r.TeamId == row.TeamId, ct);
                var before = Snapshot(existing);
                string action;

                if (row.Status == "reopen")
                {
                    if (existing == null) continue;
                    db.TournamentFortniteResults.Remove(existing);
                    action = "reopen";
                    existing = null;
                }
                else
                {
                    var hadReports = await db.TournamentFortniteReports.AnyAsync(r => r.GameId == game.Id && r.TeamId == row.TeamId, ct);
                    action = row.Status == "rejected" ? "reject" : existing != null || hadReports ? "correct" : "staff_load";
                    if (existing == null)
                    {
                        existing = new TournamentFortniteResult { GameId = game.Id, TeamId = row.TeamId };
                        db.TournamentFortniteResults.Add(existing);
                    }
                    existing.Status = row.Status;
                    existing.Placement = row.Status == "approved" ? (short)row.Placement!.Value : null;
                    existing.Eliminations = row.Status == "approved" ? (short)row.Eliminations : (short)0;
                    existing.Source = "staff";
                    existing.ReviewedByUserId = actorUserId;
                    existing.ReviewedAt = DateTime.UtcNow;
                }

                db.TournamentFortniteResultAudits.Add(new TournamentFortniteResultAudit
                {
                    TournamentEditionId = editionId,
                    GameId = game.Id,
                    TeamId = row.TeamId,
                    Action = action,
                    ActorUserId = actorUserId,
                    ActorName = actorName,
                    BeforeJson = before,
                    AfterJson = Snapshot(existing),
                    Reason = cleanReason,
                    EvidenceFileIds = evidenceFileIds.ToArray(),
                });
            }

            await db.SaveChangesAsync(ct);
            return null;
        }

        /// <summary>
        /// Antes de cerrar una partida: no puede quedar nada sin revisar. Los equipos que
        /// no reportaron reciben 0 si la edicion lo dice (missing_report_zero); si no, el
        /// organizador tiene que resolverlos a mano.
        /// </summary>
        public async Task<string?> PrepareCloseAsync(
            DecatronDbContext db, long editionId, TournamentFortniteConfig config, TournamentFortniteSession session, TournamentFortniteGame game, CancellationToken ct = default)
        {
            var review = await BuildReviewAsync(db, config, session, game, ct);
            var pending = review.Teams.Where(t => t.Result == null).ToList();
            if (pending.Any(t => !t.Flags.Contains("no_report")))
                return "Hay resultados reportados sin revisar: apruébalos, corrígelos o recházalos antes de cerrar";

            if (pending.Count == 0) return null;
            if (!config.MissingReportZero)
                return "Hay equipos sin resultado: cárgalos o recházalos antes de cerrar";

            foreach (var t in pending)
            {
                var result = new TournamentFortniteResult { GameId = game.Id, TeamId = t.TeamId, Status = "no_report", Source = "auto" };
                db.TournamentFortniteResults.Add(result);
                db.TournamentFortniteResultAudits.Add(new TournamentFortniteResultAudit
                {
                    TournamentEditionId = editionId,
                    GameId = game.Id,
                    TeamId = t.TeamId,
                    Action = "no_report",
                    ActorName = "Sistema",
                    AfterJson = Snapshot(result),
                    Reason = "No reportó a tiempo: 0 puntos.",
                });
            }
            await db.SaveChangesAsync(ct);
            return null;
        }
    }
}

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Historial de cambios del organizador (F4), mismo formato para el panel y
    /// para los participantes.
    /// </summary>
    public static class TournamentFortniteAuditQuery
    {
        public static async Task<List<object>> ListAsync(DecatronDbContext db, long editionId, int take = 200, CancellationToken ct = default)
        {
            var rows = await (
                from a in db.TournamentFortniteResultAudits
                where a.TournamentEditionId == editionId
                join g in db.TournamentFortniteGames on a.GameId equals g.Id
                join s in db.TournamentFortniteSessions on g.SessionId equals s.Id
                join t in db.TournamentTeams on a.TeamId equals t.Id
                orderby a.CreatedAt descending
                select new { a, g.GameNumber, SessionName = s.Name, TeamName = t.Name }
            ).Take(take).ToListAsync(ct);

            return rows.Select(r => (object)new
            {
                r.a.Id,
                r.a.CreatedAt,
                r.a.Action,
                r.a.ActorName,
                r.SessionName,
                r.GameNumber,
                r.TeamName,
                before = Parse(r.a.BeforeJson),
                after = Parse(r.a.AfterJson),
                r.a.Reason,
                r.a.EvidenceFileIds,
            }).ToList();
        }

        private static System.Text.Json.JsonElement? Parse(string? json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            try { return System.Text.Json.JsonDocument.Parse(json).RootElement.Clone(); }
            catch { return null; }
        }
    }
}
