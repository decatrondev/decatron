using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Settings;
using Decatron.Services.Accounts;
using Decatron.Services.Platforms.Kick;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Promo
{
    /// <summary>Lo último que se supo de una cuenta: si alguna de sus plataformas está en directo, cuántos espectadores suman y (Twitch) si tiene activado el contenido de marca.</summary>
    public sealed record AudienceSample(bool Live, int Viewers, bool? Branded, DateTime At);

    /// <summary>Reglas puras de la audiencia del overlay de Promociones (sin red, sin base de datos, con el reloj por parámetro).</summary>
    public static class PromoAudience
    {
        /// <summary>Un dato más viejo que esto (p. ej. tras reiniciar el backend o si la API falla) se trata como «no se sabe»: la entrega no cuenta como en directo.</summary>
        public static readonly TimeSpan MaxAge = TimeSpan.FromMinutes(12);

        /// <summary>Cada cuánto se consultan las plataformas.</summary>
        public static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

        /// <summary>Una cuenta se sigue muestreando mientras su overlay haya pedido piezas en este plazo.</summary>
        public static readonly TimeSpan ActiveWindow = TimeSpan.FromMinutes(20);

        public static bool Fresh(AudienceSample? s, DateTime now) => s != null && now - s.At <= MaxAge && now >= s.At - TimeSpan.FromMinutes(1);

        /// <summary>Lo que se anota en una entrega: en directo y espectadores, solo con un dato reciente.</summary>
        public static (bool Live, int Viewers) Reading(AudienceSample? s, DateTime now) =>
            Fresh(s, now) && s!.Live ? (true, Math.Max(0, s.Viewers)) : (false, 0);

        /// <summary>Junta lo de cada plataforma: en directo si alguna lo está; espectadores = suma de las que lo están (el overlay se ve en todas).</summary>
        public static AudienceSample Combine(IEnumerable<(bool Live, int Viewers)> platforms, bool? branded, DateTime at)
        {
            var live = platforms.Where(p => p.Live).ToList();
            return new AudienceSample(live.Count > 0, live.Sum(p => Math.Max(0, p.Viewers)), branded, at);
        }

        /// <summary>
        /// Estado para mostrar: ready (puede salir), needsBranded (Twitch con «Contenido de marca» apagado), unknown (aún sin dato reciente o la API no respondió),
        /// notRequired (no se exige: control apagado o cuenta sin Twitch). Los espectadores y el directo salen del último dato fresco.
        /// </summary>
        public static AudienceStatus Describe(AudienceSample? s, bool hasTwitch, bool hasKick, bool required, DateTime now)
        {
            var fresh = Fresh(s, now);
            var (live, viewers) = Reading(s, now);
            string status;
            if (!required || !hasTwitch) status = "notRequired";
            else if (!fresh || s!.Branded == null) status = "unknown";
            else status = s.Branded == true ? "ready" : "needsBranded";
            return new AudienceStatus(status, live, viewers, fresh ? s!.At : null, hasTwitch, hasKick);
        }

        /// <summary>
        /// ¿Puede salir una pieza de tercero en este overlay? En Twitch (cuenta con Twitch y overlay no solo-Kick) exige contenido de marca activado y un dato reciente;
        /// si el control está apagado o el overlay es solo de Kick, no se pide (Kick no expone ese dato).
        /// </summary>
        public static bool ThirdPartyAllowed(AudienceSample? s, bool hasTwitch, string variant, bool required, DateTime now)
        {
            if (!required || !hasTwitch || variant == OverlayVariant.Kick) return true;
            return Fresh(s, now) && s!.Branded == true;
        }
    }

    /// <summary>Lo que ve el streamer o el dueño sobre la publicidad de terceros de una cuenta. Status: ready | needsBranded | unknown | notRequired.</summary>
    public sealed record AudienceStatus(string Status, bool Live, int Viewers, DateTime? SampledAt, bool HasTwitch, bool HasKick);

    /// <summary>
    /// Muestrea cada 5 minutos, solo las cuentas cuyo overlay de Promociones está pidiendo piezas, si están en directo y cuántos espectadores tienen
    /// (Twitch: Get Streams y Get Channel Information; Kick: users/livestreams; ambos con token de aplicación, sin scopes). Todo en memoria: nada se guarda
    /// aquí; cada entrega anota en la base lo que este servicio sabía en ese momento. Nunca lanza: si una API falla, el dato envejece y deja de valer.
    /// </summary>
    public class PromoAudienceService : BackgroundService
    {
        private sealed class Entry
        {
            public string? TwitchId;
            public string? KickId;
            public DateTime Touched;
            public AudienceSample? Sample;
            public int Sampling; // 0/1: evita dos muestreos a la vez de la misma cuenta
        }

        private readonly ConcurrentDictionary<long, Entry> _accounts = new();
        private readonly TwitchApiService _twitch;
        private readonly KickOAuthClient _kickOAuth;
        private readonly IHttpClientFactory _http;
        private readonly IOptionsMonitor<PromoOverlaySettings> _settings;
        private readonly ILogger<PromoAudienceService> _logger;
        private string? _kickToken;
        private DateTime _kickTokenUntil;

        public PromoAudienceService(TwitchApiService twitch, KickOAuthClient kickOAuth, IHttpClientFactory http,
            IOptionsMonitor<PromoOverlaySettings> settings, ILogger<PromoAudienceService> logger)
        {
            _twitch = twitch;
            _kickOAuth = kickOAuth;
            _http = http;
            _settings = settings;
            _logger = logger;
        }

        /// <summary>Lo llama el overlay cada vez que pide una pieza: marca la cuenta como activa y, si es nueva o su dato venció, la muestrea ya (en segundo plano).</summary>
        public void Touch(long principalUserId, string? twitchId, string? kickId)
        {
            var now = DateTime.UtcNow;
            var e = _accounts.GetOrAdd(principalUserId, _ => new Entry());
            e.TwitchId = string.IsNullOrEmpty(twitchId) ? null : twitchId;
            e.KickId = string.IsNullOrEmpty(kickId) ? null : kickId;
            e.Touched = now;
            if (!PromoAudience.Fresh(e.Sample, now) && (e.TwitchId != null || e.KickId != null)) _ = Task.Run(() => SampleAsync(e));
        }

        /// <summary>Marca la cuenta como activa (para que se muestree) y devuelve el estado para pantalla.</summary>
        public AudienceStatus Status(long principalUserId, string? twitchId, string? kickId)
        {
            Touch(principalUserId, twitchId, kickId);
            return PromoAudience.Describe(Current(principalUserId), !string.IsNullOrEmpty(twitchId), !string.IsNullOrEmpty(kickId),
                _settings.CurrentValue.RequireBrandedContentOnTwitch, DateTime.UtcNow);
        }

        public AudienceSample? Current(long principalUserId) => _accounts.TryGetValue(principalUserId, out var e) ? e.Sample : null;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); } catch (OperationCanceledException) { return; }
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.UtcNow;
                    foreach (var (id, e) in _accounts.ToList())
                    {
                        if (now - e.Touched > PromoAudience.ActiveWindow) { _accounts.TryRemove(id, out _); continue; }
                        await SampleAsync(e);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(ex, "Muestreo de audiencia de Promociones falló");
                }
                try { await Task.Delay(PromoAudience.Interval, stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }

        private async Task SampleAsync(Entry e)
        {
            if (Interlocked.Exchange(ref e.Sampling, 1) == 1) return;
            try
            {
                var parts = new List<(bool Live, int Viewers)>();
                var known = false;
                bool? branded = null;

                if (e.TwitchId != null)
                {
                    var stream = await _twitch.GetStreamAsync(e.TwitchId);
                    // GetStreamAsync devuelve null tanto si no está en directo como si falla la API; cuenta como «no en directo» (lado seguro).
                    parts.Add((stream != null, stream?.viewer_count ?? 0));
                    known = true;
                    if (_settings.CurrentValue.RequireBrandedContentOnTwitch) branded = await _twitch.GetIsBrandedContentAsync(e.TwitchId);
                }
                if (e.KickId != null)
                {
                    var kick = await KickLiveAsync(e.KickId);
                    if (kick != null) { parts.Add(kick.Value); known = true; }
                }
                if (known) e.Sample = PromoAudience.Combine(parts, branded, DateTime.UtcNow);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo muestrear la audiencia de una cuenta de Promociones");
            }
            finally { Volatile.Write(ref e.Sampling, 0); }
        }

        /// <summary>Kick: users/livestreams devuelve la transmisión solo si el canal está en directo. null si no se pudo consultar.</summary>
        private async Task<(bool Live, int Viewers)?> KickLiveAsync(string kickUserId)
        {
            try
            {
                var token = await KickTokenAsync();
                if (token == null) return null;
                var client = _http.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                using var req = new HttpRequestMessage(HttpMethod.Get, $"https://api.kick.com/public/v1/users/livestreams?user_id={Uri.EscapeDataString(kickUserId)}");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                using var res = await client.SendAsync(req);
                if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized) { _kickToken = null; return null; }
                if (!res.IsSuccessStatusCode) return null;
                using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
                if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array) return null;
                if (data.GetArrayLength() == 0) return (false, 0);
                var viewers = data[0].TryGetProperty("viewer_count", out var vc) && vc.TryGetInt32(out var v) ? v : 0;
                return (true, viewers);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "No se pudo consultar el directo de Kick para Promociones");
                return null;
            }
        }

        private async Task<string?> KickTokenAsync()
        {
            if (_kickToken != null && DateTime.UtcNow < _kickTokenUntil) return _kickToken;
            try
            {
                var t = await _kickOAuth.GetAppTokenAsync();
                _kickToken = t.AccessToken;
                _kickTokenUntil = DateTime.UtcNow.AddSeconds(Math.Max(60, t.ExpiresIn - 120));
                return _kickToken;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "No se pudo obtener el token de aplicación de Kick");
                return null;
            }
        }
    }
}
