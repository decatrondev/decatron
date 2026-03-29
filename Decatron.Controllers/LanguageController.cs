using Decatron.Controllers.Dtos;
using Decatron.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LanguageController : ControllerBase
    {
        private readonly ILanguageService _languageService;
        private readonly ILogger<LanguageController> _logger;

        public LanguageController(ILanguageService languageService, ILogger<LanguageController> logger)
        {
            _languageService = languageService;
            _logger = logger;
        }

        /// <summary>
        /// Gets the current user's preferred language
        /// </summary>
        /// <returns>Language preference or null if not set</returns>
        [HttpGet]
        public async Task<ActionResult<LanguageDto>> GetUserLanguage()
        {
            try
            {
                var userId = GetUserIdFromClaims();
                if (userId == null)
                {
                    return Unauthorized(new { errorCode = "UNAUTHORIZED", message = "User not authenticated" });
                }

                var language = await _languageService.GetUserLanguageAsync(userId.Value);

                return Ok(new LanguageDto { Language = language });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user language");
                return StatusCode(500, new { errorCode = "INTERNAL_ERROR", message = "Error retrieving language preference" });
            }
        }

        /// <summary>
        /// Updates the current user's preferred language
        /// </summary>
        /// <param name="dto">Language update request</param>
        /// <returns>Updated language preference</returns>
        [HttpPut]
        public async Task<ActionResult<UpdateLanguageResponseDto>> UpdateUserLanguage([FromBody] UpdateLanguageDto dto)
        {
            try
            {
                var userId = GetUserIdFromClaims();
                if (userId == null)
                {
                    return Unauthorized(new { errorCode = "UNAUTHORIZED", message = "User not authenticated" });
                }

                // Validate input
                if (string.IsNullOrWhiteSpace(dto.Language))
                {
                    return BadRequest(new { errorCode = "INVALID_LANGUAGE", message = "Language cannot be empty" });
                }

                // Check if language is supported
                if (!_languageService.IsLanguageSupported(dto.Language))
                {
                    var supportedLanguages = _languageService.GetSupportedLanguages();
                    return BadRequest(new
                    {
                        errorCode = "INVALID_LANGUAGE",
                        message = $"Language '{dto.Language}' is not supported",
                        supportedLanguages
                    });
                }

                var success = await _languageService.UpdateUserLanguageAsync(userId.Value, dto.Language);

                if (!success)
                {
                    return StatusCode(500, new { errorCode = "UPDATE_FAILED", message = "Failed to update language preference" });
                }

                return Ok(new UpdateLanguageResponseDto
                {
                    Language = dto.Language.ToLowerInvariant(),
                    Updated = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user language");
                return StatusCode(500, new { errorCode = "INTERNAL_ERROR", message = "Error updating language preference" });
            }
        }

        /// <summary>
        /// Gets the list of supported languages
        /// </summary>
        /// <returns>List of supported language codes</returns>
        [HttpGet("supported")]
        [AllowAnonymous]
        public ActionResult<List<string>> GetSupportedLanguages()
        {
            var languages = _languageService.GetSupportedLanguages();
            return Ok(languages);
        }

        private long? GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }
            return null;
        }
    }
}
