using Decatron.Core.Models.Gacha;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;

namespace Decatron.Services
{
    public interface IGachaService
    {
        // Items CRUD
        Task<List<GachaItem>> GetItemsAsync(string channelName);
        Task<GachaItem> CreateItemAsync(GachaItem item);
        Task<GachaItem> UpdateItemAsync(GachaItem item);
        Task DeleteItemAsync(int id, string channelName);

        // Restrictions CRUD
        Task<List<GachaItemRestriction>> GetRestrictionsAsync(string channelName);
        Task<GachaItemRestriction> CreateRestrictionAsync(GachaItemRestriction restriction);
        Task<GachaItemRestriction> UpdateRestrictionAsync(GachaItemRestriction restriction);
        Task DeleteRestrictionAsync(int id, string channelName);

        // Preferences CRUD
        Task<List<GachaPreference>> GetPreferencesAsync(string channelName);
        Task<GachaPreference> CreatePreferenceAsync(GachaPreference preference);
        Task<GachaPreference> UpdatePreferenceAsync(GachaPreference preference);
        Task DeletePreferenceAsync(int id, string channelName);

        // Rarity Config
        Task<List<GachaRarityConfig>> GetRarityConfigsAsync(string channelName);
        Task UpdateRarityConfigsAsync(string channelName, List<GachaRarityConfig> configs);

        // Rarity Restrictions
        Task<List<GachaRarityRestriction>> GetRarityRestrictionsAsync(string channelName);
        Task<GachaRarityRestriction> CreateRarityRestrictionAsync(GachaRarityRestriction restriction);
        Task<GachaRarityRestriction> UpdateRarityRestrictionAsync(GachaRarityRestriction restriction);
        Task DeleteRarityRestrictionAsync(int id, string channelName);

        // Banners
        Task<List<GachaBanner>> GetBannersAsync(string channelName);
        Task<GachaBanner> CreateBannerAsync(GachaBanner banner);
        Task SetActiveBannerAsync(int id, string channelName);
        Task DeleteBannerAsync(int id, string channelName);

        // Overlay Config
        Task<GachaOverlayConfig?> GetOverlayConfigAsync(string channelName);
        Task<GachaOverlayConfig> SaveOverlayConfigAsync(GachaOverlayConfig config);

        // Integration Config
        Task<GachaIntegrationConfig?> GetIntegrationConfigAsync(string channelName);
        Task<GachaIntegrationConfig> SaveIntegrationConfigAsync(GachaIntegrationConfig config);
        Task ProcessTipDonationAsync(string channelName, string donorName, decimal amount, string currency);
        Task ProcessBitsEventAsync(string channelName, string username, int bitsAmount);
        Task ProcessSubEventAsync(string channelName, string username, string tier);
        Task ProcessGiftSubEventAsync(string channelName, string gifterUsername, int giftCount);

        // Participants
        Task<List<GachaParticipant>> GetParticipantsAsync(string channelName);
        Task<GachaParticipant?> GetParticipantByNameAsync(string channelName, string name);
        Task<GachaParticipant> AddDonationAsync(string channelName, string participantName, decimal amount, string? twitchUserId = null);

        // Core Pull Logic
        Task<GachaPullResult> PerformPullAsync(string channelName, int participantId);

        // Collection/Inventory
        Task<List<GachaInventory>> GetInventoryAsync(string channelName, int participantId);
        Task<GachaCollectionStats> GetCollectionStatsAsync(string channelName, int participantId);
        Task RedeemItemAsync(int inventoryId, string channelName);

        // Pull Logs
        Task<List<GachaPullLog>> GetPullLogsAsync(string channelName, int participantId, int limit = 50);

        // Achievements
        Task<List<object>> GetAchievementsForParticipantAsync(int participantId);
        Task CheckAndUnlockAchievementsAsync(string channelName, int participantId);

        // Showcase
        Task<List<GachaShowcase>> GetShowcaseAsync(int participantId);
        Task SetShowcaseAsync(int participantId, List<int> itemIds);

        // Wishlist
        Task<List<GachaWishlist>> GetWishlistAsync(int participantId);
        Task AddToWishlistAsync(int participantId, int itemId);
        Task RemoveFromWishlistAsync(int participantId, int itemId);

        // Advanced Stats
        Task<object> GetAdvancedStatsAsync(string channelName, int participantId);
    }

    public class GachaService : IGachaService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<GachaService> _logger;

        private static readonly Dictionary<string, decimal> DefaultProbabilities = new()
        {
            { "common", 50.00m },
            { "uncommon", 25.00m },
            { "rare", 15.00m },
            { "epic", 7.00m },
            { "legendary", 3.00m }
        };

        private readonly OverlayNotificationService? _overlayService;

        public GachaService(DecatronDbContext context, ILogger<GachaService> logger, OverlayNotificationService? overlayService = null)
        {
            _context = context;
            _overlayService = overlayService;
            _logger = logger;
        }

        // ========================================================================
        // ITEMS CRUD
        // ========================================================================

        public async Task<List<GachaItem>> GetItemsAsync(string channelName)
        {
            return await _context.GachaItems
                .Where(i => i.ChannelName == channelName)
                .OrderBy(i => i.Name)
                .ToListAsync();
        }

        public async Task<GachaItem> CreateItemAsync(GachaItem item)
        {
            item.CreatedAt = DateTime.UtcNow;
            item.UpdatedAt = DateTime.UtcNow;
            _context.GachaItems.Add(item);
            await _context.SaveChangesAsync();
            return item;
        }

