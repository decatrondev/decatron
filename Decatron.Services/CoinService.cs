using Decatron.Core.Models.Economy;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class CoinService
    {
        private readonly DecatronDbContext _db;
        private readonly ILogger<CoinService> _logger;
        private readonly IMemoryCache _cache;

        private const string SettingsCacheKey = "coin_settings";
        private static readonly TimeSpan SettingsCacheDuration = TimeSpan.FromMinutes(5);

        public CoinService(DecatronDbContext db, ILogger<CoinService> logger, IMemoryCache cache)
        {
            _db = db;
            _logger = logger;
            _cache = cache;
        }

        // ─── Balance ─────────────────────────────────────────────────────────────

        public async Task<UserCoins> GetOrCreateBalanceAsync(long userId)
        {
            var uc = await _db.UserCoins.FirstOrDefaultAsync(x => x.UserId == userId);
            if (uc != null) return uc;

            uc = new UserCoins
            {
                UserId    = userId,
                Balance   = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            _db.UserCoins.Add(uc);
            await _db.SaveChangesAsync();
            return uc;
        }

        public async Task<long> GetBalanceAsync(long userId)
        {
            var uc = await _db.UserCoins.FirstOrDefaultAsync(x => x.UserId == userId);
            return uc?.Balance ?? 0;
        }

        // ─── Packages ────────────────────────────────────────────────────────────

        public async Task<List<CoinPackage>> GetAvailablePackagesAsync(long userId)
        {
            var now = DateTime.UtcNow;
            var userCoins = await _db.UserCoins.FirstOrDefaultAsync(x => x.UserId == userId);
            var hasAlreadyPurchased = userCoins?.FirstPurchaseAt != null;

            var packages = await _db.CoinPackages
                .Where(p => p.Enabled)
                .OrderBy(p => p.SortOrder)
                .ToListAsync();

            return packages
                .Where(p =>
                {
                    // Filter out first_purchase_only if user already purchased
                    if (p.FirstPurchaseOnly && hasAlreadyPurchased)
                        return false;

                    // Filter out expired offers
                    if (p.IsOffer)
                    {
                        if (p.OfferStartsAt.HasValue && p.OfferStartsAt.Value > now)
                            return false;
                        if (p.OfferExpiresAt.HasValue && p.OfferExpiresAt.Value < now)
                            return false;
                    }

                    return true;
                })
                .ToList();
        }

        // ─── Purchase Flow ───────────────────────────────────────────────────────

        public async Task<CoinPendingOrder> CreatePendingOrderAsync(
            long userId, long? packageId, long? discountCodeId, decimal finalPrice, int? customCoins = null)
        {
            var order = new CoinPendingOrder
            {
                UserId         = userId,
                PackageId      = packageId,
                CustomCoins    = customCoins,
                DiscountCodeId = discountCodeId,
                FinalPriceUsd  = finalPrice,
                Status         = "pending",
                CreatedAt      = DateTime.UtcNow,
            };
            _db.CoinPendingOrders.Add(order);
            await _db.SaveChangesAsync();
            return order;
        }

        public async Task<CoinPurchase> CompletePurchaseAsync(
            long userId, long pendingOrderId, string paypalOrderId, string paypalStatus)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1. Find and verify pending order
                var pending = await _db.CoinPendingOrders.FirstOrDefaultAsync(
                    x => x.Id == pendingOrderId && x.UserId == userId);

                if (pending == null)
                    throw new InvalidOperationException("Pending order not found");
                if (pending.Status != "pending")
                    throw new InvalidOperationException($"Order is not pending (status: {pending.Status})");

                // 2. Calculate coins: package or custom
                int totalCoins;
                if (pending.CustomCoins.HasValue && pending.CustomCoins.Value > 0)
                {
                    totalCoins = pending.CustomCoins.Value; // Custom: no bonus
                }
                else
                {
                    var package = await _db.CoinPackages.FindAsync(pending.PackageId)
                        ?? throw new InvalidOperationException("Package not found");
                    totalCoins = package.Coins + package.BonusCoins;
                }

                // 4. Check first purchase bonus
                var userCoins = await GetOrCreateBalanceAsync(userId);
                bool isFirstPurchase = userCoins.FirstPurchaseAt == null;

                if (isFirstPurchase)
                {
                    var settings = await GetSettingsAsync();
                    if (settings.FirstPurchaseBonusPercent > 0)
                    {
                        int bonus = (int)Math.Floor(totalCoins * (settings.FirstPurchaseBonusPercent / 100.0));
                        totalCoins += bonus;
                        _logger.LogInformation(
                            "First purchase bonus: {Bonus} coins ({Pct}%) for user {UserId}",
                            bonus, settings.FirstPurchaseBonusPercent, userId);
                    }
                }

                // 5. Add coins to balance
                userCoins.Balance += totalCoins;

                // 6. Update totals
                userCoins.TotalEarned += totalCoins;

                // 7. Set first_purchase_at if null
                if (isFirstPurchase)
                    userCoins.FirstPurchaseAt = DateTime.UtcNow;

                userCoins.UpdatedAt = DateTime.UtcNow;

                // 8. Create CoinPurchase record
                var purchase = new CoinPurchase
                {
                    UserId         = userId,
                    PackageId      = pending.PackageId,
                    CustomCoins    = pending.CustomCoins,
                    CoinsReceived  = totalCoins,
                    AmountPaidUsd  = pending.FinalPriceUsd,
                    PaypalOrderId  = paypalOrderId,
                    PaypalStatus   = paypalStatus,
                    DiscountCodeId = pending.DiscountCodeId,
                    CreatedAt      = DateTime.UtcNow,
                };
                _db.CoinPurchases.Add(purchase);

                // 9. Create CoinTransaction
                var transaction = new CoinTransaction
                {
                    UserId      = userId,
                    Amount      = totalCoins,
                    BalanceAfter = userCoins.Balance,
                    Type        = "purchase",
                    Description = pending.CustomCoins.HasValue
                        ? $"Custom purchase ({pending.CustomCoins.Value} coins)"
                        : $"Package purchase ({totalCoins} coins)",
                    CreatedAt   = DateTime.UtcNow,
                };
                _db.CoinTransactions.Add(transaction);

                // 10. Mark pending order as completed
                pending.Status        = "completed";
                pending.PaypalOrderId = paypalOrderId;

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                _logger.LogInformation(
                    "Coin purchase completed: User={UserId}, Coins={Coins}, PayPal={OrderId}",
                    userId, totalCoins, paypalOrderId);

                return purchase;
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        }

        // ─── Admin ───────────────────────────────────────────────────────────────

        public async Task GiveCoinsAsync(long userId, int amount, string description, long? adminUserId)
        {
            var uc = await GetOrCreateBalanceAsync(userId);
            uc.Balance     += amount;
            uc.TotalEarned += amount;
            uc.UpdatedAt    = DateTime.UtcNow;

            _db.CoinTransactions.Add(new CoinTransaction
            {
                UserId       = userId,
                Amount       = amount,
                BalanceAfter = uc.Balance,
                Type         = "admin_give",
                Description  = description,
                RelatedUserId = adminUserId,
                CreatedAt    = DateTime.UtcNow,
            });

            await _db.SaveChangesAsync();
            _logger.LogInformation("Admin gave {Amount} coins to user {UserId} (by admin {AdminId})",
                amount, userId, adminUserId);
        }

        public async Task RemoveCoinsAsync(long userId, int amount, string description, long? adminUserId)
        {
            var uc = await GetOrCreateBalanceAsync(userId);
            uc.Balance  -= amount;
            uc.UpdatedAt = DateTime.UtcNow;

            _db.CoinTransactions.Add(new CoinTransaction
            {
                UserId       = userId,
                Amount       = -amount,
                BalanceAfter = uc.Balance,
                Type         = "admin_remove",
                Description  = description,
                RelatedUserId = adminUserId,
                CreatedAt    = DateTime.UtcNow,
            });

            await _db.SaveChangesAsync();
            _logger.LogInformation("Admin removed {Amount} coins from user {UserId} (by admin {AdminId})",
                amount, userId, adminUserId);
        }

        // ─── History ─────────────────────────────────────────────────────────────

        public async Task<List<CoinTransaction>> GetHistoryAsync(long userId, int page = 1, int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 20;
            if (pageSize > 100) pageSize = 100;

            return await _db.CoinTransactions
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        // ─── Settings ────────────────────────────────────────────────────────────

        public async Task<CoinSettings> GetSettingsAsync()
        {
            if (_cache.TryGetValue(SettingsCacheKey, out CoinSettings? cached) && cached != null)
                return cached;

            var settings = await _db.CoinSettings.FirstOrDefaultAsync()
                ?? new CoinSettings
                {
                    CurrencyName = "DecaCoins",
                    CurrencyIcon = "🪙",
                    Enabled      = true,
                };

            _cache.Set(SettingsCacheKey, settings, SettingsCacheDuration);
            return settings;
        }
    }
}
