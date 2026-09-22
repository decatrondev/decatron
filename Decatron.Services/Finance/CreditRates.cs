using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.Finance;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Finance
{
    /// <summary>
    /// Las tarifas vigentes, leídas de la base y cacheadas un minuto para que un cambio en
    /// el admin se note enseguida sin castigar cada cobro con una consulta. Si la base no
    /// responde se sigue cobrando con lo último conocido: un cobro nunca se cae por esto,
    /// y nunca se cobra de menos por una tarifa que no se pudo leer.
    /// </summary>
    public class CreditRates
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(1);
        /// <summary>Si un motor no tiene tarifa cargada se usa esta, deliberadamente cara: mejor cobrar de más que regalar el servicio.</summary>
        public const decimal UnknownEngineCredits = 10m;

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<CreditRates> _logger;
        private Dictionary<string, CreditRate> _rates = new(StringComparer.OrdinalIgnoreCase);
        private decimal _creditUsd = 0.000004m;
        private DateTime _readAt = DateTime.MinValue;
        private readonly SemaphoreSlim _lock = new(1, 1);

        public CreditRates(IServiceScopeFactory scopes, ILogger<CreditRates> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        /// <summary>Cuántos dólares vale un crédito (el ancla de toda la economía).</summary>
        public async Task<decimal> CreditUsdAsync(CancellationToken ct = default)
        {
            await EnsureAsync(ct);
            return _creditUsd > 0 ? _creditUsd : 0.000004m;
        }

        public async Task<IReadOnlyCollection<CreditRate>> AllAsync(CancellationToken ct = default)
        {
            await EnsureAsync(ct);
            return _rates.Values.ToList();
        }

        /// <summary>Créditos por unidad de ese motor (caracteres, segundos, o multiplicador sobre el costo en USD).</summary>
        public async Task<decimal> PerUnitAsync(string engine, CancellationToken ct = default)
        {
            await EnsureAsync(ct);
            if (_rates.TryGetValue(engine ?? "standard", out var r) && r.Enabled) return r.CreditsPerUnit;
            if (string.Equals(engine, "standard", StringComparison.OrdinalIgnoreCase)) return 1m;
            _logger.LogWarning("[CreditRates] Motor sin tarifa configurada: {Engine}. Se cobra la tarifa de resguardo ({Credits}).", engine, UnknownEngineCredits);
            return UnknownEngineCredits;
        }

        private async Task EnsureAsync(CancellationToken ct)
        {
            if (DateTime.UtcNow - _readAt < Ttl && _rates.Count > 0) return;
            if (!await _lock.WaitAsync(0, ct)) return;
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var rates = await db.CreditRates.AsNoTracking().ToListAsync(ct);
                if (rates.Count > 0) _rates = rates.ToDictionary(r => r.Engine, StringComparer.OrdinalIgnoreCase);
                var creditUsd = await db.FinanceSettings.AsNoTracking().Where(s => s.Id == 1).Select(s => s.CreditUsd).FirstOrDefaultAsync(ct);
                if (creditUsd > 0) _creditUsd = creditUsd;
                _readAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[CreditRates] No se pudieron leer las tarifas; se siguen usando las últimas conocidas");
                _readAt = DateTime.UtcNow;
            }
            finally { _lock.Release(); }
        }
    }
}
