using System;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Finance
{
    /// <summary>
    /// El tipo de cambio con el que se cobra en soles. Vivía como constante repetida en
    /// tres controladores; ahora sale de finance_settings para que el P&L y el cobro usen
    /// el mismo número. Se cachea unos minutos porque está en el camino del pago: si la
    /// base no responde, se sigue cobrando con el último valor conocido (o el de siempre),
    /// nunca se cae una compra por esto. Plan: .dev/plans/FINANZAS_PLAN.md
    /// </summary>
    public class ExchangeRate
    {
        /// <summary>El valor histórico, y el que se usa si nunca se pudo leer la configuración.</summary>
        public const decimal Fallback = 3.80m;
        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<ExchangeRate> _logger;
        private decimal _value = Fallback;
        private DateTime _readAt = DateTime.MinValue;
        private readonly SemaphoreSlim _lock = new(1, 1);

        public ExchangeRate(IServiceScopeFactory scopes, ILogger<ExchangeRate> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        /// <summary>Soles por dólar. Nunca lanza ni devuelve cero.</summary>
        public async Task<decimal> PenPerUsdAsync(CancellationToken ct = default)
        {
            if (DateTime.UtcNow - _readAt < Ttl) return _value;
            if (!await _lock.WaitAsync(0, ct)) return _value; // otra petición ya lo está refrescando
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var rate = await db.FinanceSettings.AsNoTracking().Where(s => s.Id == 1).Select(s => s.PenPerUsd).FirstOrDefaultAsync(ct);
                if (rate > 0) _value = rate;
                _readAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                // Un cobro no se cae porque la configuración no se pudo leer.
                _logger.LogWarning(ex, "[ExchangeRate] No se pudo leer el tipo de cambio; se usa {Value}", _value);
                _readAt = DateTime.UtcNow;
            }
            finally { _lock.Release(); }
            return _value;
        }
    }
}
