using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    /// <summary>
    /// Saldo e historial de créditos TTS del canal activo. Lo consumen todas las
    /// pantallas que usan voz: Speak Chat, alertas de eventos, tips y timer.
    /// </summary>
    [ApiController]
    [Route("api/tts-credits")]
    [Authorize]
    public class TtsCreditsController : ControllerBase
    {
        private readonly ITtsCreditService _creditService;
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<TtsCreditsController> _logger;
        private readonly int _sttCreditsPerSecond;

        public TtsCreditsController(
            ITtsCreditService creditService,
            DecatronDbContext dbContext,
            Microsoft.Extensions.Options.IOptions<Decatron.Services.LiveTranslation.LiveTranslationOptions> liveOpts,
            ILogger<TtsCreditsController> logger)
        {
            _creditService = creditService;
            _dbContext = dbContext;
            _sttCreditsPerSecond = liveOpts.Value.SttCreditsPerSecond;
            _logger = logger;
        }

        // GET /api/tts-credits/balance
        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                if (channelOwnerId == 0)
                    return Unauthorized(new { success = false, message = "No se pudo identificar el canal" });

                var balance = await _creditService.GetBalanceAsync(channelOwnerId);
                var tierExpiresAt = await TierResolver.GetTierExpiryAsync(_dbContext, channelOwnerId);

                return Ok(new
                {
                    success = true,
                    tier = balance.Tier,
                    isUnlimited = balance.IsUnlimited,
                    tierExpiresAt,

                    monthlyGranted   = balance.MonthlyGranted,
                    monthlyUsed      = balance.MonthlyUsed,
                    monthlyRemaining = balance.MonthlyRemaining,
                    purchasedBalance = balance.PurchasedBalance,
                    totalAvailable   = balance.TotalAvailable,

                    // Bolsa de voz estándar (Piper). Va aparte de la premium a propósito:
                    //
                    standardGranted   = balance.StandardGranted,
                    standardUsed      = balance.StandardUsed,
                    standardRemaining = balance.StandardRemaining,

                    inTransitionWindow = balance.InTransitionWindow,
                    transitionEndsAt   = balance.TransitionEndsAt,

                    percentage = !balance.IsUnlimited && balance.MonthlyGranted > 0
                        ? (double)balance.MonthlyUsed / balance.MonthlyGranted * 100
                        : 0,

                    standardPercentage = !balance.IsUnlimited && balance.StandardGranted > 0
                        ? (double)balance.StandardUsed / balance.StandardGranted * 100
                        : 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TtsCredits] Error obteniendo saldo");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        /// <summary>
        /// Lo que necesita la página "Créditos" del streamer: saldo, cuánto se gastó en el
        /// período actual por concepto (coach, traducción, alertas…) y las tarifas vigentes
        /// para que el streamer entienda qué le cuesta cada cosa. Plan CREDITOS_UNIFICADOS, fase 3.
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                if (channelOwnerId == 0)
                    return Unauthorized(new { success = false, message = "No se pudo identificar el canal" });

                var balance = await _creditService.GetBalanceAsync(channelOwnerId);
                var tierExpiresAt = await TierResolver.GetTierExpiryAsync(_dbContext, channelOwnerId);
                var periodStart = new DateTimeOffset(balance.MonthlyPeriod, TimeSpan.Zero);
                var since30 = DateTimeOffset.UtcNow.AddDays(-30);

                // Gasto por concepto en el período mensual y en los últimos 30 días (para quien no tiene período).
                var consumed = await _dbContext.TtsCreditLedger.AsNoTracking()
                    .Where(e => e.UserId == channelOwnerId && e.Type == "consume" && e.CreatedAt >= (periodStart < since30 ? periodStart : since30))
                    .GroupBy(e => new { e.Feature, e.Bucket })
                    .Select(g => new { feature = g.Key.Feature ?? "other", bucket = g.Key.Bucket, credits = -g.Sum(e => e.Credits), entries = g.Count() })
                    .ToListAsync();

                var byFeature = consumed.Where(c => c.bucket != "standard")
                    .GroupBy(c => c.feature)
                    .Select(g => new { feature = g.Key, credits = g.Sum(c => c.credits), entries = g.Sum(c => c.entries) })
                    .OrderByDescending(x => x.credits).ToList();
                var standardByFeature = consumed.Where(c => c.bucket == "standard")
                    .GroupBy(c => c.feature)
                    .Select(g => new { feature = g.Key, credits = g.Sum(c => c.credits), entries = g.Sum(c => c.entries) })
                    .OrderByDescending(x => x.credits).ToList();

                return Ok(new
                {
                    success = true,
                    tier = balance.Tier,
                    isUnlimited = balance.IsUnlimited,
                    tierExpiresAt,
                    monthlyGranted = balance.MonthlyGranted,
                    monthlyUsed = balance.MonthlyUsed,
                    monthlyRemaining = balance.MonthlyRemaining,
                    purchasedBalance = balance.PurchasedBalance,
                    totalAvailable = balance.TotalAvailable,
                    monthlyPeriod = balance.MonthlyPeriod,
                    standardGranted = balance.StandardGranted,
                    standardUsed = balance.StandardUsed,
                    standardRemaining = balance.StandardRemaining,
                    inTransitionWindow = balance.InTransitionWindow,
                    transitionEndsAt = balance.TransitionEndsAt,
                    byFeature,
                    standardByFeature,
                    // Tarifas: lo que cuesta cada cosa, para la tabla "cómo se gastan".
                    rates = new
                    {
                        creditUsd = Decatron.Services.AI.AiCreditGate.CreditUsd,
                        sttCreditsPerSecond = _sttCreditsPerSecond,
                        premiumVoicePerChar = new { polly_neural = 4, polly_generative = 8, deepgram_aura = 8, fish = 4 },
                        aiApproxPerCall = new { lol_coach_ai = 40, live_translation_ai = 5, twitch_chat_ai = 25 },
                    },
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TtsCredits] Error obteniendo resumen");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        // GET /api/tts-credits/history?limit=50&offset=0  (o page/pageSize + feature)
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int limit = 50, [FromQuery] int offset = 0,
            [FromQuery] int? page = null, [FromQuery] int? pageSize = null, [FromQuery] string? feature = null, [FromQuery] string? type = null)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                if (channelOwnerId == 0)
                    return Unauthorized(new { success = false, message = "No se pudo identificar el canal" });

                if (page.HasValue) { pageSize = Math.Clamp(pageSize ?? 25, 10, 200); limit = pageSize.Value; offset = (Math.Max(1, page.Value) - 1) * pageSize.Value; }

                var q = _dbContext.TtsCreditLedger.AsNoTracking().Where(e => e.UserId == channelOwnerId);
                if (!string.IsNullOrWhiteSpace(feature)) q = q.Where(e => e.Feature == feature);
                if (!string.IsNullOrWhiteSpace(type)) q = q.Where(e => e.Type == type);
                var total = await q.CountAsync();
                var entries = await q.OrderByDescending(e => e.CreatedAt).ThenByDescending(e => e.Id).Skip(Math.Max(0, offset)).Take(Math.Clamp(limit, 1, 200)).ToListAsync();
                var features = await _dbContext.TtsCreditLedger.AsNoTracking().Where(e => e.UserId == channelOwnerId && e.Feature != null).Select(e => e.Feature!).Distinct().OrderBy(f => f).ToListAsync();

                return Ok(new
                {
                    success = true,
                    total,
                    page = page ?? (offset / Math.Max(1, limit)) + 1,
                    pageSize = limit,
                    totalPages = (int)Math.Ceiling(total / (double)Math.Max(1, limit)),
                    features,
                    entries = entries.Select(e => new
                    {
                        id = e.Id,
                        createdAt = e.CreatedAt,
                        type = e.Type,
                        credits = e.Credits,
                        bucket = e.Bucket,
                        feature = e.Feature,
                        engine = e.Engine,
                        chars = e.Chars,
                        voice = e.Voice,
                        language = e.Language,
                        note = e.Note
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TtsCredits] Error obteniendo historial");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
                return channelOwnerId;

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }
}
