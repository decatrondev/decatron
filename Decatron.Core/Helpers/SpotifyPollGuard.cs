using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Decatron.Core.Helpers
{
    /// <summary>Estados de la conexión con Spotify guardados en now_playing_configs.spotify_status.</summary>
    public static class SpotifyConnectionStatus
    {
        public const string Ok = "ok";
        /// <summary>Spotify pide autorizar de nuevo (invalid_grant): no se reintenta hasta que la persona reconecte.</summary>
        public const string ReauthRequired = "reauth";
        /// <summary>Spotify rechaza la cuenta (403): correo fuera del panel de Spotify o dueño sin Premium.</summary>
        public const string Forbidden = "forbidden";

        /// <summary>La autorización de Spotify vence a los 6 meses desde que la persona autorizó; renovar no la alarga.</summary>
        public static DateTime? AuthorizationExpiresAt(DateTime? authorizedAt) => authorizedAt?.AddMonths(6);
    }

    public enum SpotifyRefreshOutcome { Ok, ReauthRequired, RateLimited, Failed }

    /// <summary>Resultado de renovar el token de acceso de Spotify.</summary>
    public sealed record SpotifyRefreshResult(SpotifyRefreshOutcome Outcome, string? AccessToken = null, TimeSpan? RetryAfter = null, string? Error = null);

    public static class SpotifyTokenResponse
    {
        /// <summary>Clasifica una respuesta fallida de accounts.spotify.com/api/token.</summary>
        public static SpotifyRefreshResult ClassifyFailure(HttpStatusCode status, string? body, TimeSpan? retryAfter)
        {
            var (error, description) = ParseError(body);
            var detail = description == null ? error : $"{error}: {description}";
            if (status == HttpStatusCode.TooManyRequests)
                return new SpotifyRefreshResult(SpotifyRefreshOutcome.RateLimited, RetryAfter: retryAfter, Error: detail);
            if (status == HttpStatusCode.BadRequest && error == "invalid_grant")
                return new SpotifyRefreshResult(SpotifyRefreshOutcome.ReauthRequired, Error: detail);
            return new SpotifyRefreshResult(SpotifyRefreshOutcome.Failed, Error: detail ?? status.ToString());
        }

        /// <summary>Lee «error» y «error_description»; un cuerpo que no sea JSON no es un error propio.</summary>
        private static (string? Error, string? Description) ParseError(string? body)
        {
            if (string.IsNullOrWhiteSpace(body)) return (null, null);
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.ValueKind != JsonValueKind.Object) return (null, null);
                return (Text(doc.RootElement, "error"), Text(doc.RootElement, "error_description"));
            }
            catch (JsonException)
            {
                return (null, null);
            }
        }

        private static string? Text(JsonElement root, string name) =>
            root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

        /// <summary>Retry-After en segundos o como fecha; null si no vino o ya pasó.</summary>
        public static TimeSpan? ParseRetryAfter(RetryConditionHeaderValue? header, DateTimeOffset now)
        {
            if (header?.Delta is { } delta) return delta > TimeSpan.Zero ? delta : null;
            if (header?.Date is { } date && date > now) return date - now;
            return null;
        }
    }

    /// <summary>
    /// Decide cuándo se puede volver a llamar a Spotify. El límite de Spotify es de la app entera, así que un
    /// 429 detiene todos los canales; los demás fallos solo detienen al canal que falló, con espera creciente.
    /// Con todo en orden no agrega ninguna demora. La usa una sola tarea de fondo: no necesita bloqueos.
    /// </summary>
    public sealed class SpotifyPollGuard
    {
        private static readonly TimeSpan NoRetryAfterBase = TimeSpan.FromSeconds(30);
        private static readonly TimeSpan NoRetryAfterMax = TimeSpan.FromHours(1);

        private readonly Dictionary<string, (int Failures, DateTime Until)> _channels = new(StringComparer.OrdinalIgnoreCase);
        private DateTime _appPausedUntil = DateTime.MinValue;
        private int _appStrikes;

        public bool CanCall(string channel, DateTime now) =>
            now >= _appPausedUntil && (!_channels.TryGetValue(channel, out var entry) || now >= entry.Until);

        /// <summary>
        /// Spotify respondió 429: se respeta su Retry-After completo, sin tope. Si no lo manda, la espera crece
        /// mientras sigan llegando 429. Nunca acorta una pausa que ya estaba en curso.
        /// </summary>
        public TimeSpan PauseApp(TimeSpan? retryAfter, DateTime now)
        {
            var wait = retryAfter ?? Grow(NoRetryAfterBase, NoRetryAfterMax, _appStrikes);
            _appStrikes++;
            var until = now + wait;
            if (until > _appPausedUntil) _appPausedUntil = until;
            return _appPausedUntil - now;
        }

        /// <summary>Un fallo de este canal: espera base, 2×, 4×… hasta el máximo. Devuelve la espera aplicada.</summary>
        public TimeSpan RecordFailure(string channel, DateTime now, TimeSpan baseWait, TimeSpan maxWait)
        {
            var failures = _channels.TryGetValue(channel, out var entry) ? entry.Failures : 0;
            var wait = Grow(baseWait, maxWait, failures);
            _channels[channel] = (failures + 1, now + wait);
            return wait;
        }

        /// <summary>Spotify respondió bien a este canal: se olvidan sus fallos y los 429 acumulados.</summary>
        public void RecordSuccess(string channel)
        {
            _channels.Remove(channel);
            _appStrikes = 0;
        }

        /// <summary>La persona reconectó: su espera anterior ya no aplica. Una pausa de la app sigue en pie.</summary>
        public void ForgetChannel(string channel) => _channels.Remove(channel);

        private static TimeSpan Grow(TimeSpan baseWait, TimeSpan maxWait, int previous)
        {
            var seconds = baseWait.TotalSeconds * Math.Pow(2, Math.Min(previous, 20));
            return seconds >= maxWait.TotalSeconds ? maxWait : TimeSpan.FromSeconds(seconds);
        }
    }
}
