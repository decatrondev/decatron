namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Reglas puras de la Happy Hour por progreso del timer (sin base de datos ni reloj propio:
    /// todo entra por parámetro para poder probarlas).
    /// </summary>
    public static class HappyHourProgressRule
    {
        /// <summary>Estados en que el timer está en pausa (a mano, por horario o porque se cortó el directo): el reloj queda congelado.</summary>
        public static bool IsPausedStatus(string? status) => status is "paused" or "auto_paused" or "stream_paused";

        /// <summary>
        /// Segundos que lleva corriendo el timer sin contar pausas, o null si no corre ni está pausado.
        /// Misma cuenta que usa el panel: ahora − inicio − tiempo en pausa; si está pausado, se congela en el momento de la pausa.
        /// </summary>
        public static long? ElapsedSeconds(string? status, DateTime? startedAtUtc, DateTime? pausedAtUtc, int elapsedPausedSeconds, DateTime nowUtc)
        {
            if (startedAtUtc == null) return null;
            double total;
            if (status == "running") total = (nowUtc - startedAtUtc.Value).TotalSeconds;
            else if (IsPausedStatus(status) && pausedAtUtc != null) total = (pausedAtUtc.Value - startedAtUtc.Value).TotalSeconds;
            else return null;
            var v = (long)(total - elapsedPausedSeconds);
            return v < 0 ? 0 : v;
        }

        /// <summary>
        /// Segundos que le quedan al timer (total acumulado menos lo transcurrido), o null si no corre ni está pausado.
        /// Misma cuenta que el panel: sube con las donaciones y baja con el tiempo.
        /// </summary>
        public static long? RemainingSeconds(string? status, DateTime? startedAtUtc, DateTime? pausedAtUtc, int elapsedPausedSeconds, int totalSeconds, DateTime nowUtc)
        {
            var elapsed = ElapsedSeconds(status, startedAtUtc, pausedAtUtc, elapsedPausedSeconds, nowUtc);
            if (elapsed == null) return null;
            return Math.Max(0, totalSeconds - Math.Min(elapsed.Value, totalSeconds));
        }

        /// <summary>Modo «por tiempo restante»: activa mientras al timer le quede ese tiempo o menos (y todavía le quede algo).</summary>
        public static bool EvaluateRemaining(long remainingSeconds, int? thresholdSeconds)
            => thresholdSeconds is > 0 && remainingSeconds > 0 && remainingSeconds <= thresholdSeconds;

        /// <summary>Texto de error del modo «por tiempo restante»; null si es válido.</summary>
        public static string? ValidateRemaining(int? thresholdSeconds)
            => thresholdSeconds is > 0 ? null : "Indica cuánto tiempo restante activa la Happy Hour";

        /// <summary>Largo de la ventana: la duración, o la distancia entre los dos umbrales. null = configuración inválida.</summary>
        public static long? WindowSeconds(int? startAfter, int? endAfter, int? duration)
        {
            if (startAfter == null || startAfter < 0) return null;
            long? len = duration is > 0 ? duration : (endAfter != null ? endAfter - startAfter : null);
            return len is > 0 ? len : null;
        }

        /// <summary>Texto de error si la configuración no sirve; null si es válida.</summary>
        public static string? Validate(int? startAfter, int? endAfter, int? duration, int? repeatEvery)
        {
            if (startAfter == null || startAfter < 0) return "Indica a qué tiempo del timer se activa";
            if (duration is > 0 && endAfter != null) return "Elige solo una: duración o tiempo de fin";
            var len = WindowSeconds(startAfter, endAfter, duration);
            if (len == null) return "Indica cuánto dura o en qué tiempo termina (debe ser después del inicio)";
            if (repeatEvery != null && repeatEvery <= len) return "Repetir cada debe ser mayor que lo que dura";
            return null;
        }

        /// <summary>
        /// ¿Está activa con este tiempo transcurrido? Devuelve también cuántos segundos de timer le quedan a la ventana.
        /// Con repetición, la ventana vuelve a abrirse cada <paramref name="repeatEvery"/> segundos desde el inicio.
        /// </summary>
        public static (bool Active, long SecondsLeft) Evaluate(long elapsed, int? startAfter, int? endAfter, int? duration, int? repeatEvery)
        {
            var len = WindowSeconds(startAfter, endAfter, duration);
            if (len == null || elapsed < startAfter!.Value) return (false, 0);
            var offset = elapsed - startAfter.Value;
            if (repeatEvery is > 0 && repeatEvery > len) offset %= repeatEvery.Value;
            return offset < len ? (true, len.Value - offset) : (false, 0);
        }
    }
}
