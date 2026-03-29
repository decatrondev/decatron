using Amazon.Polly;
using Amazon.Polly.Model;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public class TtsService : ITtsService
    {
        private readonly AmazonPollyClient _pollyClient;
        private readonly DecatronDbContext _context;
        private readonly ILogger<TtsService> _logger;
        private readonly string _cachePath;
        private readonly string _publicUrlBase;

        public TtsService(
            AmazonPollyClient pollyClient,
            DecatronDbContext context,
            ILogger<TtsService> logger,
            IOptions<AwsPollySettings> settings)
        {
            _pollyClient = pollyClient;
            _context = context;
            _logger = logger;
            _cachePath = settings.Value.CachePath;
            // Public URL served via nginx or static file middleware
            _publicUrlBase = "/tts-audio";
        }

        public async Task<string?> GenerateAsync(string text, string voiceId, string engine, string languageCode, string? channelName = null)
        {
            if (string.IsNullOrWhiteSpace(text))
                return null;

            // Normalize text
            var normalizedText = text.Trim().ToLowerInvariant();

            // Compute hash: SHA256(voice:engine:language:normalizedText)
            var hashInput = $"{voiceId}:{engine}:{languageCode}:{normalizedText}";
            var hash = ComputeHash(hashInput);

            // Check DB cache
            var cached = await _context.TtsCacheEntries
                .FirstOrDefaultAsync(e => e.Hash == hash);

            if (cached != null && File.Exists(cached.FilePath))
            {
                // Update usage stats
                cached.LastUsedAt = DateTime.UtcNow;
                cached.UsageCount++;
                await _context.SaveChangesAsync();

                _logger.LogInformation("[TTS] Cache hit for hash {Hash}", hash);
                return BuildPublicUrl(cached.FilePath);
            }

            // Cache miss - call Polly
            try
            {
                var engineEnum = engine.Equals("neural", StringComparison.OrdinalIgnoreCase)
                    ? Engine.Neural
                    : Engine.Standard;

                var request = new SynthesizeSpeechRequest
                {
                    Text = text,
                    VoiceId = new VoiceId(voiceId),
                    Engine = engineEnum,
                    LanguageCode = languageCode,
                    OutputFormat = OutputFormat.Mp3
                };

                var response = await _pollyClient.SynthesizeSpeechAsync(request);

                // Build file path: cachePath/channelName/voiceId/engine/hash.mp3
                // Sanitize channelName to prevent path traversal
                var safeChannel = System.Text.RegularExpressions.Regex.Replace(channelName ?? "", @"[^a-zA-Z0-9_]", "");
                var dir = string.IsNullOrEmpty(safeChannel)
                    ? Path.Combine(_cachePath, voiceId, engine)
                    : Path.Combine(_cachePath, safeChannel, voiceId, engine);
                Directory.CreateDirectory(dir);
                var filePath = Path.Combine(dir, $"{hash}.mp3");

                using (var fileStream = File.Create(filePath))
                {
                    await response.AudioStream.CopyToAsync(fileStream);
                }

                var fileSize = new FileInfo(filePath).Length;

                // Save to DB (upsert)
                if (cached != null)
                {
                    // File was missing but DB entry existed — update
                    cached.FilePath = filePath;
                    cached.FileSizeBytes = fileSize;
                    cached.LastUsedAt = DateTime.UtcNow;
                    cached.UsageCount++;
                }
                else
                {
                    var entry = new TtsCacheEntry
                    {
                        Hash = hash,
                        VoiceId = voiceId,
                        Engine = engine,
                        LanguageCode = languageCode,
                        TextContent = text,
                        FilePath = filePath,
                        FileSizeBytes = fileSize,
                        CreatedAt = DateTime.UtcNow,
                        LastUsedAt = DateTime.UtcNow,
                        UsageCount = 1
                    };
                    _context.TtsCacheEntries.Add(entry);
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation("[TTS] Generated audio for voice {Voice} ({Engine}), size {Size} bytes", voiceId, engine, fileSize);
                return BuildPublicUrl(filePath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TTS] Failed to generate audio via Polly for voice {Voice}", voiceId);
                return null;
            }
        }

        private static string ComputeHash(string input)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private string BuildPublicUrl(string filePath)
        {
            // Convert absolute path to relative public URL
            // /var/www/html/decatron/tts-cache/Lupe/standard/hash.mp3
            // -> /tts-audio/Lupe/standard/hash.mp3
            var relativePath = filePath.Replace(_cachePath, string.Empty)
                                       .Replace('\\', '/')
                                       .TrimStart('/');
            return $"{_publicUrlBase}/{relativePath}";
        }
    }
}
