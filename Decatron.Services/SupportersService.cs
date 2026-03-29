using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services
{
    // ─── DTOs ────────────────────────────────────────────────────────────────────

    public class TierDurationConfig
    {
        public bool   IsPermanent { get; set; } = false;
        public int    Duration    { get; set; } = 1;
        public string Unit        { get; set; } = "months";
    }

    public class SupportersPageConfig
    {
        public bool Enabled { get; set; } = true;
        public string Title { get; set; } = "Apoya a Decatron";
        public string Tagline { get; set; } = "Ayuda a mantener el bot gratuito para todos";
        public string Description { get; set; } = "Decatron es completamente gratuito. Si quieres apoyar el desarrollo y los costos del servidor, puedes hacerlo desde aquí.";
        public decimal MonthlyGoal { get; set; } = 50;
        public decimal MonthlyRaised { get; set; } = 0;
        public bool ShowProgressBar { get; set; } = true;
        public bool ShowSupportersWall { get; set; } = true;
        public bool ShowFoundersSection { get; set; } = true;
        public string HeroFrom { get; set; } = "#2563eb";
        public string HeroTo { get; set; } = "#7c3aed";
        public Dictionary<string, TierDurationConfig> TierDurations { get; set; } = new()
        {
            ["supporter"] = new TierDurationConfig { IsPermanent = false, Duration = 1, Unit = "months" },
            ["premium"]   = new TierDurationConfig { IsPermanent = false, Duration = 1, Unit = "months" },
            ["fundador"]  = new TierDurationConfig { IsPermanent = false, Duration = 1, Unit = "months" },
        };
    }

    public class TierDisplayConfig
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string BadgeEmoji { get; set; } = string.Empty;
        public string Color { get; set; } = "#3b82f6";
        public decimal? MonthlyPrice { get; set; }
        public decimal? PermanentPrice { get; set; }
        public List<string> Benefits { get; set; } = new();
        public bool Highlighted { get; set; } = false;
    }

    public class SupportersFullConfig
    {
        public SupportersPageConfig Config { get; set; } = new();
        public List<TierDisplayConfig> Tiers { get; set; } = new();
    }

    public class SupporterEntry
    {
        public long Id { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string TwitchLogin { get; set; } = string.Empty;
        public string Tier { get; set; } = string.Empty;
        public bool IsPermanent { get; set; }
        public string JoinedAt { get; set; } = string.Empty;
        public string? ExpiresAt { get; set; }
        public decimal TotalDonated { get; set; }
    }

    public class PublicSupporterDto
    {
        public string DisplayName { get; set; } = string.Empty;
        public string TwitchLogin { get; set; } = string.Empty;
        public string Tier { get; set; } = string.Empty;
        public bool IsPermanent { get; set; }
        public string JoinedAt { get; set; } = string.Empty;
    }

    public class CreateDiscountCodeRequest
    {
        public string Code { get; set; } = string.Empty;
        public string DiscountType { get; set; } = "percent";
        public decimal DiscountValue { get; set; }
        public string AppliesTo { get; set; } = "all";
        public int? MaxUses { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public bool Active { get; set; } = true;
    }

    public class PatchDiscountCodeRequest
    {
        public bool Active { get; set; }
    }

    // ─── Interface ────────────────────────────────────────────────────────────────

    public class ValidateCodeResult
    {
        public bool Valid { get; set; }
        public string? Error { get; set; }
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public decimal OriginalAmount { get; set; }
        public decimal DiscountedAmount { get; set; }
        public int CodeId { get; set; }
    }

    public interface ISupportersService
    {
        Task<SupportersFullConfig> GetConfigAsync();
        Task SaveConfigAsync(SupportersPageConfig config, List<TierDisplayConfig> tiers);
        Task<decimal> GetMonthlyRaisedAsync();

        Task<(List<SupporterEntry> Items, int Total)> GetSupportersListAsync(int page, int pageSize, string? search);
        Task<List<PublicSupporterDto>> GetPublicSupportersAsync();

        Task<long?> ResolveUserIdAsync(string? twitchLogin);
        Task AssignTierAsync(string twitchLogin, string tier, bool isPermanent, int? duration, string? unit, string source = "manual");
        Task<ValidateCodeResult> ValidateDiscountCodeAsync(string code, string tier, string billingType, decimal baseAmount);
        Task IncrementCodeUsageAsync(int codeId);
        Task RecordPaymentAsync(long? userId, string? twitchLogin, decimal amount, string? tier, string billingType, string orderId, int? discountCodeId, string paymentType = "tier");

        Task<List<DiscountCode>> GetDiscountCodesAsync();
        Task<DiscountCode> CreateDiscountCodeAsync(CreateDiscountCodeRequest request);
        Task<bool> ToggleDiscountCodeAsync(int id, bool active);
        Task DeleteDiscountCodeAsync(int id);
    }

    // ─── Implementation ───────────────────────────────────────────────────────────

    public class SupportersService : ISupportersService
    {
        private readonly DecatronDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<SupportersService> _logger;

        private static readonly JsonSerializerOptions _json = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
        };

        public SupportersService(
            DecatronDbContext db,
            IConfiguration config,
            ILogger<SupportersService> logger)
        {
            _db = db;
            _config = config;
            _logger = logger;
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private NpgsqlConnection CreateConnection() =>
            new NpgsqlConnection(_config.GetConnectionString("DefaultConnection"));

        private DateTime? CalculateExpiry(bool isPermanent, int? duration, string? unit)
        {
            if (isPermanent || duration == null || string.IsNullOrEmpty(unit))
                return null;

            var now = DateTime.Now; // Use local time — matches PostgreSQL server timezone
            return unit switch
            {
                "minutes" => now.AddMinutes(duration.Value),
                "hours"   => now.AddHours(duration.Value),
                "days"    => now.AddDays(duration.Value),
                "weeks"   => now.AddDays(duration.Value * 7),
                "months"  => now.AddMonths(duration.Value),
                "years"   => now.AddYears(duration.Value),
                _         => now.AddDays(30),
            };
        }

        // ── Page Config ───────────────────────────────────────────────────────────

        public async Task<SupportersFullConfig> GetConfigAsync()
        {
            await using var conn = CreateConnection();
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(
                "SELECT config_json, tiers_json FROM supporters_page_config LIMIT 1", conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return new SupportersFullConfig();

            var configJson = reader.GetString(0);
            var tiersJson  = reader.GetString(1);

            var pageConfig = string.IsNullOrWhiteSpace(configJson) || configJson == "{}"
                ? new SupportersPageConfig()
                : JsonSerializer.Deserialize<SupportersPageConfig>(configJson, _json) ?? new SupportersPageConfig();

            var tiers = string.IsNullOrWhiteSpace(tiersJson) || tiersJson == "[]"
                ? new List<TierDisplayConfig>()
                : JsonSerializer.Deserialize<List<TierDisplayConfig>>(tiersJson, _json) ?? new List<TierDisplayConfig>();

            // Enrich with live monthly raised
            pageConfig.MonthlyRaised = await GetMonthlyRaisedAsync();

            return new SupportersFullConfig { Config = pageConfig, Tiers = tiers };
        }

        public async Task SaveConfigAsync(SupportersPageConfig config, List<TierDisplayConfig> tiers)
        {
            var configJson = JsonSerializer.Serialize(config, _json);
            var tiersJson  = JsonSerializer.Serialize(tiers, _json);

            await using var conn = CreateConnection();
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(@"
                UPDATE supporters_page_config
                SET config_json = @config, tiers_json = @tiers, updated_at = NOW()
                WHERE id = (SELECT id FROM supporters_page_config LIMIT 1);

                INSERT INTO supporters_page_config (config_json, tiers_json)
                SELECT @config, @tiers
                WHERE NOT EXISTS (SELECT 1 FROM supporters_page_config);
            ", conn);

            cmd.Parameters.AddWithValue("config", configJson);
            cmd.Parameters.AddWithValue("tiers", tiersJson);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task<decimal> GetMonthlyRaisedAsync()
        {
            try
            {
                await using var conn = CreateConnection();
                await conn.OpenAsync();

                // Sum only supporter/donation payments from supporter_payments this month
                await using var cmd = new NpgsqlCommand(@"
                    SELECT COALESCE(SUM(amount), 0)
                    FROM supporter_payments
                    WHERE captured_at >= date_trunc('month', NOW())", conn);

                var result = await cmd.ExecuteScalarAsync();
                return result is DBNull or null ? 0m : Convert.ToDecimal(result);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not calculate monthly raised — returning 0");
                return 0m;
            }
        }

        public async Task RecordPaymentAsync(
            long? userId, string? twitchLogin, decimal amount,
            string? tier, string billingType, string orderId,
            int? discountCodeId, string paymentType = "tier")
        {
            await using var conn = CreateConnection();
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO supporter_payments
                    (user_id, twitch_login, amount, paypal_order_id, tier, billing_type, discount_code_id, payment_type, captured_at)
                VALUES
                    (@userId, @login, @amount, @orderId, @tier, @billing, @codeId, @type, NOW())", conn);

            cmd.Parameters.AddWithValue("userId",   (object?)userId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("login",    (object?)twitchLogin ?? DBNull.Value);
            cmd.Parameters.AddWithValue("amount",   amount);
            cmd.Parameters.AddWithValue("orderId",  orderId);
            cmd.Parameters.AddWithValue("tier",     (object?)tier ?? DBNull.Value);
            cmd.Parameters.AddWithValue("billing",  billingType);
            cmd.Parameters.AddWithValue("codeId",   (object?)discountCodeId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("type",     paymentType);

            await cmd.ExecuteNonQueryAsync();
        }

        // ── Supporters List ───────────────────────────────────────────────────────

        public async Task<(List<SupporterEntry> Items, int Total)> GetSupportersListAsync(
            int page, int pageSize, string? search)
        {
            await using var conn = CreateConnection();
            await conn.OpenAsync();

            var offset = (page - 1) * pageSize;
            var searchFilter = string.IsNullOrWhiteSpace(search) ? "" :
                "AND (u.login ILIKE @search OR u.display_name ILIKE @search)";

            var countSql = $@"
                SELECT COUNT(*)
                FROM user_subscription_tiers ust
                JOIN users u ON u.id = ust.user_id
                WHERE ust.tier <> 'free'
                  AND (ust.tier_expires_at IS NULL OR ust.tier_expires_at > NOW())
                  {searchFilter}";

            var dataSql = $@"
                SELECT u.id, u.display_name, u.login, ust.tier,
                       (ust.tier_expires_at IS NULL) AS is_permanent,
                       ust.tier_started_at, ust.tier_expires_at,
                       COALESCE((
                           SELECT SUM(sp.amount)
                           FROM supporter_payments sp
                           WHERE sp.user_id = ust.user_id
                              OR (sp.user_id IS NULL AND sp.twitch_login = u.login)
                       ), 0) AS total_donated
                FROM user_subscription_tiers ust
                JOIN users u ON u.id = ust.user_id
                WHERE ust.tier <> 'free'
                  AND (ust.tier_expires_at IS NULL OR ust.tier_expires_at > NOW())
                  {searchFilter}
                ORDER BY ust.tier_started_at DESC
                LIMIT @limit OFFSET @offset";

            await using var countCmd = new NpgsqlCommand(countSql, conn);
            await using var dataCmd  = new NpgsqlCommand(dataSql,  conn);

            if (!string.IsNullOrWhiteSpace(search))
            {
                countCmd.Parameters.AddWithValue("search", $"%{search}%");
                dataCmd.Parameters.AddWithValue("search",  $"%{search}%");
            }

            dataCmd.Parameters.AddWithValue("limit",  pageSize);
            dataCmd.Parameters.AddWithValue("offset", offset);

            var total = Convert.ToInt32(await countCmd.ExecuteScalarAsync() ?? 0);

            var items = new List<SupporterEntry>();
            await using var reader = await dataCmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                items.Add(new SupporterEntry
                {
                    Id          = reader.GetInt64(0),
                    DisplayName = reader.GetString(1),
                    TwitchLogin = reader.GetString(2),
                    Tier        = reader.GetString(3),
                    IsPermanent = reader.GetBoolean(4),
                    JoinedAt    = reader.IsDBNull(5) ? "" : reader.GetDateTime(5).ToString("O"),
                    ExpiresAt   = reader.IsDBNull(6) ? null : reader.GetDateTime(6).ToString("O"),
                    TotalDonated = reader.GetDecimal(7),
                });
            }

            return (items, total);
        }

        public async Task<List<PublicSupporterDto>> GetPublicSupportersAsync()
        {
            await using var conn = CreateConnection();
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(@"
                SELECT u.display_name, u.login, ust.tier,
                       (ust.tier_expires_at IS NULL) AS is_permanent,
                       ust.tier_started_at
                FROM user_subscription_tiers ust
                JOIN users u ON u.id = ust.user_id
                WHERE ust.tier <> 'free'
                  AND (ust.tier_expires_at IS NULL OR ust.tier_expires_at > NOW())
                ORDER BY ust.tier_started_at ASC", conn);

            var list = new List<PublicSupporterDto>();
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new PublicSupporterDto
                {
                    DisplayName = reader.GetString(0),
                    TwitchLogin = reader.GetString(1),
                    Tier        = reader.GetString(2),
                    IsPermanent = reader.GetBoolean(3),
                    JoinedAt    = reader.IsDBNull(4) ? "" : reader.GetDateTime(4).ToString("O"),
                });
            }

            return list;
        }

        // ── User Resolution ───────────────────────────────────────────────────────

        public async Task<long?> ResolveUserIdAsync(string? twitchLogin)
        {
            if (string.IsNullOrWhiteSpace(twitchLogin)) return null;
            await using var conn = CreateConnection();
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(
                "SELECT id FROM users WHERE login = @login LIMIT 1", conn);
            cmd.Parameters.AddWithValue("login", twitchLogin.ToLower());
            var result = await cmd.ExecuteScalarAsync();
            return result is null or DBNull ? null : Convert.ToInt64(result);
        }

        // ── Tier Assignment ───────────────────────────────────────────────────────

        public async Task AssignTierAsync(string twitchLogin, string tier, bool isPermanent, int? duration, string? unit, string source = "manual")
        {
            var expiresAt = CalculateExpiry(isPermanent, duration, unit);

            await using var conn = CreateConnection();
            await conn.OpenAsync();

            // Resolve user_id from login
            await using var userCmd = new NpgsqlCommand(
                "SELECT id FROM users WHERE login = @login LIMIT 1", conn);
            userCmd.Parameters.AddWithValue("login", twitchLogin.ToLower());
            var userIdObj = await userCmd.ExecuteScalarAsync();

            if (userIdObj is null or DBNull)
                throw new InvalidOperationException($"No se encontró el usuario '{twitchLogin}' en la base de datos.");

            var userId = Convert.ToInt64(userIdObj);

            var notes = source == "paypal"
                ? (isPermanent ? "PayPal payment — permanent" : $"PayPal payment — {duration} {unit}")
                : (isPermanent ? "Manual assignment — permanent" : $"Manual assignment — {duration} {unit}");

            await using var upsertCmd = new NpgsqlCommand(@"
                INSERT INTO user_subscription_tiers
                    (user_id, tier, tier_started_at, tier_expires_at, source, notes)
                VALUES
                    (@userId, @tier, NOW(), @expiresAt, @source, @notes)
                ON CONFLICT (user_id) DO UPDATE
                    SET tier            = EXCLUDED.tier,
                        tier_started_at = EXCLUDED.tier_started_at,
                        tier_expires_at = EXCLUDED.tier_expires_at,
                        source          = EXCLUDED.source,
                        notes           = EXCLUDED.notes", conn);

            upsertCmd.Parameters.AddWithValue("userId",   userId);
            upsertCmd.Parameters.AddWithValue("tier",     tier);
            upsertCmd.Parameters.AddWithValue("source",   source);
            upsertCmd.Parameters.AddWithValue("expiresAt",(object?)expiresAt ?? DBNull.Value);
            upsertCmd.Parameters.AddWithValue("notes",    notes);

            await upsertCmd.ExecuteNonQueryAsync();

            _logger.LogInformation(
                "Tier '{Tier}' assigned to user '{Login}' via {Source} (expires: {Expiry})",
                tier, twitchLogin, source, expiresAt?.ToString("O") ?? "never");
        }

        public async Task<ValidateCodeResult> ValidateDiscountCodeAsync(string code, string tier, string billingType, decimal baseAmount)
        {
            var entity = await _db.DiscountCodes
                .FirstOrDefaultAsync(c => c.Code == code.ToUpper().Trim() && c.Active);

            if (entity is null)
                return new ValidateCodeResult { Valid = false, Error = "Código no válido o inactivo" };

            if (entity.ExpiresAt.HasValue && entity.ExpiresAt.Value < DateTime.UtcNow)
                return new ValidateCodeResult { Valid = false, Error = "Este código ha expirado" };

            if (entity.MaxUses.HasValue && entity.UsedCount >= entity.MaxUses.Value)
                return new ValidateCodeResult { Valid = false, Error = "Este código ya alcanzó el límite de usos" };

            if (entity.AppliesTo != "all" && entity.AppliesTo != tier)
                return new ValidateCodeResult { Valid = false, Error = $"Este código solo aplica al tier '{entity.AppliesTo}'" };

            var discountedAmount = entity.DiscountType == "percent"
                ? Math.Round(baseAmount * (1 - entity.DiscountValue / 100), 2)
                : Math.Max(0, baseAmount - entity.DiscountValue);

            // Minimum $1 to avoid free-tier via coupon
            if (discountedAmount < 1m) discountedAmount = 1m;

            return new ValidateCodeResult
            {
                Valid            = true,
                DiscountType     = entity.DiscountType,
                DiscountValue    = entity.DiscountValue,
                OriginalAmount   = baseAmount,
                DiscountedAmount = discountedAmount,
                CodeId           = entity.Id,
            };
        }

        public async Task IncrementCodeUsageAsync(int codeId)
        {
            var entity = await _db.DiscountCodes.FindAsync(codeId);
            if (entity is null) return;
            entity.UsedCount++;
            await _db.SaveChangesAsync();
        }

        // ── Discount Codes ────────────────────────────────────────────────────────

        public async Task<List<DiscountCode>> GetDiscountCodesAsync()
        {
            return await _db.DiscountCodes
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();
        }

        public async Task<DiscountCode> CreateDiscountCodeAsync(CreateDiscountCodeRequest req)
        {
            var entity = new DiscountCode
            {
                Code          = req.Code.ToUpper().Trim(),
                DiscountType  = req.DiscountType,
                DiscountValue = req.DiscountValue,
                AppliesTo     = req.AppliesTo,
                MaxUses       = req.MaxUses,
                ExpiresAt     = req.ExpiresAt,
                Active        = req.Active,
                CreatedAt     = DateTime.UtcNow,
            };

            _db.DiscountCodes.Add(entity);
            await _db.SaveChangesAsync();
            return entity;
        }

        public async Task<bool> ToggleDiscountCodeAsync(int id, bool active)
        {
            var entity = await _db.DiscountCodes.FindAsync(id);
            if (entity is null) return false;

            entity.Active = active;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task DeleteDiscountCodeAsync(int id)
        {
            var entity = await _db.DiscountCodes.FindAsync(id);
            if (entity is null) return;

            _db.DiscountCodes.Remove(entity);
            await _db.SaveChangesAsync();
        }
    }
}