        public async Task<GachaItem> UpdateItemAsync(GachaItem item)
        {
            var existing = await _context.GachaItems.FindAsync(item.Id);
            if (existing == null || existing.ChannelName != item.ChannelName)
                throw new KeyNotFoundException("Item no encontrado");

            existing.Name = item.Name;
            existing.Rarity = item.Rarity;
            existing.Image = item.Image ?? existing.Image;
            existing.Available = item.Available;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task DeleteItemAsync(int id, string channelName)
        {
            var item = await _context.GachaItems.FindAsync(id);
            if (item == null || item.ChannelName != channelName)
                throw new KeyNotFoundException("Item no encontrado");

            _context.GachaItems.Remove(item);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // RESTRICTIONS CRUD
        // ========================================================================

        public async Task<List<GachaItemRestriction>> GetRestrictionsAsync(string channelName)
        {
            return await _context.GachaItemRestrictions
                .Include(r => r.Item)
                .Where(r => r.ChannelName == channelName)
                .ToListAsync();
        }

        public async Task<GachaItemRestriction> CreateRestrictionAsync(GachaItemRestriction restriction)
        {
            restriction.CreatedAt = DateTime.UtcNow;
            restriction.UpdatedAt = DateTime.UtcNow;
            _context.GachaItemRestrictions.Add(restriction);
            await _context.SaveChangesAsync();
            return restriction;
        }

        public async Task<GachaItemRestriction> UpdateRestrictionAsync(GachaItemRestriction restriction)
        {
            var existing = await _context.GachaItemRestrictions.FindAsync(restriction.Id);
            if (existing == null || existing.ChannelName != restriction.ChannelName)
                throw new KeyNotFoundException("Restriccion no encontrada");

            existing.MinDonationRequired = restriction.MinDonationRequired;
            existing.TotalQuantity = restriction.TotalQuantity;
            existing.IsUnique = restriction.IsUnique;
            existing.CooldownPeriod = restriction.CooldownPeriod;
            existing.CooldownValue = restriction.CooldownValue;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task DeleteRestrictionAsync(int id, string channelName)
        {
            var r = await _context.GachaItemRestrictions.FindAsync(id);
            if (r == null || r.ChannelName != channelName) throw new KeyNotFoundException("Restriccion no encontrada");
            _context.GachaItemRestrictions.Remove(r);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // PREFERENCES CRUD
        // ========================================================================

        public async Task<List<GachaPreference>> GetPreferencesAsync(string channelName)
        {
            return await _context.GachaPreferences
                .Include(p => p.Item)
                .Include(p => p.Participant)
                .Where(p => p.ChannelName == channelName)
                .ToListAsync();
        }

        public async Task<GachaPreference> CreatePreferenceAsync(GachaPreference preference)
        {
            if (preference.ProbabilityPercentage < 0 || preference.ProbabilityPercentage > 100)
                throw new ArgumentException("Probabilidad debe estar entre 0 y 100");

            preference.CreatedAt = DateTime.UtcNow;
            preference.UpdatedAt = DateTime.UtcNow;
            _context.GachaPreferences.Add(preference);
            await _context.SaveChangesAsync();
            return preference;
        }

        public async Task<GachaPreference> UpdatePreferenceAsync(GachaPreference preference)
        {
            var existing = await _context.GachaPreferences.FindAsync(preference.Id);
            if (existing == null || existing.ChannelName != preference.ChannelName)
                throw new KeyNotFoundException("Preferencia no encontrada");

            existing.ProbabilityPercentage = preference.ProbabilityPercentage;
            existing.IsActive = preference.IsActive;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task DeletePreferenceAsync(int id, string channelName)
        {
            var p = await _context.GachaPreferences.FindAsync(id);
            if (p == null || p.ChannelName != channelName) throw new KeyNotFoundException("Preferencia no encontrada");
            _context.GachaPreferences.Remove(p);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // RARITY CONFIG
        // ========================================================================

        public async Task<List<GachaRarityConfig>> GetRarityConfigsAsync(string channelName)
        {
            var configs = await _context.GachaRarityConfigs
                .Where(c => c.ChannelName == channelName)
                .OrderByDescending(c => c.Probability)
                .ToListAsync();

            if (configs.Count == 0)
            {
                configs = await SeedDefaultRarityConfigsAsync(channelName);
            }

            return configs;
        }

        public async Task UpdateRarityConfigsAsync(string channelName, List<GachaRarityConfig> configs)
        {
            var total = configs.Sum(c => c.Probability);
            if (Math.Abs(total - 100m) > 0.01m)
                throw new ArgumentException($"Las probabilidades deben sumar 100%. Total actual: {total}%");

            foreach (var config in configs)
            {
                var existing = await _context.GachaRarityConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == channelName && c.Rarity == config.Rarity);

                if (existing != null)
                {
                    existing.Probability = config.Probability;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _context.GachaRarityConfigs.Add(new GachaRarityConfig
                    {
                        ChannelName = channelName,
                        Rarity = config.Rarity,
                        Probability = config.Probability
                    });
                }
            }

            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // RARITY RESTRICTIONS
        // ========================================================================

        public async Task<List<GachaRarityRestriction>> GetRarityRestrictionsAsync(string channelName)
        {
            return await _context.GachaRarityRestrictions
                .Include(r => r.Item)
                .Include(r => r.Participant)
                .Where(r => r.ChannelName == channelName)
                .ToListAsync();
        }

        public async Task<GachaRarityRestriction> CreateRarityRestrictionAsync(GachaRarityRestriction restriction)
        {
            restriction.CreatedAt = DateTime.UtcNow;
            restriction.UpdatedAt = DateTime.UtcNow;
            _context.GachaRarityRestrictions.Add(restriction);
            await _context.SaveChangesAsync();
            return restriction;
        }

        public async Task<GachaRarityRestriction> UpdateRarityRestrictionAsync(GachaRarityRestriction restriction)
        {
            var existing = await _context.GachaRarityRestrictions.FindAsync(restriction.Id);
            if (existing == null || existing.ChannelName != restriction.ChannelName)
                throw new KeyNotFoundException("Restriccion de rareza no encontrada");

            existing.PullInterval = restriction.PullInterval;
            existing.TimeInterval = restriction.TimeInterval;
            existing.TimeUnit = restriction.TimeUnit;
            existing.IsActive = restriction.IsActive;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task DeleteRarityRestrictionAsync(int id, string channelName)
        {
            var r = await _context.GachaRarityRestrictions.FindAsync(id);
            if (r == null || r.ChannelName != channelName) throw new KeyNotFoundException("Restriccion no encontrada");
            _context.GachaRarityRestrictions.Remove(r);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // BANNERS
        // ========================================================================

        public async Task<List<GachaBanner>> GetBannersAsync(string channelName)
        {
            return await _context.GachaBanners
                .Where(b => b.ChannelName == channelName)
                .OrderByDescending(b => b.IsActive)
                .ThenByDescending(b => b.CreatedAt)
                .ToListAsync();
        }

        public async Task<GachaBanner> CreateBannerAsync(GachaBanner banner)
        {
            var count = await _context.GachaBanners.CountAsync(b => b.ChannelName == banner.ChannelName);
            if (count >= 5)
                throw new InvalidOperationException("Maximo 5 banners por canal");

            banner.IsActive = count == 0;
            banner.CreatedAt = DateTime.UtcNow;
            banner.UpdatedAt = DateTime.UtcNow;
            _context.GachaBanners.Add(banner);
            await _context.SaveChangesAsync();
            return banner;
        }

        public async Task SetActiveBannerAsync(int id, string channelName)
        {
            var banners = await _context.GachaBanners
                .Where(b => b.ChannelName == channelName)
                .ToListAsync();

            foreach (var b in banners)
            {
                b.IsActive = b.Id == id;
                b.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        public async Task DeleteBannerAsync(int id, string channelName)
        {
            var banner = await _context.GachaBanners.FindAsync(id);
            if (banner == null || banner.ChannelName != channelName)
                throw new KeyNotFoundException("Banner no encontrado");
            if (banner.IsActive)
                throw new InvalidOperationException("No puedes eliminar el banner activo");

            _context.GachaBanners.Remove(banner);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // OVERLAY CONFIG
        // ========================================================================

        public async Task<GachaOverlayConfig?> GetOverlayConfigAsync(string channelName)
        {
            return await _context.GachaOverlayConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == channelName);
        }

        public async Task<GachaOverlayConfig> SaveOverlayConfigAsync(GachaOverlayConfig config)
        {
            var existing = await _context.GachaOverlayConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == config.ChannelName);

            if (existing != null)
            {
                existing.OverlaySize = config.OverlaySize;
                existing.CustomWidth = config.CustomWidth;
                existing.CustomHeight = config.CustomHeight;
                existing.AnimationSpeed = config.AnimationSpeed;
                existing.EnableDebug = config.EnableDebug;
                existing.EnableSounds = config.EnableSounds;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                config.CreatedAt = DateTime.UtcNow;
                config.UpdatedAt = DateTime.UtcNow;
                _context.GachaOverlayConfigs.Add(config);
                existing = config;
            }

            await _context.SaveChangesAsync();
            return existing;
        }

        // ========================================================================
        // PARTICIPANTS & DONATIONS
        // ========================================================================

        public async Task<List<GachaParticipant>> GetParticipantsAsync(string channelName)
        {
            return await _context.GachaParticipants
                .Where(p => p.ChannelName == channelName)
                .OrderByDescending(p => p.DonationAmount)
                .ToListAsync();
        }

        public async Task<GachaParticipant?> GetParticipantByNameAsync(string channelName, string name)
        {
            return await _context.GachaParticipants
                .FirstOrDefaultAsync(p => p.ChannelName == channelName && p.Name == name.ToLower());
        }

        public async Task<GachaParticipant> AddDonationAsync(string channelName, string participantName, decimal amount, string? twitchUserId = null)
        {
            if (amount <= 0) throw new ArgumentException("El monto debe ser mayor a 0");

            participantName = participantName.ToLower().Trim();
            var participant = await GetParticipantByNameAsync(channelName, participantName);

            if (participant != null)
            {
                participant.DonationAmount += amount;
                participant.EffectiveDonation += amount;
                participant.UpdatedAt = DateTime.UtcNow;
                if (twitchUserId != null) participant.TwitchUserId = twitchUserId;
            }
            else
            {
                participant = new GachaParticipant
                {
                    ChannelName = channelName,
                    Name = participantName,
                    TwitchUserId = twitchUserId,
                    DonationAmount = amount,
                    EffectiveDonation = amount
                };
                _context.GachaParticipants.Add(participant);
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("[GACHA] Donacion: {Name} +${Amount} en {Channel} (disponible: {Available})",
                participantName, amount, channelName, participant.EffectiveDonation);

            return participant;
        }

        // ========================================================================
        // CORE PULL LOGIC
        // ========================================================================

        public async Task<GachaPullResult> PerformPullAsync(string channelName, int participantId)
        {
            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null || participant.ChannelName != channelName)
                throw new KeyNotFoundException("Participante no encontrado");

            if (participant.EffectiveDonation < 1)
                throw new InvalidOperationException("No tienes tiros disponibles");

            // Load all data
            var items = await _context.GachaItems
                .Where(i => i.ChannelName == channelName && i.Available)
                .ToListAsync();

            if (items.Count == 0)
                throw new InvalidOperationException("No hay items disponibles en este canal");

            var restrictions = await _context.GachaItemRestrictions
                .Where(r => r.ChannelName == channelName)
                .ToListAsync();

            var userPreferences = await _context.GachaPreferences
                .Where(p => p.ChannelName == channelName && p.ParticipantId == participantId && p.IsActive)
                .ToListAsync();

            var globalPreferences = await _context.GachaPreferences
                .Where(p => p.ChannelName == channelName && p.ParticipantId == null && p.IsActive)
                .ToListAsync();

            var rarityConfigs = await GetRarityConfigsAsync(channelName);

            var rarityRestrictions = await _context.GachaRarityRestrictions
                .Where(r => r.ChannelName == channelName && r.IsActive)
                .ToListAsync();

            // Calculate probabilities for each item
            var itemProbabilities = new List<(GachaItem Item, decimal Probability)>();

            foreach (var item in items)
            {
                var baseProbability = GetBaseProbability(item.Rarity, rarityConfigs);
                var isEligible = await CheckItemEligibility(item, participant, restrictions, rarityRestrictions);

                if (!isEligible)
                {
                    continue;
                }

                // Check for preference overrides
                var restriction = restrictions.FirstOrDefault(r => r.ItemId == item.Id);
                var userPref = userPreferences.FirstOrDefault(p => p.ItemId == item.Id);
                var globalPref = globalPreferences.FirstOrDefault(p => p.ItemId == item.Id);

                decimal finalProbability = baseProbability;

                if (userPref != null && restriction != null && participant.EffectiveDonation >= restriction.MinDonationRequired)
                {
                    finalProbability = userPref.ProbabilityPercentage / 100m;
                }
                else if (globalPref != null && restriction != null && participant.EffectiveDonation >= restriction.MinDonationRequired)
                {
                    finalProbability = globalPref.ProbabilityPercentage / 100m;
                }

                itemProbabilities.Add((item, finalProbability));
            }

            if (itemProbabilities.Count == 0)
                throw new InvalidOperationException("No hay items disponibles segun las restricciones actuales");

            // Normalize probabilities
            var totalProbability = itemProbabilities.Sum(p => p.Probability);
            var normalized = itemProbabilities.Select(p => (p.Item, Probability: p.Probability / totalProbability)).ToList();

            // Cryptographic random selection
            var selectedItem = CryptoWeightedSelect(normalized);

            // Update database
            participant.EffectiveDonation -= 1;
            participant.Pulls += 1;
            participant.UpdatedAt = DateTime.UtcNow;

            // Add to inventory
            var existingInventory = await _context.GachaInventories
                .FirstOrDefaultAsync(inv => inv.ChannelName == channelName
                    && inv.ParticipantId == participantId
                    && inv.ItemId == selectedItem.Id
                    && !inv.IsRedeemed);

            if (existingInventory != null)
            {
                existingInventory.Quantity += 1;
                existingInventory.LastWonAt = DateTime.UtcNow;
            }
            else
            {
                _context.GachaInventories.Add(new GachaInventory
                {
                    ChannelName = channelName,
                    ParticipantId = participantId,
                    ItemId = selectedItem.Id,
                    Quantity = 1,
                    LastWonAt = DateTime.UtcNow
                });
            }

            // Decrement total quantity if restricted
            var itemRestriction = restrictions.FirstOrDefault(r => r.ItemId == selectedItem.Id);
            if (itemRestriction?.TotalQuantity != null && itemRestriction.TotalQuantity > 0)
            {
                itemRestriction.TotalQuantity -= 1;
                itemRestriction.UpdatedAt = DateTime.UtcNow;
            }

            // Log the pull
            _context.GachaPullLogs.Add(new GachaPullLog
            {
                ChannelName = channelName,
                ParticipantId = participantId,
                ItemId = selectedItem.Id,
                Action = "pull",
                OccurredAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            _logger.LogInformation("[GACHA] Pull: {Name} obtuvo {Item} ({Rarity}) en {Channel}",
                participant.Name, selectedItem.Name, selectedItem.Rarity, channelName);

            // Emit overlay event
            if (_overlayService != null)
            {
                _ = _overlayService.SendGachaPullAsync(channelName, new
                {
                    itemId = selectedItem.Id,
                    itemName = selectedItem.Name,
                    rarity = selectedItem.Rarity,
                    image = selectedItem.Image,
                    participantName = participant.Name,
                    pullsRemaining = (int)participant.EffectiveDonation,
                    timestamp = DateTime.UtcNow
                });
            }

            // Check and unlock achievements after pull
            await CheckAndUnlockAchievementsAsync(channelName, participantId);

            return new GachaPullResult
            {
                Item = selectedItem,
                Participant = participant,
                PullsRemaining = (int)participant.EffectiveDonation
            };
        }

        // ========================================================================
        // COLLECTION / INVENTORY
        // ========================================================================

        public async Task<List<GachaInventory>> GetInventoryAsync(string channelName, int participantId)
        {
            return await _context.GachaInventories
                .Include(i => i.Item)
                .Where(i => i.ChannelName == channelName && i.ParticipantId == participantId)
                .OrderByDescending(i => i.LastWonAt)
                .ToListAsync();
        }

        public async Task<GachaCollectionStats> GetCollectionStatsAsync(string channelName, int participantId)
        {
            var inventory = await _context.GachaInventories
                .Include(i => i.Item)
                .Where(i => i.ChannelName == channelName && i.ParticipantId == participantId)
                .ToListAsync();

            var totalItems = await _context.GachaItems.CountAsync(i => i.ChannelName == channelName && i.Available);

            return new GachaCollectionStats
            {
                UniqueCards = inventory.Select(i => i.ItemId).Distinct().Count(),
                TotalCards = inventory.Sum(i => i.Quantity),
                TotalAvailable = totalItems,
                ByRarity = inventory
                    .Where(i => i.Item != null)
                    .GroupBy(i => i.Item!.Rarity)
                    .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity))
            };
        }

        public async Task RedeemItemAsync(int inventoryId, string channelName)
        {
            var inv = await _context.GachaInventories.FindAsync(inventoryId);
            if (inv == null || inv.ChannelName != channelName)
                throw new KeyNotFoundException("Item de inventario no encontrado");
            if (inv.IsRedeemed)
                throw new InvalidOperationException("Este item ya fue canjeado");

            if (inv.Quantity > 1)
            {
                // Split: decrement original, create new redeemed entry with qty 1
                inv.Quantity -= 1;

                _context.GachaInventories.Add(new GachaInventory
                {
                    ChannelName = inv.ChannelName,
                    ParticipantId = inv.ParticipantId,
                    ItemId = inv.ItemId,
                    Quantity = 1,
                    IsRedeemed = true,
                    LastWonAt = inv.LastWonAt,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                // Single copy, just mark as redeemed
                inv.IsRedeemed = true;
            }

            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // PULL LOGS
        // ========================================================================

        public async Task<List<GachaPullLog>> GetPullLogsAsync(string channelName, int participantId, int limit = 50)
        {
            return await _context.GachaPullLogs
                .Include(l => l.Item)
                .Where(l => l.ChannelName == channelName && l.ParticipantId == participantId)
                .OrderByDescending(l => l.OccurredAt)
                .Take(limit)
                .ToListAsync();
        }

        // ========================================================================
        // INTEGRATION CONFIG
        // ========================================================================

        public async Task<GachaIntegrationConfig?> GetIntegrationConfigAsync(string channelName)
        {
            return await _context.GachaIntegrationConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == channelName);
        }

        public async Task<GachaIntegrationConfig> SaveIntegrationConfigAsync(GachaIntegrationConfig config)
        {
            var existing = await _context.GachaIntegrationConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == config.ChannelName);

            if (existing != null)
            {
                existing.TipsEnabled = config.TipsEnabled;
                existing.PullsPerDollar = Math.Max(1, config.PullsPerDollar);
                existing.BitsEnabled = config.BitsEnabled;
                existing.BitsPerPull = Math.Max(1, config.BitsPerPull);
                existing.SubsEnabled = config.SubsEnabled;
                existing.PullsSubPrime = Math.Max(0, config.PullsSubPrime);
                existing.PullsSubTier1 = Math.Max(0, config.PullsSubTier1);
                existing.PullsSubTier2 = Math.Max(0, config.PullsSubTier2);
                existing.PullsSubTier3 = Math.Max(0, config.PullsSubTier3);
                existing.GiftSubsEnabled = config.GiftSubsEnabled;
                existing.PullsPerGift = Math.Max(1, config.PullsPerGift);
                existing.CoinsEnabled = config.CoinsEnabled;
                existing.CoinsPerPull = Math.Max(1, config.CoinsPerPull);
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                config.PullsPerDollar = Math.Max(1, config.PullsPerDollar);
                config.BitsPerPull = Math.Max(1, config.BitsPerPull);
                config.PullsPerGift = Math.Max(1, config.PullsPerGift);
                config.CoinsPerPull = Math.Max(1, config.CoinsPerPull);
                config.CreatedAt = DateTime.UtcNow;
                config.UpdatedAt = DateTime.UtcNow;
                _context.GachaIntegrationConfigs.Add(config);
                existing = config;
            }

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task ProcessTipDonationAsync(string channelName, string donorName, decimal amount, string currency)
        {
            var integrationConfig = await _context.GachaIntegrationConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == channelName && c.TipsEnabled);

            if (integrationConfig == null) return;

            var pullsPerDollar = Math.Max(1, integrationConfig.PullsPerDollar);
            var totalPulls = (int)(amount * pullsPerDollar);

            if (totalPulls <= 0) return;

            await AddDonationAsync(channelName, donorName, totalPulls);

            _logger.LogInformation("[GACHA] Auto-donation from tip: {Donor} +${Amount} {Currency} = {Pulls} pulls in {Channel}",
                donorName, amount, currency, totalPulls, channelName);
        }

        public async Task ProcessBitsEventAsync(string channelName, string username, int bitsAmount)
        {
            var config = await _context.GachaIntegrationConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == channelName && c.BitsEnabled);
            if (config == null || bitsAmount <= 0) return;

            var bitsPerPull = Math.Max(1, config.BitsPerPull);
            var totalPulls = bitsAmount / bitsPerPull;
            if (totalPulls <= 0) return;

            await AddDonationAsync(channelName, username.ToLower(), totalPulls);
            _logger.LogInformation("[GACHA] Bits → pulls: {User} {Bits} bits = {Pulls} pulls in {Channel}",
                username, bitsAmount, totalPulls, channelName);
        }

        public async Task ProcessSubEventAsync(string channelName, string username, string tier)
        {
            var config = await _context.GachaIntegrationConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == channelName && c.SubsEnabled);
            if (config == null) return;

            var pulls = tier switch
            {
                "Prime" or "prime" => config.PullsSubPrime,
                "1000" or "Tier 1" or "tier1" => config.PullsSubTier1,
                "2000" or "Tier 2" or "tier2" => config.PullsSubTier2,
                "3000" or "Tier 3" or "tier3" => config.PullsSubTier3,
                _ => config.PullsSubTier1
            };

            if (pulls <= 0) return;

            await AddDonationAsync(channelName, username.ToLower(), pulls);
            _logger.LogInformation("[GACHA] Sub → pulls: {User} ({Tier}) = {Pulls} pulls in {Channel}",
                username, tier, pulls, channelName);
        }

        public async Task ProcessGiftSubEventAsync(string channelName, string gifterUsername, int giftCount)
        {
            var config = await _context.GachaIntegrationConfigs
                .FirstOrDefaultAsync(c => c.ChannelName == channelName && c.GiftSubsEnabled);
            if (config == null || giftCount <= 0) return;

            var pullsPerGift = Math.Max(1, config.PullsPerGift);
            var totalPulls = giftCount * pullsPerGift;

            await AddDonationAsync(channelName, gifterUsername.ToLower(), totalPulls);
            _logger.LogInformation("[GACHA] GiftSub → pulls: {User} x{Gifts} = {Pulls} pulls in {Channel}",
                gifterUsername, giftCount, totalPulls, channelName);
        }

        // ========================================================================
        // ACHIEVEMENTS
        // ========================================================================

        public async Task<List<object>> GetAchievementsForParticipantAsync(int participantId)
        {
            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null) return new List<object>();

            var achievements = await _context.GachaAchievements
                .Where(a => a.IsActive && (a.ChannelName == null || a.ChannelName == participant.ChannelName))
                .ToListAsync();

            var unlocked = await _context.GachaUserAchievements
                .Where(ua => ua.ParticipantId == participantId)
                .ToListAsync();

            var unlockedDict = unlocked.ToDictionary(u => u.AchievementId, u => u.UnlockedAt);

            return achievements.Select(a => (object)new
            {
                achievement = new
                {
                    a.Id, a.Code, a.Name, a.Description, a.Icon,
                    a.BadgeRarity, a.ConditionType, a.ConditionValue, a.ConditionParam
                },
                isUnlocked = unlockedDict.ContainsKey(a.Id),
                unlockedAt = unlockedDict.ContainsKey(a.Id) ? (DateTime?)unlockedDict[a.Id] : null
            }).ToList();
        }

        public async Task CheckAndUnlockAchievementsAsync(string channelName, int participantId)
        {
            try
            {
                var participant = await _context.GachaParticipants.FindAsync(participantId);
                if (participant == null) return;

                var achievements = await _context.GachaAchievements
                    .Where(a => a.IsActive && (a.ChannelName == null || a.ChannelName == channelName))
                    .ToListAsync();

                var alreadyUnlocked = await _context.GachaUserAchievements
                    .Where(ua => ua.ParticipantId == participantId)
                    .Select(ua => ua.AchievementId)
                    .ToListAsync();

                var inventory = await _context.GachaInventories
                    .Include(i => i.Item)
                    .Where(i => i.ParticipantId == participantId)
                    .ToListAsync();

                var totalAvailable = await _context.GachaItems
                    .CountAsync(i => i.ChannelName == channelName && i.Available);

                foreach (var achievement in achievements.Where(a => !alreadyUnlocked.Contains(a.Id)))
                {
                    bool conditionMet = false;

                    switch (achievement.ConditionType)
                    {
                        case "pulls_count":
                            conditionMet = participant.Pulls >= achievement.ConditionValue;
                            break;

                        case "rarity_count":
                            if (!string.IsNullOrEmpty(achievement.ConditionParam))
                            {
                                var rarityCount = inventory
                                    .Where(i => i.Item != null && i.Item.Rarity == achievement.ConditionParam)
                                    .Sum(i => i.Quantity);
                                conditionMet = rarityCount >= achievement.ConditionValue;
                            }
                            break;

                        case "unique_cards":
                            var uniqueCount = inventory.Select(i => i.ItemId).Distinct().Count();
                            conditionMet = uniqueCount >= achievement.ConditionValue;
                            break;

                        case "donation_total":
                            conditionMet = participant.DonationAmount >= achievement.ConditionValue;
                            break;

                        case "collection_complete":
                            var ownedUnique = inventory.Select(i => i.ItemId).Distinct().Count();
                            conditionMet = totalAvailable > 0 && ownedUnique >= totalAvailable;
                            break;
                    }

                    if (conditionMet)
                    {
                        _context.GachaUserAchievements.Add(new GachaUserAchievement
                        {
                            ParticipantId = participantId,
                            AchievementId = achievement.Id,
                            UnlockedAt = DateTime.UtcNow
                        });
                    }
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[GACHA] Error checking achievements for participant {Id}", participantId);
            }
        }

        // ========================================================================
        // SHOWCASE
        // ========================================================================

        public async Task<List<GachaShowcase>> GetShowcaseAsync(int participantId)
        {
            return await _context.GachaShowcases
                .Include(s => s.Item)
                .Where(s => s.ParticipantId == participantId)
                .OrderBy(s => s.Position)
                .ToListAsync();
        }

        public async Task SetShowcaseAsync(int participantId, List<int> itemIds)
        {
            if (itemIds == null || itemIds.Count == 0)
                throw new ArgumentException("Debes seleccionar al menos un item");
            if (itemIds.Count > 5)
                throw new ArgumentException("Maximo 5 items en el showcase");

            // Validate all items exist in participant's inventory
            var ownedItemIds = await _context.GachaInventories
                .Where(i => i.ParticipantId == participantId)
                .Select(i => i.ItemId)
                .Distinct()
                .ToListAsync();

            var invalidItems = itemIds.Where(id => !ownedItemIds.Contains(id)).ToList();
            if (invalidItems.Count > 0)
                throw new InvalidOperationException($"No posees los items: {string.Join(", ", invalidItems)}");

            // Remove existing showcase
            var existing = await _context.GachaShowcases
                .Where(s => s.ParticipantId == participantId)
                .ToListAsync();
            _context.GachaShowcases.RemoveRange(existing);

            // Insert new showcase items
            for (int i = 0; i < itemIds.Count; i++)
            {
                _context.GachaShowcases.Add(new GachaShowcase
                {
                    ParticipantId = participantId,
                    ItemId = itemIds[i],
                    Position = i,
                    AddedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // WISHLIST
        // ========================================================================

        public async Task<List<GachaWishlist>> GetWishlistAsync(int participantId)
        {
            return await _context.GachaWishlists
                .Include(w => w.Item)
                .Where(w => w.ParticipantId == participantId)
                .OrderByDescending(w => w.AddedAt)
                .ToListAsync();
        }

        public async Task AddToWishlistAsync(int participantId, int itemId)
        {
            var exists = await _context.GachaWishlists
                .AnyAsync(w => w.ParticipantId == participantId && w.ItemId == itemId);
            if (exists) throw new InvalidOperationException("Este item ya esta en tu wishlist");

            var item = await _context.GachaItems.FindAsync(itemId);
            if (item == null) throw new KeyNotFoundException("Item no encontrado");

            _context.GachaWishlists.Add(new GachaWishlist
            {
                ParticipantId = participantId,
                ItemId = itemId,
                AddedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
        }

        public async Task RemoveFromWishlistAsync(int participantId, int itemId)
        {
            var entry = await _context.GachaWishlists
                .FirstOrDefaultAsync(w => w.ParticipantId == participantId && w.ItemId == itemId);
            if (entry == null) throw new KeyNotFoundException("Item no encontrado en wishlist");

            _context.GachaWishlists.Remove(entry);
            await _context.SaveChangesAsync();
        }

        // ========================================================================
        // ADVANCED STATS
        // ========================================================================

        public async Task<object> GetAdvancedStatsAsync(string channelName, int participantId)
        {
            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null || participant.ChannelName != channelName)
                throw new KeyNotFoundException("Participante no encontrado");

            var pullLogs = await _context.GachaPullLogs
                .Include(l => l.Item)
                .Where(l => l.ChannelName == channelName && l.ParticipantId == participantId)
                .OrderByDescending(l => l.OccurredAt)
                .ToListAsync();

            var inventory = await _context.GachaInventories
                .Include(i => i.Item)
                .Where(i => i.ParticipantId == participantId && i.ChannelName == channelName)
                .ToListAsync();

            var totalAvailable = await _context.GachaItems
                .CountAsync(i => i.ChannelName == channelName && i.Available);

            // Luck score: actual legendary % vs expected %
            var rarityConfigs = await GetRarityConfigsAsync(channelName);
            var expectedLegendaryPct = rarityConfigs
                .Where(c => c.Rarity == "legendary")
                .Select(c => (double)c.Probability)
                .FirstOrDefault();

            var totalPulls = pullLogs.Count;
            var legendaryPulls = pullLogs.Count(l => l.Item != null && l.Item.Rarity == "legendary");
            var actualLegendaryPct = totalPulls > 0 ? (double)legendaryPulls / totalPulls * 100.0 : 0;
            var luckScore = totalPulls > 0 ? Math.Round(actualLegendaryPct - expectedLegendaryPct, 2) : 0;

            // Current streak: pulls since last legendary
            var currentStreak = 0;
            foreach (var log in pullLogs)
            {
                if (log.Item != null && log.Item.Rarity == "legendary") break;
                currentStreak++;
            }

            // Rarest card in inventory
            var rarityTiers = new Dictionary<string, int>
            {
                { "common", 0 }, { "uncommon", 1 }, { "rare", 2 }, { "epic", 3 }, { "legendary", 4 }
            };

            object? rarestCard = null;
            var rarestTier = -1;
            foreach (var inv in inventory)
            {
                if (inv.Item == null) continue;
                var tier = rarityTiers.GetValueOrDefault(inv.Item.Rarity.ToLower(), 0);
                if (tier > rarestTier)
                {
                    rarestTier = tier;
                    rarestCard = new { inv.Item.Id, inv.Item.Name, inv.Item.Rarity, inv.Item.Image };
                }
            }

            // Total pulls by rarity
            var totalPullsByRarity = pullLogs
                .Where(l => l.Item != null)
                .GroupBy(l => l.Item!.Rarity)
                .ToDictionary(g => g.Key, g => g.Count());

            // Average pulls per day
            var firstPull = pullLogs.LastOrDefault()?.OccurredAt;
            double averagePullsPerDay = 0;
            if (firstPull.HasValue && totalPulls > 0)
            {
                var days = (DateTime.UtcNow - firstPull.Value).TotalDays;
                averagePullsPerDay = days > 0 ? Math.Round(totalPulls / days, 2) : totalPulls;
            }

            // Completion percentage
            var uniqueOwned = inventory.Select(i => i.ItemId).Distinct().Count();
            var completionPercentage = totalAvailable > 0
                ? Math.Round((double)uniqueOwned / totalAvailable * 100, 1) : 0;

            return new
            {
                luckScore,
                currentStreak,
                rarestCard,
                totalPullsByRarity,
                averagePullsPerDay,
                completionPercentage,
                totalPulls,
                legendaryPulls,
                actualLegendaryPct = Math.Round(actualLegendaryPct, 2),
                expectedLegendaryPct
            };
        }

        // ========================================================================
        // PRIVATE HELPERS
        // ========================================================================

        private decimal GetBaseProbability(string rarity, List<GachaRarityConfig> configs)
        {
            var config = configs.FirstOrDefault(c => c.Rarity == rarity.ToLower());
            if (config != null) return config.Probability / 100m;
            return DefaultProbabilities.GetValueOrDefault(rarity.ToLower(), 50m) / 100m;
        }

        private async Task<bool> CheckItemEligibility(
            GachaItem item,
            GachaParticipant participant,
            List<GachaItemRestriction> restrictions,
            List<GachaRarityRestriction> rarityRestrictions)
        {
            var restriction = restrictions.FirstOrDefault(r => r.ItemId == item.Id);

            if (restriction != null)
            {
                // Min donation check
                if (participant.EffectiveDonation < restriction.MinDonationRequired)
                    return false;

                // Total quantity exhausted
                if (restriction.TotalQuantity != null && restriction.TotalQuantity <= 0)
                    return false;

                // Unique check — already owns this item
                if (restriction.IsUnique)
                {
                    var owns = await _context.GachaInventories
                        .AnyAsync(i => i.ParticipantId == participant.Id && i.ItemId == item.Id);
                    if (owns) return false;
                }

                // Cooldown check
                if (restriction.CooldownPeriod != "none" && restriction.CooldownValue > 0)
                {
                    var lastWon = await _context.GachaInventories
                        .Where(i => i.ParticipantId == participant.Id && i.ItemId == item.Id)
                        .OrderByDescending(i => i.LastWonAt)
                        .Select(i => (DateTime?)i.LastWonAt)
                        .FirstOrDefaultAsync();

                    if (lastWon.HasValue)
                    {
                        var cooldownDuration = restriction.CooldownPeriod switch
                        {
                            "minutes" => TimeSpan.FromMinutes(restriction.CooldownValue),
                            "hours" => TimeSpan.FromHours(restriction.CooldownValue),
                            "days" => TimeSpan.FromDays(restriction.CooldownValue),
                            "months" => TimeSpan.FromDays(restriction.CooldownValue * 30),
                            _ => TimeSpan.Zero
                        };

                        // Ensure UTC comparison (PostgreSQL timestamp without tz is stored as UTC)
                        var lastWonUtc = DateTime.SpecifyKind(lastWon.Value, DateTimeKind.Utc);
                        if (DateTime.UtcNow - lastWonUtc < cooldownDuration)
                            return false;
                    }
                }
            }

            // Rarity restrictions (pull interval, time interval)
            var applicableRarityRestrictions = rarityRestrictions
                .Where(r => (r.Rarity == item.Rarity || r.ItemId == item.Id)
                         && (r.ParticipantId == null || r.ParticipantId == participant.Id))
                .ToList();

            foreach (var rr in applicableRarityRestrictions)
            {
                // Pull interval: minimum pulls since last win of this rarity
                if (rr.PullInterval.HasValue && rr.PullInterval > 0)
                {
                    var lastRarityWin = await _context.GachaPullLogs
                        .Include(l => l.Item)
                        .Where(l => l.ParticipantId == participant.Id
                                 && l.ChannelName == item.ChannelName
                                 && l.Item != null && l.Item.Rarity == item.Rarity)
                        .OrderByDescending(l => l.OccurredAt)
                        .FirstOrDefaultAsync();

                    if (lastRarityWin != null)
                    {
                        var pullsSince = await _context.GachaPullLogs
                            .CountAsync(l => l.ParticipantId == participant.Id
                                          && l.ChannelName == item.ChannelName
                                          && l.OccurredAt > lastRarityWin.OccurredAt);

                        if (pullsSince < rr.PullInterval.Value)
                            return false;
                    }
                }

                // Time interval: minimum time since last win of this rarity
                if (rr.TimeInterval.HasValue && rr.TimeInterval > 0 && !string.IsNullOrEmpty(rr.TimeUnit))
                {
                    var lastRarityWinTime = await _context.GachaPullLogs
                        .Include(l => l.Item)
                        .Where(l => l.ParticipantId == participant.Id
                                 && l.ChannelName == item.ChannelName
                                 && l.Item != null && l.Item.Rarity == item.Rarity)
                        .OrderByDescending(l => l.OccurredAt)
                        .Select(l => (DateTime?)l.OccurredAt)
                        .FirstOrDefaultAsync();

                    if (lastRarityWinTime.HasValue)
                    {
                        var interval = rr.TimeUnit switch
                        {
                            "minutes" => TimeSpan.FromMinutes(rr.TimeInterval.Value),
                            "hours" => TimeSpan.FromHours(rr.TimeInterval.Value),
                            "days" => TimeSpan.FromDays(rr.TimeInterval.Value),
                            _ => TimeSpan.Zero
                        };

                        var lastRarityUtc = DateTime.SpecifyKind(lastRarityWinTime.Value, DateTimeKind.Utc);
                        if (DateTime.UtcNow - lastRarityUtc < interval)
                            return false;
                    }
                }
            }

            return true;
        }

        private static GachaItem CryptoWeightedSelect(List<(GachaItem Item, decimal Probability)> items)
        {
            var randomBytes = new byte[4];
            RandomNumberGenerator.Fill(randomBytes);
            var randomValue = (decimal)(BitConverter.ToUInt32(randomBytes, 0) % 1000000) / 1000000m;

            decimal cumulative = 0;
            foreach (var (item, probability) in items)
            {
                cumulative += probability;
                if (randomValue < cumulative) return item;
            }

            return items[^1].Item;
        }

        private async Task<List<GachaRarityConfig>> SeedDefaultRarityConfigsAsync(string channelName)
        {
            var configs = new List<GachaRarityConfig>();
            foreach (var (rarity, probability) in DefaultProbabilities)
            {
                var config = new GachaRarityConfig
                {
                    ChannelName = channelName,
                    Rarity = rarity,
                    Probability = probability
                };
                _context.GachaRarityConfigs.Add(config);
                configs.Add(config);
            }
            await _context.SaveChangesAsync();
            return configs;
        }
    }

    // ========================================================================
    // RESULT DTOs
    // ========================================================================

    public class GachaPullResult
    {
        public GachaItem Item { get; set; } = null!;
        public GachaParticipant Participant { get; set; } = null!;
        public int PullsRemaining { get; set; }
    }

    public class GachaCollectionStats
    {
        public int UniqueCards { get; set; }
        public int TotalCards { get; set; }
        public int TotalAvailable { get; set; }
        public Dictionary<string, int> ByRarity { get; set; } = new();
    }
}
