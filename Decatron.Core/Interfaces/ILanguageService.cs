namespace Decatron.Core.Interfaces
{
    public interface ILanguageService
    {
        /// <summary>
        /// Gets the preferred language for a user
        /// </summary>
        /// <param name="userId">User ID (internal database ID)</param>
        /// <returns>Language code (e.g., "es", "en") or null if not set</returns>
        Task<string?> GetUserLanguageAsync(long userId);

        /// <summary>
        /// Gets the preferred language for a user by their Twitch ID
        /// </summary>
        /// <param name="twitchId">Twitch user ID</param>
        /// <returns>Language code (e.g., "es", "en") or null if not set</returns>
        Task<string?> GetUserLanguageByTwitchIdAsync(string twitchId);

        /// <summary>
        /// Updates the preferred language for a user
        /// </summary>
        /// <param name="userId">User ID</param>
        /// <param name="language">Language code (e.g., "es", "en")</param>
        /// <returns>True if updated successfully, false otherwise</returns>
        Task<bool> UpdateUserLanguageAsync(long userId, string language);

        /// <summary>
        /// Parses the Accept-Language header to extract the primary language
        /// </summary>
        /// <param name="acceptLanguageHeader">Accept-Language header value</param>
        /// <returns>Primary language code (e.g., "es", "en")</returns>
        string ParseAcceptLanguageHeader(string acceptLanguageHeader);

        /// <summary>
        /// Checks if a language code is supported
        /// </summary>
        /// <param name="language">Language code to check</param>
        /// <returns>True if supported, false otherwise</returns>
        bool IsLanguageSupported(string language);

        /// <summary>
        /// Gets the list of supported language codes
        /// </summary>
        /// <returns>List of supported language codes</returns>
        List<string> GetSupportedLanguages();
    }
}
