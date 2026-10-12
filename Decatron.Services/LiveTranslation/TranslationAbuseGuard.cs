using System.Collections.Concurrent;
using Decatron.Hubs;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>Un endurecimiento automático activo en un canal.</summary>
    public sealed record AbuseState(DateTime Since, DateTime Until, string Reason, int Attempts, int Rejections);

    /// <summary>
    /// Detecta abuso en la entrada a un canal y lo frena sin esperar al streamer: si en un minuto hay un pico de rechazos de los que
    /// delatan sondeo (demasiadas conexiones de una IP, intentos por minuto, idiomas inventados) o un diluvio de intentos, el canal sube
    /// solo a «Con sesión» durante 30 minutos (el streamer lo ve en su panel y puede quitarlo). También recuerda las IPs que el streamer
    /// sacó de su canal (60 min). Todo en memoria: un reinicio lo borra, y no toca lo que el streamer guardó. Plan: TRADUCCION_ACCESO_PLAN.md, Fase 4.
    /// </summary>
    public sealed class TranslationAbuseGuard : ITranslationAbuseGuard
    {
        public static readonly TimeSpan Window = TimeSpan.FromSeconds(60);
        public static readonly TimeSpan HardenFor = TimeSpan.FromMinutes(30);
        public static readonly TimeSpan IpBanFor = TimeSpan.FromMinutes(60);
        /// <summary>Rechazos «de sondeo» por minuto que disparan el endurecimiento.</summary>
        public const int ProbeRejections = 25;
        /// <summary>Intentos por minuto que disparan el endurecimiento: lo mayor entre este valor y el tope de oyentes del canal (un directo grande tiene picos legítimos al empezar).</summary>
        public const int FloodAttempts = 60;
        private static readonly HashSet<string> ProbeReasons = new() { "ip_limit", "rate_limited", "user_limit", "language", "blocked" };

        private readonly Func<DateTime> _now;
        private readonly ILogger<TranslationAbuseGuard>? _logger;
        private readonly ConcurrentDictionary<string, Queue<(DateTime At, bool Probe)>> _events = new();
        private readonly ConcurrentDictionary<string, AbuseState> _hardened = new();
        private readonly ConcurrentDictionary<string, DateTime> _ipBans = new();

        public TranslationAbuseGuard(ILogger<TranslationAbuseGuard>? logger = null, Func<DateTime>? clock = null)
        {
            _logger = logger;
            _now = clock ?? (() => DateTime.UtcNow);
        }

        public void Record(string login, bool accepted, string? reason, int capacity)
        {
            login = login.ToLowerInvariant();
            var now = _now();
            var q = _events.GetOrAdd(login, _ => new Queue<(DateTime, bool)>());
            int attempts, probes;
            lock (q)
            {
                q.Enqueue((now, !accepted && reason != null && ProbeReasons.Contains(reason)));
                while (q.Count > 0 && now - q.Peek().At > Window) q.Dequeue();
                attempts = q.Count;
                probes = q.Count(e => e.Probe);
            }
            var floodAt = Math.Max(FloodAttempts, capacity);
            if (probes < ProbeRejections && attempts < floodAt) return;
            if (Active(login) != null) return;   // ya está endurecido

            var why = probes >= ProbeRejections ? "probe" : "flood";
            _hardened[login] = new AbuseState(now, now + HardenFor, why, attempts, probes);
            _logger?.LogWarning("[LiveTranslation] Posible abuso en {Login}: {Attempts} intentos y {Rejections} rechazos de sondeo en un minuto; el canal sube a «con sesión» durante {Minutes} min", login, attempts, probes, (int)HardenFor.TotalMinutes);
        }

        /// <summary>El endurecimiento activo del canal, o null.</summary>
        public AbuseState? Active(string login)
        {
            login = login.ToLowerInvariant();
            if (!_hardened.TryGetValue(login, out var s)) return null;
            if (s.Until > _now()) return s;
            _hardened.TryRemove(login, out _);
            return null;
        }

        public void Clear(string login) { _hardened.TryRemove(login.ToLowerInvariant(), out _); _events.TryRemove(login.ToLowerInvariant(), out _); }

        public void BanIp(string login, string ip) => _ipBans[login.ToLowerInvariant() + "|" + ip] = _now() + IpBanFor;

        public bool IsIpBanned(string login, string ip)
        {
            var key = login.ToLowerInvariant() + "|" + ip;
            if (!_ipBans.TryGetValue(key, out var until)) return false;
            if (until > _now()) return true;
            _ipBans.TryRemove(key, out _);
            return false;
        }

        /// <summary>«203.0.113.45» → «203.0.113.•»; IPv6: se oculta la mitad final. Para mostrarla al streamer sin revelar la dirección completa.</summary>
        public static string MaskIp(string ip)
        {
            if (string.IsNullOrEmpty(ip) || ip == "unknown") return "•";
            if (ip.Contains('.')) { var p = ip.Split('.'); return p.Length == 4 ? $"{p[0]}.{p[1]}.{p[2]}.•" : "•"; }
            var g = ip.Split(':');
            return g.Length >= 4 ? string.Join(":", g.Take(4)) + ":•" : "•";
        }

        /// <summary>Un identificador corto y estable de una conexión, para que el panel pueda señalarla sin conocer su id real.</summary>
        public static string ListenerId(string connectionId) =>
            Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("lt-listener:" + connectionId)))[..12].ToLowerInvariant();
    }

    /// <summary>Reglas del presupuesto de créditos de una sesión y del aviso de créditos bajos (lógica pura).</summary>
    public static class CreditBudgetEvaluator
    {
        public enum State { None, Warn, Exceeded }

        /// <summary>Sin presupuesto no hay límite; a partir del 80% se avisa; al llegar al 100% se corta.</summary>
        public static State Evaluate(long used, long? budget)
        {
            if (budget is not > 0) return State.None;
            if (used >= budget) return State.Exceeded;
            return used * 100 >= budget * 80 ? State.Warn : State.None;
        }

        /// <summary>Minutos que alcanza el saldo al ritmo de gasto de esta sesión. null si todavía no hay datos para estimarlo (menos de 2 minutos o sin gasto).</summary>
        public static double? MinutesLeft(long balance, long used, double elapsedMinutes)
        {
            if (elapsedMinutes < 2 || used <= 0) return null;
            var perMinute = used / elapsedMinutes;
            return perMinute <= 0 ? null : balance / perMinute;
        }

        /// <summary>Se avisa cuando alcanza para 15 minutos o menos.</summary>
        public const double LowCreditsMinutes = 15;
    }
}
