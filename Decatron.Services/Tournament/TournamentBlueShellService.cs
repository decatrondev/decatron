using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Decatron.Services.Tournament
{
    public class ThrowShellResult
    {
        public bool Success { get; set; }
        public string? Error { get; set; }
        public bool WasReverse { get; set; }
    }

    /// <summary>
    /// Accion de "lanzar una ficha de castigo" (nombre generico interno — cada
    /// tenant le pone su propio nombre via TournamentEdition.ShellItemName, ver
    /// Add_Tournament_Custom_Mechanic_Names.sql), con las validaciones de
    /// .dev/torneos/04-motor-blue-shell-aegis.md seccion 5. Vive como servicio
    /// compartido (no logica de controller) porque el diseno final la invoca tanto
    /// desde la web como desde un comando del bot de Discord (fase 8, todavia no
    /// implementada) — hoy el unico caller es el panel de admin (TournamentAdminController),
    /// a falta de login de participante real (fase 5).
    ///
    /// NO implementado en Milestone 1: el chequeo de "el objetivo esta en partida /
    /// en cola / en los minutos post-partida" (paso 4 del diseno) — depende de Live
    /// Games / spectator-v5 (fase 3 seccion 6), que todavia no existe. Se documenta la
    /// omision en vez de fingir que se valida.
    /// </summary>
    public class TournamentBlueShellService
    {
        private readonly TournamentStandingsService _standings;
        private static readonly Random _random = new();

        public TournamentBlueShellService(TournamentStandingsService standings)
        {
            _standings = standings;
        }

        public async Task<ThrowShellResult> ThrowShellAsync(
            DecatronDbContext db, TournamentEdition edition, long sourceParticipantId, long targetParticipantId, long punishmentTypeId, CancellationToken ct = default)
        {
            var itemName = string.IsNullOrWhiteSpace(edition.ShellItemName) ? "ficha" : edition.ShellItemName;

            if (sourceParticipantId == targetParticipantId)
                return new ThrowShellResult { Success = false, Error = $"No te podes tirar una {itemName} a vos mismo" };

            // Auditoria de aislamiento cross-tenant (Milestone 3, 15-08-2026): sin esto,
            // cualquiera con acceso a este endpoint podia pasar el ID de un participante
            // de OTRA edicion (de otro canal incluso) como target/source y manipular su
            // inventario / generarle eventos — el resto del metodo nunca validaba que
            // ambos IDs pertenecieran a esta misma edicion.
            var participantsInEdition = await db.TournamentParticipants
                .Where(p => (p.Id == sourceParticipantId || p.Id == targetParticipantId) && p.TournamentEditionId == edition.Id)
                .Select(p => p.Id)
                .ToListAsync(ct);

            if (!participantsInEdition.Contains(sourceParticipantId) || !participantsInEdition.Contains(targetParticipantId))
                return new ThrowShellResult { Success = false, Error = "Uno de los participantes no pertenece a esta edicion" };

            var inventory = await db.TournamentShellInventories
                .FirstOrDefaultAsync(i => i.TournamentParticipantId == sourceParticipantId, ct);
            if (inventory == null || inventory.Count <= 0)
                return new ThrowShellResult { Success = false, Error = $"No tenes {itemName}s en el inventario" };

            var rules = await db.TournamentBlueShellRules.FirstOrDefaultAsync(r => r.TournamentEditionId == edition.Id, ct);
            if (rules == null)
                return new ThrowShellResult { Success = false, Error = "Esta edicion todavia no tiene reglas de castigos configuradas" };

            if (edition.EndsAt.HasValue && DateTime.UtcNow >= edition.EndsAt.Value.AddHours(-rules.DisableLastNHours))
                return new ThrowShellResult { Success = false, Error = $"Sistema de {itemName}s desactivado en las ultimas {rules.DisableLastNHours}h del torneo" };

            var punishment = await db.TournamentPunishmentTypes.FirstOrDefaultAsync(p => p.Id == punishmentTypeId && p.TournamentEditionId == edition.Id, ct);
            if (punishment == null)
                return new ThrowShellResult { Success = false, Error = "Tipo de castigo invalido" };

            var targetRank = await _standings.GetRankAsync(db, edition.Id, targetParticipantId, ct);
            if (targetRank.HasValue)
            {
                var cooldownHours = FindRankValue(rules.CooldownByRank, targetRank.Value, r => r.CooldownHours) ?? 12;
                var lastReceived = await db.TournamentShellEvents
                    .Where(e => e.TargetParticipantId == targetParticipantId && e.Type == "received")
                    .OrderByDescending(e => e.CreatedAt)
                    .Select(e => (DateTime?)e.CreatedAt)
                    .FirstOrDefaultAsync(ct);

                if (lastReceived.HasValue && DateTime.UtcNow < lastReceived.Value.AddHours(cooldownHours))
                    return new ThrowShellResult { Success = false, Error = $"El objetivo esta en cooldown de recepcion ({cooldownHours}h por su puesto #{targetRank})" };
            }

            var sourceRank = await _standings.GetRankAsync(db, edition.Id, sourceParticipantId, ct);
            var reverseChance = sourceRank.HasValue
                ? FindRankValue(rules.ReverseChanceByRank, sourceRank.Value, r => r.ReverseChancePercent.HasValue ? (int?)r.ReverseChancePercent.Value : null) ?? 15
                : 15;

            var wasReverse = punishment.AllowsReverse && _random.Next(1, 101) <= reverseChance;
            var finalTargetId = wasReverse ? sourceParticipantId : targetParticipantId;

            inventory.Count--;
            inventory.TotalThrown++;
            inventory.UpdatedAt = DateTime.UtcNow;

            db.TournamentShellEvents.Add(new TournamentShellEvent
            {
                TournamentEditionId = edition.Id,
                Type = "thrown",
                SourceParticipantId = sourceParticipantId,
                TargetParticipantId = finalTargetId,
                PunishmentTypeId = punishmentTypeId,
                WasReverse = wasReverse,
            });

            var targetInventory = await db.TournamentShellInventories.FirstOrDefaultAsync(i => i.TournamentParticipantId == finalTargetId, ct);
            if (targetInventory == null)
            {
                // El objetivo nunca habia obtenido una ficha propia todavia — sin esto,
                // su contador de "recibidas" se perdia en silencio (no aparecia en la
                // tabla de inventarios hasta que le tocara una a el).
                targetInventory = new TournamentShellInventory { TournamentParticipantId = finalTargetId };
                db.TournamentShellInventories.Add(targetInventory);
            }
            targetInventory.TotalReceived++;
            targetInventory.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);

            return new ThrowShellResult { Success = true, WasReverse = wasReverse };
        }

        public async Task<bool> FulfillEventAsync(DecatronDbContext db, long eventId, long staffUserId, CancellationToken ct = default)
        {
            var ev = await db.TournamentShellEvents.FirstOrDefaultAsync(e => e.Id == eventId, ct);
            if (ev == null || ev.FulfilledAt != null) return false;

            ev.FulfilledAt = DateTime.UtcNow;
            ev.FulfilledByStaffId = staffUserId;
            await db.SaveChangesAsync(ct);
            return true;
        }

        private static int? FindRankValue(string rangesJson, int rank, Func<RankRange, int?> selector)
        {
            List<RankRange>? ranges;
            try { ranges = JsonSerializer.Deserialize<List<RankRange>>(rangesJson); }
            catch { return null; }

            var match = ranges?.FirstOrDefault(r => rank >= r.MinRank && rank <= r.MaxRank);
            return match != null ? selector(match) : null;
        }
    }
}
