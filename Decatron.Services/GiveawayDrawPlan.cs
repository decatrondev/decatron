using Decatron.Core.Models;
using System.Collections.Generic;
using System.Linq;

namespace Decatron.Services
{
    /// <summary>Un ganador (o respaldo) de un sorteo, reducido a lo que importa para decidir quién puede volver a salir sorteado.</summary>
    public record DrawWinnerRow(int Position, int ParticipantId, bool IsBackup, bool HasResponded, bool TimeoutProcessed, bool WasDisqualified);

    /// <summary>
    /// Las reglas de validación del sorteo, sin base de datos para poder probarlas una por una. Cada persona está en un estado:
    /// pendiente (tiene plazo para responder), confirmada (respondió), fallida (venció su plazo o fue descalificada) o reservada
    /// (ganador de respaldo). Lo que cada estado impide lo decide el streamer con GiveawayDrawRules.
    /// </summary>
    public static class GiveawayDrawPlan
    {
        /// <summary>Participantes que NO pueden salir sorteados ahora.</summary>
        public static HashSet<int> Excluded(IEnumerable<DrawWinnerRow> rows, GiveawayDrawRules rules)
        {
            var excluded = new HashSet<int>();
            foreach (var r in rows)
            {
                if (r.WasDisqualified && r.HasResponded) excluded.Add(r.ParticipantId);   // anulada por el streamer: no vuelve
                else if (r.WasDisqualified || (!r.HasResponded && r.TimeoutProcessed))
                {
                    if (rules.DiscardNoResponse) excluded.Add(r.ParticipantId);   // fallida
                }
                else if (r.HasResponded)
                {
                    if (!rules.ConfirmedCanWinAgain) excluded.Add(r.ParticipantId); // confirmada
                }
                else excluded.Add(r.ParticipantId);                                 // pendiente o reservada: siempre fuera
            }
            return excluded;
        }

        /// <summary>Lugares (1..N) que todavía no tienen ningún ganador, ni siquiera uno que haya fallado.</summary>
        public static List<int> FreePositions(IEnumerable<DrawWinnerRow> rows, int numberOfWinners)
        {
            var taken = rows.Where(r => !r.IsBackup).Select(r => r.Position).ToHashSet();
            return Enumerable.Range(1, System.Math.Max(1, numberOfWinners)).Where(p => !taken.Contains(p)).ToList();
        }

        /// <summary>Lugares que elige este sorteo: todos los libres, o solo el primero en modo «uno por uno».</summary>
        public static List<int> PositionsToDraw(IEnumerable<DrawWinnerRow> rows, int numberOfWinners, GiveawayDrawRules rules)
        {
            var free = FreePositions(rows, numberOfWinners);
            // Con «dejar abierto», cuando todos los lugares tienen ganador «choose» suma uno extra
            if (free.Count == 0 && rules.KeepOpen) return new List<int> { ExtraPosition(rows, numberOfWinners) };
            return rules.OneByOne ? free.Take(1).ToList() : free;
        }

        /// <summary>El siguiente lugar por encima de los que ya existen (ganador extra).</summary>
        public static int ExtraPosition(IEnumerable<DrawWinnerRow> rows, int numberOfWinners) =>
            System.Math.Max(System.Math.Max(1, numberOfWinners), rows.Where(r => !r.IsBackup).Select(r => r.Position).DefaultIfEmpty(0).Max()) + 1;

        /// <summary>El ganador que «reroll» reemplaza: el de menor posición que no respondió (haya vencido su plazo o no).</summary>
        public static DrawWinnerRow? PendingToReplace(IEnumerable<DrawWinnerRow> rows) =>
            rows.Where(r => !r.IsBackup && !r.WasDisqualified && !r.HasResponded).OrderBy(r => r.Position).FirstOrDefault();

        /// <summary>Si el giveaway ya puede darse por completado: nadie con plazo abierto y, en «uno por uno», todos los lugares confirmados.</summary>
        public static bool ShouldComplete(IEnumerable<DrawWinnerRow> rows, int numberOfWinners, GiveawayDrawRules rules, bool autoReroll = true)
        {
            if (rules.KeepOpen) return false;   // se termina a mano con «finish»
            var main = rows.Where(r => !r.IsBackup && !r.WasDisqualified).ToList();
            if (main.Count == 0 || !main.All(r => r.HasResponded || r.TimeoutProcessed)) return false;
            // Sin re-sorteo automático, quien no respondió se reemplaza a mano con «reroll»: no se da por terminado hasta que todos
            // los lugares estén confirmados (o el streamer use «finish»)
            return (!rules.OneByOne && autoReroll) || main.Count(r => r.HasResponded) >= numberOfWinners;
        }
    }
}
