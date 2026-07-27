using Decatron.Core.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    /// <summary>Resultado de intentar consumir créditos.</summary>
    public record CreditConsumeResult(
        bool Allowed,
        long CreditsCharged,
        long RemainingAfter,
        string? Reason = null)
    {
        public static CreditConsumeResult Denied(long remaining, string reason) =>
            new(false, 0, remaining, reason);
    }

    /// <summary>
    /// Saldo consolidado de un canal. Las cifras premium son de Polly; las estándar,
    /// de Piper. Van por separado a propósito:
    /// </summary>
    public record CreditBalanceInfo(
        long MonthlyGranted,
        long MonthlyUsed,
        long MonthlyRemaining,
        long PurchasedBalance,
        long TotalAvailable,
        string Tier,
        bool IsUnlimited,
        DateTime MonthlyPeriod,
        bool InTransitionWindow,
        DateTime? TransitionEndsAt,
        long StandardGranted = 0,
        long StandardUsed = 0,
        long StandardRemaining = 0);

    /// <summary>
    /// Punto único de cobro de TTS. Todas las features que generan audio con Polly
    /// deben pasar por aquí antes de llamar a AWS.
    ///
    /// </summary>
    public interface ITtsCreditService
    {
        /// <summary>Créditos que cuesta un texto según el motor. Neural = 4x, etc.</summary>
        long CalculateCost(int chars, string engine);

        /// <summary>
        /// Intenta descontar créditos. Devuelve Allowed=false sin descontar nada si no
        /// alcanza el saldo. Se consume primero la bolsa mensual y luego la comprada.
        /// </summary>
        Task<CreditConsumeResult> TryConsumeAsync(
            long userId, int chars, string engine, string feature,
            string? voice = null, string? language = null);

        /// <summary>Devuelve créditos ya descontados (la síntesis falló después del cobro).</summary>
        Task RefundAsync(long userId, long credits, string feature, string note);

        /// <summary>Registra un acierto de caché: no cuesta nada, pero queda en el historial.</summary>
        Task RecordCacheHitAsync(
            long userId, int chars, string feature, string? voice = null, string? language = null);

        /// <summary>Otorga créditos. Idempotente si se pasa gateway + externalId.</summary>
        Task<bool> GrantAsync(
            long userId, long credits, string type, string bucket,
            string? note = null, long? grantedBy = null,
            string? gateway = null, string? externalId = null);

        /// <summary>
        /// Cobra créditos y genera el audio en una sola operación. Devuelve null si no hay
        /// saldo o si la síntesis falla — el llamante debe caer a su modo sin voz.
        /// Devuelve los créditos automáticamente si falla o si el audio venía del caché.
        ///
        /// Este es el camino que deben usar todas las features: concentra el cobro,
        /// la devolución y el registro en un solo sitio.
        /// </summary>
        /// <param name="provider">
        /// "polly" cobra de los créditos premium y usa AWS. "piper" cobra de la bolsa
        /// estándar y sintetiza en el propio servidor. En ambos casos sale un MP3, así
        /// que el overlay no necesita saber cuál se usó.
        /// </param>
        /// <param name="voice">
        /// La voz del proveedor elegido: un nombre de Polly ("Lupe") o un id de Piper
        /// ("es_MX-claude-high"). El llamante decide según el proveedor.
        /// </param>
        Task<string?> GenerateWithCreditsAsync(
            long userId, string text, string voice, string engine,
            string language, string feature, string? channelName = null,
            string provider = "polly");

        Task<CreditBalanceInfo> GetBalanceAsync(long userId);

        Task<List<TtsCreditLedgerEntry>> GetHistoryAsync(long userId, int limit = 50, int offset = 0);
    }
}
