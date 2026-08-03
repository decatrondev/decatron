using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace Decatron.Services
{
    public class UsernameCheckBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<UsernameCheckBackgroundService> _logger;
        private readonly TwitchSettings _twitchSettings;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(12);

        public UsernameCheckBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<UsernameCheckBackgroundService> logger,
            IOptions<TwitchSettings> twitchSettings)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _twitchSettings = twitchSettings.Value;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Username Check Background Service is starting");

            // Run on startup after a short delay (let the bot connect first)
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAllUsernamesAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during periodic username check");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }

            _logger.LogInformation("Username Check Background Service is stopping");
        }

        private async Task CheckAllUsernamesAsync(CancellationToken ct)
        {
            using var scope = _serviceProvider.CreateScope();
            var usernameUpdateService = scope.ServiceProvider.GetRequiredService<UsernameUpdateService>();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            // Get all active users with TwitchId
            var users = await db.Users
                .Where(u => u.IsActive && u.TwitchId != null && u.TwitchId != "")
                .Select(u => new { u.Id, u.TwitchId, u.Login })
                .ToListAsync(ct);

            if (users.Count == 0)
            {
                _logger.LogInformation("No active users to check");
                return;
            }

            _logger.LogWarning("🔍 [USERNAME CHECK] Checking usernames for {Count} active users", users.Count);

            // Get app access token
            var appToken = await GetAppAccessTokenAsync(ct);
            if (appToken == null)
            {
                _logger.LogError("🔍 [USERNAME CHECK] Could not obtain app access token — aborting check");
                return;
            }
            _logger.LogInformation("🔍 [USERNAME CHECK] App token obtained, starting batch checks");

            int changesDetected = 0;
            int changesFailed = 0;

            // Process in batches of 100 (Twitch API limit)
            foreach (var batch in users.Chunk(100))
            {
                ct.ThrowIfCancellationRequested();

                List<TwitchUserInfo> twitchUsers;
                try
                {
                    var twitchIds = batch.Select(u => u.TwitchId).ToList();
                    twitchUsers = await GetTwitchUsersByIdsAsync(twitchIds, appToken, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error fetching username batch from Twitch");
                    continue;
                }

                foreach (var user in batch)
                {
                    var twitchUser = twitchUsers.FirstOrDefault(t => t.Id == user.TwitchId);
                    if (twitchUser == null)
                    {
                        _logger.LogWarning("Twitch user {TwitchId} ({Login}) not found via API — account may be suspended/deleted",
                            user.TwitchId, user.Login);
                        continue;
                    }

                    var newLogin = twitchUser.Login.ToLower();
                    if (user.Login.Equals(newLogin, StringComparison.OrdinalIgnoreCase))
                        continue;

                    // One user failing must not stop the rest of the batch from being checked
                    try
                    {
                        var changed = await usernameUpdateService.DetectAndPropagateAsync(
                            user.Id, user.Login, newLogin,
                            detectedBy: "periodic_sync",
                            updateUserTable: true);

                        if (changed) changesDetected++;
                    }
                    catch (Exception ex)
                    {
                        changesFailed++;
                        _logger.LogError(ex, "Failed to apply username change for user {UserId} ({OldLogin} → {NewLogin})",
                            user.Id, user.Login, newLogin);
                    }
                }

                // Respect rate limits
                await Task.Delay(100, ct);
            }

            if (changesFailed > 0)
            {
                _logger.LogError("🔍 [USERNAME CHECK] Complete. Changes applied: {Changes}/{Total}, FAILED: {Failed}",
                    changesDetected, users.Count, changesFailed);
            }
            else
            {
                _logger.LogWarning("🔍 [USERNAME CHECK] Complete. Changes applied: {Changes}/{Total}",
                    changesDetected, users.Count);
            }
        }

        private async Task<string?> GetAppAccessTokenAsync(CancellationToken ct)
        {
            try
            {
                using var httpClient = new HttpClient();
                var url = $"https://id.twitch.tv/oauth2/token?client_id={_twitchSettings.ClientId}&client_secret={_twitchSettings.ClientSecret}&grant_type=client_credentials";
                _logger.LogInformation("Requesting app access token (ClientId: {ClientId})", _twitchSettings.ClientId?[..6] + "...");
                var response = await httpClient.PostAsync(url, new StringContent(""), ct);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogError("Failed to get app access token: {Status} - {Body}", response.StatusCode, errorBody);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync(ct);
                var result = JsonSerializer.Deserialize<JsonElement>(json);

                if (result.TryGetProperty("access_token", out var token))
                    return token.GetString();

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting app access token");
                return null;
            }
        }

        private async Task<List<TwitchUserInfo>> GetTwitchUsersByIdsAsync(List<string> twitchIds, string appToken, CancellationToken ct)
        {
            var result = new List<TwitchUserInfo>();

            try
            {
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {appToken}");
                httpClient.DefaultRequestHeaders.Add("Client-Id", _twitchSettings.ClientId);

                var queryParams = string.Join("&", twitchIds.Select(id => $"id={id}"));
                var response = await httpClient.GetAsync($"https://api.twitch.tv/helix/users?{queryParams}", ct);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Twitch API error checking users: {StatusCode}", response.StatusCode);
                    return result;
                }

                var json = await response.Content.ReadAsStringAsync(ct);
                var data = JsonSerializer.Deserialize<JsonElement>(json);

                if (data.TryGetProperty("data", out var usersArray))
                {
                    foreach (var user in usersArray.EnumerateArray())
                    {
                        result.Add(new TwitchUserInfo
                        {
                            Id = user.GetProperty("id").GetString() ?? "",
                            Login = user.GetProperty("login").GetString() ?? "",
                            DisplayName = user.GetProperty("display_name").GetString() ?? ""
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching Twitch users by IDs");
            }

            return result;
        }

        private class TwitchUserInfo
        {
            public string Id { get; set; } = "";
            public string Login { get; set; } = "";
            public string DisplayName { get; set; } = "";
        }
    }
}
