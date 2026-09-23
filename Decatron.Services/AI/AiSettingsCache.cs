using System.Text.Json;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.AI
{
    /// <summary>
    /// Copia en memoria de <see cref="DecatronAIGlobalConfig"/> (modelos por módulo y tabla de precios)
    /// para que los singletons (traducción, coach) no abran un scope de DB por cada frase.
    /// Se refresca sola cada minuto y el admin la invalida al guardar.
    /// </summary>
    public class AiSettingsCache
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(1);

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<AiSettingsCache> _logger;
        private readonly SemaphoreSlim _lock = new(1, 1);

        private DecatronAIGlobalConfig _config = new();
        private Dictionary<string, (decimal In, decimal Out)> _prices = new(StringComparer.OrdinalIgnoreCase);
        private DateTime _loadedAt = DateTime.MinValue;

        public AiSettingsCache(IServiceScopeFactory scopes, ILogger<AiSettingsCache> logger)
        {
            _scopes = scopes;
            _logger = logger;
            ParsePrices(DecatronAIGlobalConfig.DefaultModelPricesJson);
        }

        public string TranslationModel => Current.TranslationModel;
        public string CoachModel => Current.CoachModel;

        /// <summary>Los modelos de respaldo, en orden, sin vacíos ni repetidos.</summary>
        public IReadOnlyList<string> FallbackModels =>
            (Current.FallbackModels ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        public DecatronAIGlobalConfig Current
        {
            get
            {
                if (DateTime.UtcNow - _loadedAt > Ttl) _ = RefreshAsync();
                return _config;
            }
        }

        public void Invalidate() => _loadedAt = DateTime.MinValue;

        /// <summary>USD por 1M tokens (in, out) del modelo, o null si no está en la tabla.</summary>
        public (decimal In, decimal Out)? PriceFor(string model)
            => _prices.TryGetValue(model, out var p) ? p : null;

        /// <summary>Costo estimado en USD de una llamada. 0 si el modelo no tiene precio cargado.</summary>
        public decimal EstimateCost(string model, int promptTokens, int completionTokens)
        {
            _ = Current; // dispara refresh si toca
            if (PriceFor(model) is not { } p) return 0m;
            return (promptTokens * p.In + completionTokens * p.Out) / 1_000_000m;
        }

        /// <summary>
        /// Espera a tener la config al día antes de una llamada. <see cref="Current"/> solo
        /// dispara el refresco y devuelve lo que había: después de un rato sin uso, la primera
        /// llamada salía con el modelo viejo (pasó el 2026-09-23: el coach habló con Qwen
        /// después de cambiarlo a gpt-6-luna). Con la config fresca no cuesta nada.
        /// </summary>
        public async Task EnsureFreshAsync()
        {
            if (DateTime.UtcNow - _loadedAt <= Ttl) return;
            await _lock.WaitAsync();
            try
            {
                if (DateTime.UtcNow - _loadedAt > Ttl) await LoadAsync();
            }
            finally { _lock.Release(); }
        }

        public async Task RefreshAsync()
        {
            if (!await _lock.WaitAsync(0)) return;
            try { await LoadAsync(); }
            finally { _lock.Release(); }
        }

        /// <summary>Lee la config de la base. Se llama con el candado tomado.</summary>
        private async Task LoadAsync()
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var cfg = await db.DecatronAIGlobalConfigs.AsNoTracking().FirstOrDefaultAsync();
                if (cfg != null)
                {
                    _config = cfg;
                    ParsePrices(cfg.ModelPricesJson);
                }
                _loadedAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AI-SETTINGS] No se pudo refrescar la config global de IA");
                _loadedAt = DateTime.UtcNow; // no martillar la DB si está caída
            }
        }

        private void ParsePrices(string json)
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, decimal>>>(json);
                if (parsed == null) return;
                var dict = new Dictionary<string, (decimal, decimal)>(StringComparer.OrdinalIgnoreCase);
                foreach (var (model, p) in parsed)
                    dict[model] = (p.GetValueOrDefault("in"), p.GetValueOrDefault("out"));
                _prices = dict;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AI-SETTINGS] model_prices_json inválido, se mantiene la tabla anterior");
            }
        }
    }
}
