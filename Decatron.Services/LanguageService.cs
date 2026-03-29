using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class LanguageService : ILanguageService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<LanguageService> _logger;

        // Supported languages (ISO 639-1 codes)
        private static readonly List<string> SupportedLanguages = new() { "es", "en" };
        private const string DefaultLanguage = "es";
        private const string FallbackLanguage = "en";

        public LanguageService(DecatronDbContext context, ILogger<LanguageService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<string?> GetUserLanguageAsync(long userId)
        {
            try
            {
                var user = await _context.Users.FindAsync(userId);
                return user?.PreferredLanguage;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting language for user {UserId}", userId);
                return null;
            }
        }

        public async Task<string?> GetUserLanguageByTwitchIdAsync(string twitchId)
        {
            try
            {
                if (string.IsNullOrEmpty(twitchId))
                {
                    return null;
                }

                var user = await _context.Users
                    .Where(u => u.TwitchId == twitchId)
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();

                return user;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting language for Twitch user {TwitchId}", twitchId);
                return null;
            }
        }

        public async Task<bool> UpdateUserLanguageAsync(long userId, string language)
        {
            try
            {
                // Validate language
                if (string.IsNullOrWhiteSpace(language) || !IsLanguageSupported(language))
                {
                    _logger.LogWarning("Invalid language '{Language}' for user {UserId}", language, userId);
                    return false;
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                {
                    _logger.LogWarning("User {UserId} not found", userId);
                    return false;
                }

                user.PreferredLanguage = language.ToLowerInvariant();
                user.LanguagePreferenceUpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Updated language to '{Language}' for user {UserId}", language, userId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating language for user {UserId}", userId);
                return false;
            }
        }

        public string ParseAcceptLanguageHeader(string acceptLanguageHeader)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(acceptLanguageHeader))
                {
                    return DefaultLanguage;
                }

                // Accept-Language format: "es-MX,es;q=0.9,en;q=0.8"
                // We want the first language code
                var languages = acceptLanguageHeader
                    .Split(',')
                    .Select(lang => lang.Split(';')[0].Trim())
                    .Select(lang => lang.Split('-')[0].ToLowerInvariant()) // Extract base language (es-MX -> es)
                    .Where(lang => !string.IsNullOrWhiteSpace(lang))
                    .ToList();

                // Find the first supported language
                foreach (var lang in languages)
                {
                    if (IsLanguageSupported(lang))
                    {
                        return lang;
                    }
                }

                // If no supported language found, return fallback (English for international users)
                _logger.LogInformation("No supported language found in '{Header}', using fallback '{Fallback}'",
                    acceptLanguageHeader, FallbackLanguage);
                return FallbackLanguage;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing Accept-Language header '{Header}'", acceptLanguageHeader);
                return DefaultLanguage;
            }
        }

        public bool IsLanguageSupported(string language)
        {
            if (string.IsNullOrWhiteSpace(language))
                return false;

            return SupportedLanguages.Contains(language.ToLowerInvariant());
        }

        public List<string> GetSupportedLanguages()
        {
            return new List<string>(SupportedLanguages);
        }
    }
}
