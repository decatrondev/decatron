using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Models.Promo;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Reglas de rotación del overlay de Promociones, sin base de datos ni reloj propio para poder probarlas:
    /// qué piezas pueden salir ahora en una zona, cuál se elige y cuánto hay que esperar. Plan: .dev/plans/overlay-promo/PLAN.md.
    /// </summary>
    public static class PromoPlayback
    {
        /// <summary>Lo que ya se mostró de una cuenta: fin de la última pieza por zona, última pieza y segundos de la última hora.</summary>
        public class State
        {
            public readonly object Gate = new();
            public Dictionary<string, DateTime> ZoneFreeAt { get; } = new();
            public Dictionary<string, long> LastPiece { get; } = new();
            public List<(DateTime At, int Seconds)> Shown { get; } = new();
            /// <summary>Pieza pedida con el comando del chat, por zona: sale en la próxima consulta del overlay y se consume.</summary>
            public Dictionary<string, (long PieceId, DateTime Expires)> Forced { get; } = new();
            /// <summary>Piezas del bot mostradas desde la última tarjeta propia (empieza en 0: la primera siempre es del bot) y cuándo salió cada tarjeta propia.</summary>
            public int BotSinceOwn { get; set; }
            public Dictionary<long, DateTime> OwnLastShown { get; } = new();
            /// <summary>Un disparador (inicio de directo, raid) pidió que salga ya la siguiente pieza de la rotación, sin esperar la pausa entre piezas. Vence solo.</summary>
            public DateTime? RotateNowUntil { get; set; }
        }

        private static readonly ConcurrentDictionary<string, State> States = new();
        public static State StateOf(string overlayKey) => States.GetOrAdd(overlayKey.ToLowerInvariant(), _ => new State());

        /// <summary>Los topes que aplican a un canal: el streamer solo puede ser más discreto (mayor pausa, menor tope por hora), nunca más insistente.</summary>
        public static PromoOverlayLimits EffectiveLimits(PromoOverlayLimits global, PromoChannelSettings? mine) => new()
        {
            MinGapSeconds = Math.Max(global.MinGapSeconds, mine?.MinGapSeconds ?? 0),
            HourlyCapSeconds = mine?.HourlyCapSeconds is int cap ? (global.HourlyCapSeconds > 0 ? Math.Min(global.HourlyCapSeconds, cap) : cap) : global.HourlyCapSeconds,
        };

        /// <summary>Ids de piezas que el streamer apagó (JSON de números; lo ilegible se ignora).</summary>
        public static HashSet<long> DisabledIds(PromoChannelSettings? mine)
        {
            if (mine == null || string.IsNullOrWhiteSpace(mine.DisabledPieces)) return new();
            try { return System.Text.Json.JsonSerializer.Deserialize<List<long>>(mine.DisabledPieces)?.ToHashSet() ?? new(); }
            catch (System.Text.Json.JsonException) { return new(); }
        }

        /// <summary>true si la pieza puede salir en este canal ahora (vigencia, plataforma y canales permitidos).</summary>
        public static bool IsEligible(PromoPiece p, string zone, string variant, IReadOnlyCollection<string> logins, DateTime now)
        {
            if (p.Status != "published" || p.Weight <= 0 || p.Zone != zone) return false;
            if (p.StartsAt != null && now < p.StartsAt.Value) return false;
            if (p.EndsAt != null && now > p.EndsAt.Value) return false;
            if (variant != "all" && p.Platforms != "all" && p.Platforms != variant) return false;
            if (!string.IsNullOrWhiteSpace(p.OnlyChannels))
            {
                var allowed = p.OnlyChannels.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(c => c.ToLowerInvariant()).ToHashSet();
                if (!logins.Any(l => allowed.Contains(l.ToLowerInvariant()))) return false;
            }
            return true;
        }

        /// <summary>Tipo de pieza que reemplaza a todas las demás mientras esté publicada y vigente: no entra en la rotación normal.</summary>
        public const string EmergencyKind = "emergency";

        /// <summary>
        /// La pieza de emergencia vigente para este canal (mayor prioridad, y la más reciente si empatan), o null. Ignora la pausa entre piezas,
        /// el tope por hora y lo que el streamer apagó: es un aviso del dueño que debe llegar a todos los canales a los que aplica.
        /// </summary>
        public static PromoPiece? PickEmergency(IEnumerable<PromoPiece> published, string variant, IReadOnlyCollection<string> logins, DateTime now) =>
            published.Where(p => p.Kind == EmergencyKind && IsEligible(p, p.Zone, variant, logins, now))
                .OrderByDescending(p => p.Priority).ThenByDescending(p => p.Id).FirstOrDefault();

        /// <summary>
        /// Elige la pieza: solo las de mayor prioridad, sin repetir la anterior si hay otra, sorteo por peso.
        /// <paramref name="roll"/> es un número en [0,1) (inyectable para las pruebas).
        /// </summary>
        public static PromoPiece? Pick(IReadOnlyList<PromoPiece> eligible, long? lastPieceId, double roll)
        {
            if (eligible.Count == 0) return null;
            var top = eligible.Max(p => p.Priority);
            var pool = eligible.Where(p => p.Priority == top).ToList();
            if (pool.Count > 1 && lastPieceId != null) pool = pool.Where(p => p.Id != lastPieceId).ToList();
            var total = pool.Sum(p => p.Weight);
            var target = roll * total;
            foreach (var p in pool)
            {
                target -= p.Weight;
                if (target < 0) return p;
            }
            return pool[^1];
        }

        public static int SecondsLastHour(State s, DateTime now)
        {
            s.Shown.RemoveAll(x => now - x.At > TimeSpan.FromHours(1));
            return s.Shown.Sum(x => x.Seconds);
        }

        /// <summary>
        /// Segundos que debe esperar la zona antes de mostrar otra pieza (0 = puede salir ya): el mínimo entre piezas de la zona
        /// y el tope de segundos por hora (que libera cuando la entrada más vieja sale de la ventana).
        /// </summary>
        public static int WaitSeconds(State s, string zone, PromoOverlayLimits limits, int nextDuration, DateTime now)
        {
            var wait = 0.0;
            if (s.ZoneFreeAt.TryGetValue(zone, out var freeAt)) wait = Math.Max(wait, (freeAt - now).TotalSeconds);
            var used = SecondsLastHour(s, now);
            if (limits.HourlyCapSeconds > 0 && used + nextDuration > limits.HourlyCapSeconds && s.Shown.Count > 0)
            {
                var needed = used + nextDuration - limits.HourlyCapSeconds;
                var freed = 0;
                foreach (var x in s.Shown.OrderBy(x => x.At))
                {
                    freed += x.Seconds;
                    if (freed >= needed) { wait = Math.Max(wait, (x.At.AddHours(1) - now).TotalSeconds); break; }
                }
            }
            return (int)Math.Ceiling(Math.Max(0, wait));
        }

        public static void MarkShown(State s, PromoPiece p, PromoOverlayLimits limits, DateTime now)
        {
            s.ZoneFreeAt[p.Zone] = now.AddSeconds(p.DurationSeconds + Math.Max(0, limits.MinGapSeconds));
            s.LastPiece[p.Zone] = p.Id;
            s.Shown.Add((now, p.DurationSeconds));
            if (PromoOwnCards.IsOwnPieceId(p.Id)) { s.BotSinceOwn = 0; s.OwnLastShown[-p.Id] = now; }
            else s.BotSinceOwn++;
        }
    }
}
