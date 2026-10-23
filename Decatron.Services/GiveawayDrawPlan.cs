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
                if (r.WasDisqualified || (!r.HasResponded && r.TimeoutProcessed))
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
            return rules.OneByOne ? free.Take(1).ToList() : free;
        }

        /// <summary>El ganador que «reroll» reemplaza: el de menor posición que no respondió (haya vencido su plazo o no).</summary>
        public static DrawWinnerRow? PendingToReplace(IEnumerable<DrawWinnerRow> rows) =>
            rows.Where(r => !r.IsBackup && !r.WasDisqualified && !r.HasResponded).OrderBy(r => r.Position).FirstOrDefault();

        /// <summary>Si el giveaway ya puede darse por completado: nadie con plazo abierto y, en «uno por uno», todos los lugares confirmados.</summary>
        public static bool ShouldComplete(IEnumerable<DrawWinnerRow> rows, int numberOfWinners, GiveawayDrawRules rules)
        {
            var main = rows.Where(r => !r.IsBackup && !r.WasDisqualified).ToList();
            if (main.Count == 0 || !main.All(r => r.HasResponded || r.TimeoutProcessed)) return false;
            return !rules.OneByOne || main.Count(r => r.HasResponded) >= numberOfWinners;
        }
    }
}
