using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.AI
{
    /// <summary>
    /// Escribe una fila en ai_usage_logs por cada llamada a un LLM y, si salió bien y tiene
    /// canal, le descuenta el costo en créditos (AiCreditGate). Fire-and-forget: nunca
    /// bloquea ni hace fallar la respuesta al usuario.
    /// </summary>
    public class AiUsageRecorder
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly AiSettingsCache _settings;
        private readonly AiCreditGate _credits;
        private readonly ILogger<AiUsageRecorder> _logger;

        public AiUsageRecorder(IServiceScopeFactory scopes, AiSettingsCache settings, AiCreditGate credits, ILogger<AiUsageRecorder> logger)
        {
            _scopes = scopes;
            _settings = settings;
            _credits = credits;
            _logger = logger;
        }

        /// <param name="actualCostUsd">Costo real reportado por el proveedor (OpenRouter lo manda en usage.cost). Si es null se estima con la tabla de precios.</param>
        public void Record(AiCallContext? ctx, string provider, string model,
            int promptTokens, int completionTokens, int responseTimeMs, bool success, string? error = null, decimal? actualCostUsd = null)
        {
            ctx ??= AiCallContext.Unknown;
            var row = new AiUsageLog
            {
                Module = ctx.Module,
                Provider = provider,
                Model = model,
                UserId = ctx.UserId,
                ChannelName = ctx.ChannelName,
                PromptTokens = promptTokens,
                CompletionTokens = completionTokens,
                EstimatedCostUsd = !success ? 0m : actualCostUsd ?? _settings.EstimateCost(model, promptTokens, completionTokens),
                ResponseTimeMs = responseTimeMs,
                Success = success,
                ErrorMessage = error is { Length: > 300 } ? error[..300] : error,
                UsedAt = DateTime.UtcNow,
            };

            _ = Task.Run(async () =>
            {
                try
                {
                    // Solo se cobra lo que salió bien: un 429 del proveedor no le cuesta nada al canal.
                    if (row.Success && row.EstimatedCostUsd > 0 && row.UserId > 0)
                        row.CreditsCharged = await _credits.ChargeAsync(row.UserId, row.Module, row.Model, row.EstimatedCostUsd);

                    using var scope = _scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                    db.AiUsageLogs.Add(row);
                    await db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[AI-USAGE] No se pudo guardar el uso de {Module}/{Model}", row.Module, row.Model);
                }
            });
        }
    }
}
