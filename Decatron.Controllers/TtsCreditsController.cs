using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

        public TtsCreditsController(
            ITtsCreditService creditService,
            DecatronDbContext dbContext,
            ILogger<TtsCreditsController> logger)
        {
            _creditService = creditService;
            _dbContext = dbContext;
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

        // GET /api/tts-credits/history?limit=50&offset=0
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int limit = 50, [FromQuery] int offset = 0)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                if (channelOwnerId == 0)
                    return Unauthorized(new { success = false, message = "No se pudo identificar el canal" });

                var entries = await _creditService.GetHistoryAsync(channelOwnerId, limit, offset);

                return Ok(new
                {
                    success = true,
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
