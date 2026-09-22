using System;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.AI
{
    /// <summary>
    /// La IA se paga con los mismos créditos que la voz: cada llamada a un LLM descuenta
    /// su costo real convertido a créditos (1 crédito = <see cref="CreditUsd"/>, el ancla
    /// de Polly estándar). Antes de llamar se mira si el canal tiene saldo; después, se
    /// cobra lo que costó (hasta dejar el saldo en cero, nunca en negativo). Sin canal
    /// (userId 0: pruebas, tareas del sistema) no se cobra.
    /// Plan: .dev/plans/CREDITOS_UNIFICADOS_PLAN.md
    /// </summary>
    public class AiCreditGate
    {
        /// <summary>Dólares que vale un crédito: $4 por millón de caracteres de Polly estándar.</summary>
        public const decimal CreditUsd = 0.000004m;
        public const string Engine = "ai";

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<AiCreditGate> _logger;

        public AiCreditGate(IServiceScopeFactory scopes, ILogger<AiCreditGate> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        public static long CreditsFor(decimal usd) => usd <= 0 ? 0 : (long)Math.Ceiling(usd / CreditUsd);

        /// <summary>Nombre con el que queda en el historial de créditos del canal.</summary>
        public static string FeatureFor(string module) => module switch
        {
            "lol-coach" => "lol_coach_ai",
            "translation" => "live_translation_ai",
            "twitch-chat" => "twitch_chat_ai",
            "web-chat" => "decatron_chat_ai",
            _ => module.Replace('-', '_') + "_ai",
        };

        /// <summary>true si el canal puede llamar a la IA ahora (tier sin límite o saldo mayor que cero).</summary>
        public async Task<bool> HasCreditsAsync(long userId)
        {
            if (userId <= 0) return true;
            try
            {
                using var scope = _scopes.CreateScope();
                var credits = scope.ServiceProvider.GetRequiredService<ITtsCreditService>();
                var b = await credits.GetBalanceAsync(userId);
                return b.IsUnlimited || b.TotalAvailable > 0;
            }
            catch (Exception ex)
            {
                // Si el saldo no se puede leer, mejor dejar pasar y cobrar después que dejar mudo al canal.
                _logger.LogWarning(ex, "[AiCredits] No se pudo leer el saldo de {UserId}", userId);
                return true;
            }
        }

        /// <summary>Descuenta el costo de una llamada ya hecha. Devuelve los créditos cobrados.</summary>
        public async Task<long> ChargeAsync(long userId, string module, string model, decimal costUsd)
        {
            var credits = CreditsFor(costUsd);
            if (userId <= 0 || credits == 0) return 0;
            try
            {
                using var scope = _scopes.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<ITtsCreditService>();
                var r = await svc.TryConsumeAsync(userId, (int)Math.Min(credits, int.MaxValue), Engine, FeatureFor(module), voice: model, allowPartial: true);
                if (!r.Allowed) _logger.LogInformation("[AiCredits] {UserId} sin saldo para {Module} ({Credits} cr)", userId, module, credits);
                return r.CreditsCharged;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AiCredits] No se pudo cobrar {Credits} cr a {UserId} por {Module}", credits, userId, module);
                return 0;
            }
        }
    }
}
