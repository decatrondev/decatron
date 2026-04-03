using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Services;

/// <summary>
/// Background service that checks for expired store purchases every 2 minutes
/// and revokes temporary roles/channel access.
/// </summary>
public class StoreExpirationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly DiscordClientProvider _clientProvider;
    private readonly ILogger<StoreExpirationService> _logger;
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(2);

    public StoreExpirationService(
        IServiceProvider serviceProvider,
        DiscordClientProvider clientProvider,
        ILogger<StoreExpirationService> logger)
    {
        _serviceProvider = serviceProvider;
        _clientProvider = clientProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait for bot to connect
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        _logger.LogInformation("[STORE-EXPIRY] Store expiration service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessExpiredPurchases();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[STORE-EXPIRY] Error processing expired purchases");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    private async Task ProcessExpiredPurchases()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        // Find active purchases that have expired
        var expired = await db.XpStorePurchases
            .Where(p => p.IsActive && p.ExpiresAt != null && p.ExpiresAt <= DateTime.UtcNow)
            .ToListAsync();

        if (expired.Count == 0) return;

        var client = _clientProvider.Client;

        foreach (var purchase in expired)
        {
            try
            {
                // Get the item to know what type it is
                var item = await db.XpStoreItems.FindAsync(purchase.ItemId);
                if (item == null)
                {
                    purchase.IsActive = false;
                    continue;
                }

                if (!ulong.TryParse(purchase.GuildId, out var guildUlong) || !client.Guilds.TryGetValue(guildUlong, out var guild))
                {
                    purchase.IsActive = false;
                    continue;
                }

                if (!ulong.TryParse(purchase.UserId, out var userUlong))
                {
                    purchase.IsActive = false;
                    continue;
                }

                switch (item.ItemType)
                {
                    case "role_temp":
                        if (!string.IsNullOrEmpty(item.RoleId) && ulong.TryParse(item.RoleId, out var roleUlong))
                        {
                            try
                            {
                                var member = await guild.GetMemberAsync(userUlong);
                                var role = guild.GetRole(roleUlong);
                                if (role != null)
                                {
                                    await member.RevokeRoleAsync(role, "Decatron Store — Temporary role expired");
                                    _logger.LogInformation("[STORE-EXPIRY] Revoked role '{Role}' from {User} in {Guild}",
                                        role.Name, purchase.Username, guild.Name);
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "[STORE-EXPIRY] Could not revoke role for {User}", purchase.Username);
                            }
                        }
                        break;

                    case "channel_access":
                        if (!string.IsNullOrEmpty(item.ChannelId) && ulong.TryParse(item.ChannelId, out var channelUlong))
                        {
                            try
                            {
                                var channel = guild.GetChannel(channelUlong);
                                var member = await guild.GetMemberAsync(userUlong);
                                if (channel != null)
                                {
                                    await channel.AddOverwriteAsync(member,
                                        deny: DSharpPlus.Permissions.AccessChannels | DSharpPlus.Permissions.SendMessages,
                                        reason: "Decatron Store — Channel access expired");
                                    _logger.LogInformation("[STORE-EXPIRY] Revoked channel access for {User} in {Channel}",
                                        purchase.Username, channel.Name);
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "[STORE-EXPIRY] Could not revoke channel access for {User}", purchase.Username);
                            }
                        }
                        break;
                }

                purchase.IsActive = false;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[STORE-EXPIRY] Error processing expired purchase {Id}", purchase.Id);
                purchase.IsActive = false;
            }
        }

        await db.SaveChangesAsync();
        if (expired.Count > 0)
            _logger.LogInformation("[STORE-EXPIRY] Processed {Count} expired purchases", expired.Count);
    }
}
