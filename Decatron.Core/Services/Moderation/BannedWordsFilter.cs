using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Core.Services.Moderation
{
    /// <summary>
    /// Palabras y frases prohibidas. Cada palabra trae su severidad; soporta comodines con *.
    /// </summary>
    public class BannedWordsFilter : IModerationFilter
    {
        public const string FilterKey = "banned_words";
        public string Key => FilterKey;

        private readonly string _connectionString;
        private readonly ILogger<BannedWordsFilter> _logger;

        public BannedWordsFilter(IConfiguration configuration, ILogger<BannedWordsFilter> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
        }

        public async Task<FilterHit?> CheckAsync(ModerationMessage message, ModerationFilter config)
        {
            if (string.IsNullOrWhiteSpace(message.Text))
                return null;

            var words = await GetWordsAsync(message.Channel);
            var messageLower = message.Text.ToLower();

            foreach (var word in words)
            {
                if (!Matches(word.Word.ToLower(), messageLower))
                    continue;

                return new FilterHit
                {
                    FilterKey = FilterKey,
                    Severity = word.Severity,
                    Detail = word.Word,
                    Reason = word.Severity == "severo" ? "Palabra prohibida grave detectada" : "Palabra prohibida detectada",
                    RefId = word.Id
                };
            }

            return null;
        }

        public async Task OnSanctionedAsync(FilterHit hit)
        {
            if (hit.RefId == null) return;
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();
                await using var cmd = new NpgsqlCommand(
                    "UPDATE banned_words SET detections = detections + 1, updated_at = @now WHERE id = @id", conn);
                cmd.Parameters.AddWithValue("id", hit.RefId.Value);
                cmd.Parameters.AddWithValue("now", DateTime.Now);
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error incrementando detecciones de la palabra {Id}", hit.RefId);
            }
        }

        private static bool Matches(string pattern, string messageLower)
        {
            if (!pattern.Contains('*'))
                return messageLower.Contains(pattern);

            // Colapsar comodines consecutivos para evitar backtracking: ***a*** -> *a*
            var sanitized = Regex.Replace(pattern, @"\*+", "*");
            var regex = "^" + Regex.Escape(sanitized).Replace("\\*", ".*") + "$";
            try
            {
                return Regex.IsMatch(messageLower, regex, RegexOptions.Singleline, TimeSpan.FromMilliseconds(100));
            }
            catch (RegexMatchTimeoutException)
            {
                return messageLower.Contains(pattern.Replace("*", ""));
            }
        }

        private async Task<List<BannedWord>> GetWordsAsync(string channel)
        {
            if (ModerationCache.TryGet<List<BannedWord>>(FilterKey, channel, out var cached) && cached != null)
                return cached;

            var words = new List<BannedWord>();
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            // Las más graves primero: si un mensaje tiene dos, gana la severa
            await using var cmd = new NpgsqlCommand(@"
                SELECT id, word, severity FROM banned_words
                WHERE channel_name = @channelName
                ORDER BY CASE severity WHEN 'severo' THEN 0 WHEN 'medio' THEN 1 ELSE 2 END", conn);
            cmd.Parameters.AddWithValue("channelName", channel.ToLower());

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                words.Add(new BannedWord
                {
                    Id = reader.GetInt64(0),
                    Word = reader.GetString(1),
                    Severity = reader.GetString(2)
                });
            }

            ModerationCache.Set(FilterKey, channel, words);
            return words;
        }
    }
}
