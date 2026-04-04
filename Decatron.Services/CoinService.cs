using System.Text.Json;
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

        // ─── Transfers ───────────────────────────────────────────────────────────

        public async Task<CoinTransfer> TransferCoinsAsync(long fromUserId, long toUserId, int amount, string? message)
        {
            // 1. Cannot transfer to self
            if (fromUserId == toUserId)
                throw new InvalidOperationException("No puedes transferirte a ti mismo");

            // 2. Sender economy status
            var senderCoins = await GetOrCreateBalanceAsync(fromUserId);
            if (senderCoins.EconomyStatus != "normal")
                throw new InvalidOperationException("Tu cuenta de economia esta suspendida");

            // 3. Receiver economy status
            var receiverCoins = await GetOrCreateBalanceAsync(toUserId);
            if (receiverCoins.EconomyStatus == "banned_economy")
                throw new InvalidOperationException("El destinatario no puede recibir transferencias");

            // 4. Get settings
            var settings = await GetSettingsAsync();

            // 5. Minimum transfer amount
            if (amount < settings.MinTransferAmount)
                throw new InvalidOperationException($"Minimo {settings.MinTransferAmount} coins por transferencia");

            // 6. Sender account age
            var senderUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == fromUserId);
            if (senderUser != null)
            {
                var senderAgeDays = (DateTime.UtcNow - senderUser.CreatedAt).TotalDays;
                if (senderAgeDays < settings.MinAccountAgeToTransferDays)
                    throw new InvalidOperationException($"Tu cuenta debe tener al menos {settings.MinAccountAgeToTransferDays} dias para transferir");
            }

            // 7. Receiver account age
            var receiverUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == toUserId);
            if (receiverUser != null)
            {
                var receiverAgeDays = (DateTime.UtcNow - receiverUser.CreatedAt).TotalDays;
                if (receiverAgeDays < settings.MinAccountAgeToReceiveDays)
                    throw new InvalidOperationException("La cuenta del destinatario es muy nueva");
            }

            // 8. Max transfers per day (count)
            var todayStart = DateTime.UtcNow.Date;
            var todayTransferCount = await _db.CoinTransfers
                .CountAsync(t => t.FromUserId == fromUserId && t.CreatedAt >= todayStart);
            if (todayTransferCount >= settings.MaxTransfersPerDay)
                throw new InvalidOperationException($"Maximo {settings.MaxTransfersPerDay} transferencias por dia");

            // 9. Max transfer amount per day
            var todayTransferSum = await _db.CoinTransfers
                .Where(t => t.FromUserId == fromUserId && t.CreatedAt >= todayStart)
                .SumAsync(t => (long?)t.Amount) ?? 0;
            if (todayTransferSum + amount > settings.MaxTransferPerDay)
                throw new InvalidOperationException($"Maximo {settings.MaxTransferPerDay} coins por dia en transferencias");

            // 10. Sufficient balance
            if (senderCoins.Balance < amount)
                throw new InvalidOperationException("Balance insuficiente");

            // 11. Execute transfer
            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                senderCoins.Balance -= amount;
                senderCoins.TotalTransferredOut += amount;
                senderCoins.UpdatedAt = DateTime.UtcNow;

                receiverCoins.Balance += amount;
                receiverCoins.TotalTransferredIn += amount;
                receiverCoins.UpdatedAt = DateTime.UtcNow;

                var transfer = new CoinTransfer
                {
                    FromUserId = fromUserId,
                    ToUserId   = toUserId,
                    Amount     = amount,
                    Message    = message,
                    CreatedAt  = DateTime.UtcNow,
                };
                _db.CoinTransfers.Add(transfer);

                _db.CoinTransactions.Add(new CoinTransaction
                {
                    UserId       = fromUserId,
                    Amount       = -amount,
                    BalanceAfter = senderCoins.Balance,
                    Type         = "transfer_out",
                    Description  = $"Transferencia a {receiverUser?.DisplayName ?? receiverUser?.Login ?? $"#{toUserId}"}" + (string.IsNullOrWhiteSpace(message) ? "" : $": {message}"),
                    RelatedUserId = toUserId,
                    CreatedAt    = DateTime.UtcNow,
                });

                _db.CoinTransactions.Add(new CoinTransaction
                {
                    UserId       = toUserId,
                    Amount       = amount,
                    BalanceAfter = receiverCoins.Balance,
                    Type         = "transfer_in",
                    Description  = $"Transferencia de {senderUser?.DisplayName ?? senderUser?.Login ?? $"#{fromUserId}"}" + (string.IsNullOrWhiteSpace(message) ? "" : $": {message}"),
                    RelatedUserId = fromUserId,
                    CreatedAt    = DateTime.UtcNow,
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                _logger.LogInformation(
                    "Transfer completed: From={From}, To={To}, Amount={Amount}",
                    fromUserId, toUserId, amount);

                // Anti-abuse check (fire and forget, don't block the transfer)
                try
                {
                    await CheckAndFlagSuspiciousActivity(fromUserId, toUserId, amount, senderCoins);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in anti-abuse check after transfer");
                }

                return transfer;
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        }

        // ─── Anti-abuse ──────────────────────────────────────────────────────────

        private async Task CheckAndFlagSuspiciousActivity(long fromUserId, long toUserId, int amount, UserCoins senderCoins)
        {
            // Pattern 1: rapid_transfers — more than 5 transfers in 1 hour to the same user
            var oneHourAgo = DateTime.UtcNow.AddHours(-1);
            var recentToSameUser = await _db.CoinTransfers
                .CountAsync(t => t.FromUserId == fromUserId && t.ToUserId == toUserId && t.CreatedAt >= oneHourAgo);

            if (recentToSameUser > 5)
            {
                await CreateFlag(fromUserId, "rapid_transfers",
                    $"Mas de 5 transferencias en 1 hora al usuario #{toUserId}",
                    new { fromUserId, toUserId, count = recentToSameUser, window = "1h" });
                return; // One flag per transfer is enough
            }

            // Pattern 2: high_balance_transfer_new_account — transferred >80% of balance to account <14 days old
            var receiverUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == toUserId);
            if (receiverUser != null)
            {
                var receiverAgeDays = (DateTime.UtcNow - receiverUser.CreatedAt).TotalDays;
                var balanceBeforeTransfer = senderCoins.Balance + amount; // balance was already subtracted
                if (receiverAgeDays < 14 && balanceBeforeTransfer > 0 && (double)amount / balanceBeforeTransfer > 0.8)
                {
                    await CreateFlag(fromUserId, "high_balance_transfer_new_account",
                        $"Transferio {amount} coins (>{80}% del balance) a cuenta de {receiverAgeDays:F0} dias",
                        new { fromUserId, toUserId, amount, balanceBeforeTransfer, receiverAgeDays = (int)receiverAgeDays });
                }
            }
        }

        private async Task CreateFlag(long userId, string flagType, string flagReason, object details)
        {
            // Set user to flagged
            var userCoins = await _db.UserCoins.FirstOrDefaultAsync(x => x.UserId == userId);
            if (userCoins != null)
            {
                userCoins.EconomyStatus = "flagged";
                userCoins.UpdatedAt = DateTime.UtcNow;
            }

            _db.CoinFlags.Add(new CoinFlag
            {
                UserId      = userId,
                FlagType    = flagType,
                FlagReason  = flagReason,
                FlagDetails = JsonSerializer.Serialize(details),
                Status      = "pending",
                CreatedAt   = DateTime.UtcNow,
            });

            await _db.SaveChangesAsync();
            _logger.LogWarning("Anti-abuse flag created: Type={FlagType}, User={UserId}, Reason={Reason}",
                flagType, userId, flagReason);
        }

        // ─── Find User ──────────────────────────────────────────────────────────

        public async Task<long?> FindUserIdByUsernameAsync(string username)
        {
            var lower = username.ToLower();
            var user = await _db.Users.FirstOrDefaultAsync(
                u => u.Login.ToLower() == lower || (u.DiscordUsername != null && u.DiscordUsername.ToLower() == lower));
            return user?.Id;
        }

        // ─── Admin Economy Status ───────────────────────────────────────────────

        public async Task UpdateEconomyStatusAsync(long userId, string status)
        {
            var uc = await GetOrCreateBalanceAsync(userId);
            uc.EconomyStatus = status;
            uc.UpdatedAt = DateTime.UtcNow;

            if (status == "banned_economy")
            {
                uc.Balance = 0;
            }

            await _db.SaveChangesAsync();
            _logger.LogInformation("Economy status updated: User={UserId}, Status={Status}", userId, status);
        }

        // ─── Discount Codes ──────────────────────────────────────────────────────

        public async Task<DiscountValidation> ValidateDiscountCodeAsync(string code, long userId, long packageId, decimal packagePrice)
        {
            var disc = await _db.CoinDiscountCodes
                .FirstOrDefaultAsync(c => c.Code.ToLower() == code.ToLower());

            if (disc == null)
                return new DiscountValidation { Valid = false, Error = "Codigo no encontrado" };

            if (!disc.Enabled)
                return new DiscountValidation { Valid = false, Error = "Codigo deshabilitado" };

            var now = DateTime.UtcNow;
            if (disc.StartsAt.HasValue && disc.StartsAt.Value > now)
                return new DiscountValidation { Valid = false, Error = "Codigo expirado" };
            if (disc.ExpiresAt.HasValue && disc.ExpiresAt.Value < now)
                return new DiscountValidation { Valid = false, Error = "Codigo expirado" };

            if (disc.MaxUses.HasValue && disc.CurrentUses >= disc.MaxUses.Value)
                return new DiscountValidation { Valid = false, Error = "Codigo agotado" };

            var userUses = await _db.CoinDiscountUses
                .CountAsync(u => u.CodeId == disc.Id && u.UserId == userId);
            if (userUses >= disc.MaxUsesPerUser)
                return new DiscountValidation { Valid = false, Error = "Ya usaste este codigo" };

            if (disc.AssignedUserId.HasValue && disc.AssignedUserId.Value != userId)
                return new DiscountValidation { Valid = false, Error = "Este codigo no es para ti" };

            if (disc.ApplicablePackageId.HasValue && disc.ApplicablePackageId.Value != packageId)
                return new DiscountValidation { Valid = false, Error = "Este codigo no aplica a este paquete" };

            if (packagePrice < disc.MinPurchaseUsd)
                return new DiscountValidation { Valid = false, Error = $"Compra minima de ${disc.MinPurchaseUsd} USD" };

            decimal finalPrice = packagePrice;
            int bonusCoins = 0;

            switch (disc.DiscountType)
            {
                case "percentage":
                    finalPrice = Math.Max(0, Math.Round(packagePrice * (1 - disc.DiscountValue / 100m), 2));
                    break;
                case "fixed_amount":
                    finalPrice = Math.Max(0, packagePrice - disc.DiscountValue);
                    break;
                case "bonus_coins":
                    finalPrice = packagePrice;
                    bonusCoins = (int)disc.DiscountValue;
                    break;
            }

            return new DiscountValidation
            {
                Valid         = true,
                CodeId        = disc.Id,
                DiscountType  = disc.DiscountType,
                DiscountValue = disc.DiscountValue,
                FinalPrice    = finalPrice,
                BonusCoins    = bonusCoins,
            };
        }

        public async Task ApplyDiscountCodeAsync(long codeId, long userId, long purchaseId, decimal discountApplied)
        {
            var disc = await _db.CoinDiscountCodes.FindAsync(codeId);
            if (disc != null)
            {
                disc.CurrentUses++;
            }

            _db.CoinDiscountUses.Add(new CoinDiscountUse
            {
                CodeId          = codeId,
                UserId          = userId,
                PurchaseId      = purchaseId,
                DiscountApplied = discountApplied,
                UsedAt          = DateTime.UtcNow,
            });

            await _db.SaveChangesAsync();
            _logger.LogInformation(
                "Discount code {CodeId} applied: User={UserId}, Purchase={PurchaseId}, Discount={Discount}",
                codeId, userId, purchaseId, discountApplied);
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

    public class DiscountValidation
    {
        public bool Valid { get; set; }
        public string? Error { get; set; }
        public long? CodeId { get; set; }
        public string? DiscountType { get; set; }
        public decimal DiscountValue { get; set; }
        public decimal FinalPrice { get; set; }
        public int BonusCoins { get; set; }
    }
}
