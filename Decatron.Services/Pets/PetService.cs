using System;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Hubs;
using Decatron.Core.Models.Pets;
using Decatron.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Pets
{
    /// <summary>
    /// Config de la mascota por canal + estímulos al overlay por SignalR (grupo overlay_{login}).
    /// El "cerebro" (pasear, sentarse, dormir) corre en el overlay; acá solo se mandan eventos puntuales.
    /// Plan: .dev/plans/PETS_PLAN.md §3
    /// </summary>
    public class PetService
    {
        public const int MaxBubbleLength = 120;
        public const int MaxDurationSec = 30;

        private readonly DecatronDbContext _db;
        private readonly IHubContext<OverlayHub> _hub;
        private readonly ILogger<PetService> _logger;

        public PetService(DecatronDbContext db, IHubContext<OverlayHub> hub, ILogger<PetService> logger)
        {
            _db = db;
            _hub = hub;
            _logger = logger;
        }

        public Task<PetConfig?> GetAsync(long userId) =>
            _db.PetConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == userId);

        /// <summary>Guarda (o crea) la config del canal. El JSON se valida solo como JSON: el shape es del frontend.</summary>
        public async Task<PetConfig> SaveAsync(long userId, bool isEnabled, string configJson)
        {
            using (JsonDocument.Parse(configJson)) { } // lanza si no es JSON válido

            var config = await _db.PetConfigs.FirstOrDefaultAsync(c => c.UserId == userId);
            if (config == null)
            {
                config = new PetConfig { UserId = userId };
                _db.PetConfigs.Add(config);
            }
            config.IsEnabled = isEnabled;
            config.ConfigJson = configJson;
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return config;
        }

        /// <summary>Avisa al overlay que la config cambió (recarga sin refrescar la página).</summary>
        public async Task NotifyConfigChangedAsync(string login)
        {
            try { await _hub.Clients.Group($"overlay_{login.ToLowerInvariant()}").SendAsync("PetConfigChanged"); }
            catch (Exception ex) { _logger.LogWarning(ex, "[PETS] No se pudo notificar PetConfigChanged a {Login}", login); }
        }

        /// <summary>
        /// Manda un estímulo a la mascota: estado del manifest (idle/walk/sit/sleep/react…), duración y burbuja opcional.
        /// Nunca lanza: una mascota no puede tirar una alerta ni el timer.
        /// </summary>
        public async Task SendEventAsync(string login, string state, int durationSec, string? bubble = null, string source = "test")
        {
            try
            {
                var payload = new
                {
                    state = string.IsNullOrWhiteSpace(state) ? "react" : state.Trim(),
                    durationSec = Math.Clamp(durationSec, 1, MaxDurationSec),
                    bubble = string.IsNullOrWhiteSpace(bubble) ? null : bubble.Trim()[..Math.Min(bubble.Trim().Length, MaxBubbleLength)],
                    source,
                };
                await _hub.Clients.Group($"overlay_{login.ToLowerInvariant()}").SendAsync("PetEvent", payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[PETS] No se pudo enviar PetEvent a {Login}", login);
            }
        }
    }
}
