using Microsoft.AspNetCore.Mvc;
using Decatron.Core.Models.Gacha;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/gacha/public")]
    public class GachaPublicController : ControllerBase
    {
        private readonly DecatronDbContext _context;

        public GachaPublicController(DecatronDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Public collection data for a viewer on a channel
        /// </summary>
        [HttpGet("collection")]
        public async Task<IActionResult> GetCollection([FromQuery] string channel, [FromQuery] string user)
        {
            if (string.IsNullOrWhiteSpace(channel) || string.IsNullOrWhiteSpace(user))
                return BadRequest(new { success = false, message = "channel and user are required" });

            var channelName = channel.ToLower().Trim();
            var userName = user.ToLower().Trim();

            // Check privacy settings
            var viewerSettings = await _context.GachaViewerSettings
                .FirstOrDefaultAsync(s => s.TwitchUsername == userName);

            if (viewerSettings != null)
            {
                var isPrivateGlobal = !viewerSettings.CollectionsPublic;
                var privateChannels = System.Text.Json.JsonSerializer.Deserialize<List<string>>(viewerSettings.PrivateChannelsJson ?? "[]") ?? new();
                var isPrivateChannel = privateChannels.Contains(channelName);

                if (isPrivateGlobal || isPrivateChannel)
                {
                    return Ok(new
                    {
                        success = true,
                        isPrivate = true,
                        channelName,
                        userName,
                        message = "Esta coleccion es privada"
                    });
                }
            }

            // Get active banner
            var banner = await _context.GachaBanners
                .Where(b => b.ChannelName == channelName && b.IsActive)
                .Select(b => b.BannerUrl)
                .FirstOrDefaultAsync();

            // Get participant
            var participant = await _context.GachaParticipants
                .FirstOrDefaultAsync(p => p.ChannelName == channelName && p.Name == userName);

            if (participant == null)
            {
                // Return empty collection
                var totalItems = await _context.GachaItems.CountAsync(i => i.ChannelName == channelName && i.Available);
                return Ok(new
                {
                    success = true,
                    channelName,
                    userName,
                    banner,
                    participant = (object?)null,
                    stats = new { uniqueCards = 0, totalCards = 0, totalAvailable = totalItems, pullsUsed = 0, totalDonated = 0m, byRarity = new Dictionary<string, int>() },
                    inventory = Array.Empty<object>(),
                    history = Array.Empty<object>(),
                    progress = Array.Empty<object>()
                });
            }

            // Stats
            var inventory = await _context.GachaInventories
                .Include(i => i.Item)
                .Where(i => i.ChannelName == channelName && i.ParticipantId == participant.Id)
                .OrderByDescending(i => i.LastWonAt)
                .ToListAsync();

            var totalAvailable = await _context.GachaItems.CountAsync(i => i.ChannelName == channelName && i.Available);

            var byRarity = inventory
                .Where(i => i.Item != null)
                .GroupBy(i => i.Item!.Rarity)
                .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

            var stats = new
            {
                uniqueCards = inventory.Select(i => i.ItemId).Distinct().Count(),
                totalCards = inventory.Sum(i => i.Quantity),
                totalAvailable,
                pullsUsed = participant.Pulls,
                totalDonated = participant.DonationAmount,
                byRarity
            };

            // Inventory cards
            var cards = inventory.Select(i => new
            {
                id = i.Id,
                itemId = i.ItemId,
                name = i.Item?.Name ?? $"Item #{i.ItemId}",
                rarity = i.Item?.Rarity ?? "common",
                image = i.Item?.Image,
                quantity = i.Quantity,
                isRedeemed = i.IsRedeemed,
                lastWonAt = i.LastWonAt
            }).ToList();

            // Recent history
            var history = await _context.GachaPullLogs
                .Include(l => l.Item)
                .Where(l => l.ChannelName == channelName && l.ParticipantId == participant.Id)
                .OrderByDescending(l => l.OccurredAt)
                .Take(30)
                .Select(l => new
                {
                    id = l.Id,
                    itemName = l.Item != null ? l.Item.Name : $"Item #{l.ItemId}",
                    rarity = l.Item != null ? l.Item.Rarity : "common",
                    image = l.Item != null ? l.Item.Image : null,
                    occurredAt = l.OccurredAt
                })
                .ToListAsync();

            // Progress by rarity
            var allItemsByRarity = await _context.GachaItems
                .Where(i => i.ChannelName == channelName && i.Available)
                .GroupBy(i => i.Rarity)
                .Select(g => new { rarity = g.Key, total = g.Count() })
                .ToListAsync();

            var ownedByRarity = inventory
                .Where(i => i.Item != null)
                .Select(i => i.Item!.Rarity + "_" + i.ItemId)
                .Distinct()
                .GroupBy(x => x.Split('_')[0])
                .ToDictionary(g => g.Key, g => g.Count());

            var progress = allItemsByRarity.Select(r => new
            {
                rarity = r.rarity,
                owned = ownedByRarity.GetValueOrDefault(r.rarity, 0),
                total = r.total,
                percentage = r.total > 0 ? Math.Round((double)ownedByRarity.GetValueOrDefault(r.rarity, 0) / r.total * 100, 1) : 0
            }).ToList();

            return Ok(new
            {
                success = true,
                channelName,
                userName,
                banner,
                participant = new { participant.Name, participant.DonationAmount, participant.Pulls, participant.EffectiveDonation },
                stats,
                inventory = cards,
                history,
                progress
            });
        }
    }
}
