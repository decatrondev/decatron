using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.Promo;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Promo
{
    /// <summary>Reglas puras de los disparadores del overlay de Promociones (sin base de datos ni reloj propio).</summary>
    public static class PromoTriggers
    {
        public const string Start = "start";
        public const string Raid = "raid";
        public const int MaxDelaySeconds = 120;

        /// <summary>Tiempo mínimo entre dos disparos del mismo tipo en un canal: un directo que se cae y vuelve, o varias raids seguidas, no repiten la pieza.</summary>
        public static TimeSpan Cooldown(string kind) => kind == Start ? TimeSpan.FromMinutes(15) : TimeSpan.FromMinutes(3);

        public static bool DelayValid(int seconds) => seconds is >= 0 and <= MaxDelaySeconds;

        /// <summary>Lo configurado para ese tipo en un canal: encendido, pieza (null = siguiente de la rotación) y espera en segundos.</summary>
        public static (bool Enabled, long? PieceId, int DelaySeconds) Of(PromoChannelSettings? s, string kind) => kind switch
        {
            Start => (s?.TriggerStartEnabled ?? false, s?.TriggerStartPieceId, s?.TriggerStartDelaySeconds ?? 10),
            Raid => (s?.TriggerRaidEnabled ?? false, s?.TriggerRaidPieceId, s?.TriggerRaidDelaySeconds ?? 10),
            _ => (false, null, 0),
        };

        /// <summary>true si ya pasó el enfriamiento desde el último disparo de ese tipo (o no hubo ninguno).</summary>
        public static bool CooledDown(DateTime? last, DateTime now, string kind) => last == null || now - last.Value >= Cooldown(kind);
    }

    /// <summary>
    /// Disparadores del overlay de Promociones: al empezar el directo o al recibir una raid, saca una pieza del canal (la que el streamer eligió, o
    /// la siguiente de la rotación) tras una espera. Mismo mecanismo que «Mostrar ahora» y que `!dpromo mostrar`. Nunca lanza: es accesorio y no debe
    /// romper el evento de Twitch que lo llamó. Plan: .dev/plans/overlay-promo/PLAN.md §3 (Fase 3).
    /// </summary>
    public class PromoTriggerService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IOptionsMonitor<PromoOverlaySettings> _settings;
        private readonly ILogger<PromoTriggerService> _logger;
        private readonly ConcurrentDictionary<string, DateTime> _last = new();

        public PromoTriggerService(IServiceScopeFactory scopeFactory, IOptionsMonitor<PromoOverlaySettings> settings, ILogger<PromoTriggerService> logger)
        {
            _scopeFactory = scopeFactory;
            _settings = settings;
            _logger = logger;
        }

        /// <summary>Lo llama el servicio de estado del directo y el de alertas; vuelve enseguida (la espera corre en segundo plano).</summary>
        public void Fire(string channelLogin, string kind)
        {
            if (!_settings.CurrentValue.Enabled || string.IsNullOrWhiteSpace(channelLogin)) return;
            _ = Task.Run(() => FireAsync(channelLogin, kind));
        }

        private async Task FireAsync(string channelLogin, string kind)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var sp = scope.ServiceProvider;
                var resolved = await sp.GetRequiredService<AccountChannelResolver>().ResolveLoginAsync(channelLogin);
                if (resolved == null) return;
                var principalId = resolved.Account.Principal.UserId;
                var key = resolved.Account.OverlayKey.ToLowerInvariant();

                using var tenantScope = TenantAmbient.Push(sp.GetRequiredService<ITenantResolver>().ByChannelKey(resolved.Account.OverlayKey).TenantId);
                var db = sp.GetRequiredService<DecatronDbContext>();
                var prefs = await db.PromoChannelSettings.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == principalId);
                var (enabled, pieceId, delay) = PromoTriggers.Of(prefs, kind);
                if (!enabled || prefs?.Paused == true) return;

                var cd = $"{key}|{kind}";
                var now = DateTime.UtcNow;
                if (_last.TryGetValue(cd, out var last) && !PromoTriggers.CooledDown(last, now, kind)) return;
                _last[cd] = now;

                if (delay > 0) await Task.Delay(TimeSpan.FromSeconds(Math.Min(delay, PromoTriggers.MaxDelaySeconds)));

                var state = PromoPlayback.StateOf(resolved.Account.OverlayKey);
                now = DateTime.UtcNow;
                if (pieceId is long id)
                {
                    var snap = await sp.GetRequiredService<PromoCatalogService>().GetPublishedAsync();
                    PromoPiece? piece;
                    if (PromoOwnCards.IsOwnPieceId(id))
                    {
                        var card = await db.PromoOwnCards.AsNoTracking().FirstOrDefaultAsync(c => c.Id == -id && c.UserId == principalId && !c.HiddenByAdmin);
                        piece = card == null ? null : PromoOwnCards.ToPiece(card, snap.Templates, snap.Limits);
                        if (piece?.TemplateId == null) piece = null;
                    }
                    else
                    {
                        var logins = resolved.Account.Members.Select(m => m.Login).ToList();
                        piece = snap.Pieces.FirstOrDefault(p => p.Id == id && p.Kind != PromoPlayback.EmergencyKind && PromoPlayback.IsEligible(p, p.Zone, "all", logins, now, prefs?.AcceptThirdParty ?? false));
                    }
                    if (piece != null) { PromoCommand.Force(state, piece, now); return; }
                    // La pieza elegida ya no existe o no aplica: cae a la siguiente de la rotación en vez de no mostrar nada.
                }
                lock (state.Gate) state.RotateNowUntil = now + PromoCommand.ForcedTtl;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Promo] Falló el disparador {Kind} de {Channel}", kind, channelLogin);
            }
        }
    }
}
