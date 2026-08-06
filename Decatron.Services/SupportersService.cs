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

    /// <summary>
    /// Lo que se guarda de un pago capturado.
    ///
    /// <para><see cref="Amount"/> es el precio de lista en USD, que es lo que miran los
    /// reportes de supporters. <see cref="ChargedAmount"/> y <see cref="ChargedCurrency"/>
    /// son lo que realmente cobró la pasarela — Culqi cobra en PEN convirtiendo con un
    /// tipo de cambio fijo, así que las dos cifras no coinciden. El comprobante se emite
    /// por lo cobrado.</para>
    /// </summary>
    public class RecordPaymentInput
    {
        public long?   UserId      { get; set; }
        public string? TwitchLogin { get; set; }
        public decimal Amount      { get; set; }
        public string? Tier        { get; set; }
        public string  BillingType { get; set; } = "monthly";
        public string  OrderId     { get; set; } = string.Empty;
        public int?    DiscountCodeId { get; set; }
        public string  PaymentType { get; set; } = "tier";

        public decimal? ChargedAmount   { get; set; }
        public string?  ChargedCurrency { get; set; }
        /// <summary>"culqi" o "paypal".</summary>
        public string?  Provider        { get; set; }

        public string? CustomerEmail     { get; set; }
        public string? CustomerName      { get; set; }
        /// <summary>ISO-3166 alpha-2. NULL o "PE" = domiciliado.</summary>
        public string? CustomerCountry   { get; set; }
        public string? CustomerDocType   { get; set; }
        public string? CustomerDocNumber { get; set; }

        /// <summary>
        /// Si el comprador con RUC pidió factura. Sin RUC no significa nada: va boleta.
        /// Es decisión de cada compra, no del perfil.
        /// </summary>
        public bool PreferFactura { get; set; }

        /// <summary>
        /// NULL = no corresponde comprobante. Las donaciones son liberalidades, no venta
        /// de servicio, así que no llevan boleta ni factura.
        /// </summary>
        public string? InvoiceStatus { get; set; }
    }

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
        /// <summary>
        /// Qué le pasaría al tier del usuario si comprara esto. Se consulta ANTES de cobrar:
        /// si devuelve <c>Permitida = false</c> el cobro no debe ocurrir.
        /// </summary>
        Task<EvaluacionCompra> EvaluarCompraAsync(
            long? userId, string tier, bool isPermanent, int? duration, string? unit);

        /// <summary>
        /// Asigna un tier. <paramref name="sourceReference"/> es el id de la orden en la
        /// pasarela: sin él, una compra real no se distingue de un regalo manual.
        /// <paramref name="expiresAtOverride"/> lo usa la compra para extender en vez de
        /// reiniciar; sin él vale la duración tal cual, que es lo que quiere el admin.
        /// </summary>
        Task AssignTierAsync(
            string twitchLogin, string tier, bool isPermanent, int? duration, string? unit,
            string source = "manual", string? sourceReference = null,
            decimal? amountPaid = null, string? currency = null,
            DateTime? expiresAtOverride = null);
        Task<ValidateCodeResult> ValidateDiscountCodeAsync(string code, string tier, string billingType, decimal baseAmount);
        Task IncrementCodeUsageAsync(int codeId);
        Task<int> RecordPaymentAsync(RecordPaymentInput input);

        Task<List<DiscountCode>> GetDiscountCodesAsync();
        Task<DiscountCode> CreateDiscountCodeAsync(CreateDiscountCodeRequest request);
        Task<bool> ToggleDiscountCodeAsync(int id, bool active);
        Task DeleteDiscountCodeAsync(int id);
    }

    /// <summary>Qué tier tiene hoy un usuario.</summary>
    public sealed record EstadoTier(string Tier, DateTime? ExpiresAt, bool EsPermanente);

    /// <summary>Qué le haría al tier una compra.</summary>
    public enum TierAccion
    {
        /// <summary>No tenía nada vigente.</summary>
        Nuevo,
        /// <summary>Mismo tier: se le suma tiempo al que ya tiene.</summary>
        Extiende,
        /// <summary>Pasa a un tier mejor, o de mensual a permanente.</summary>
        Sube,
        /// <summary>Bajaría de tier. No se permite.</summary>
        Baja,
        /// <summary>Ya tiene un permanente que esto arruinaría. No se permite.</summary>
        YaPermanente,
    }

    /// <summary>
    /// Resultado de mirar una compra antes de cobrarla. <c>NuevoVencimiento</c> es null
    /// cuando la compra es permanente o cuando está bloqueada.
    /// </summary>
    public sealed record EvaluacionCompra(
        bool Permitida,
        TierAccion Accion,
        string? Motivo,
        EstadoTier? Actual,
        DateTime? NuevoVencimiento);

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

        // ── Política de cambio de tier ────────────────────────────────────────────

        /// <summary>
        /// Orden de los tiers. Solo sirve para comparar: no se usa en ningún otro lado y no
        /// tiene por qué coincidir con el precio.
        /// </summary>
        private static int Rango(string? tier) => tier?.ToLowerInvariant() switch
        {
            "supporter" => 1,
            "premium"   => 2,
            "fundador"  => 3,
            _           => 0, // free, null o cualquier cosa que no reconozcamos
        };

        /// <summary>El tier vigente de un usuario, o null si no tiene o ya venció.</summary>
        public async Task<EstadoTier?> GetTierActualAsync(long userId)
        {
            await using var conn = CreateConnection();
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(@"
                SELECT tier, tier_expires_at
                FROM user_subscription_tiers
                WHERE user_id = @userId
                  AND tier <> 'free'
                  AND (tier_expires_at IS NULL OR tier_expires_at > NOW())", conn);
            cmd.Parameters.AddWithValue("userId", userId);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync()) return null;

            var expira = reader.IsDBNull(1) ? (DateTime?)null : reader.GetDateTime(1);
            return new EstadoTier(reader.GetString(0), expira, expira == null);
        }

        /// <summary>
        /// Qué pasaría si este usuario comprara este tier.
        ///
        /// <para>Las reglas salen de una sola idea: <b>una compra nunca puede dejar al
        /// comprador con menos de lo que ya tenía</b>. Renovar suma tiempo en vez de
        /// reiniciarlo, subir de tier se permite, y bajar —o comprar teniendo un permanente—
        /// se bloquea antes de cobrar, porque cobrar por un perjuicio no se arregla
        /// después.</para>
        /// </summary>
        public async Task<EvaluacionCompra> EvaluarCompraAsync(
            long? userId, string tier, bool isPermanent, int? duration, string? unit)
        {
            var vencimientoNuevo = CalculateExpiry(isPermanent, duration, unit);

            var actual = userId == null ? null : await GetTierActualAsync(userId.Value);

            if (actual == null)
                return new EvaluacionCompra(true, TierAccion.Nuevo, null, null, vencimientoNuevo);

            var rangoActual = Rango(actual.Tier);
            var rangoNuevo  = Rango(tier);
            var mismoTier   = string.Equals(actual.Tier, tier, StringComparison.OrdinalIgnoreCase);

            // Con un permanente encima, lo único que tiene sentido comprar es un permanente
            // mejor. Todo lo demás le pone fecha de vencimiento a algo que no vencía.
            if (actual.EsPermanente && !(isPermanent && rangoNuevo > rangoActual))
            {
                return new EvaluacionCompra(false, TierAccion.YaPermanente,
                    $"Ya tenés {actual.Tier} permanente, que no vence. Esta compra le pondría " +
                    "fecha de fin a un acceso que hoy es para siempre.",
                    actual, null);
            }

            if (mismoTier && isPermanent)
            {
                // De mensual a permanente: es una mejora, deja de vencer.
                return new EvaluacionCompra(true, TierAccion.Sube, null, actual, null);
            }

            if (mismoTier)
            {
                // Renovación. Se suma desde donde termina lo que ya pagó, no desde hoy: si
                // renueva con días por delante, esos días son suyos y no se tiran.
                var desde = actual.ExpiresAt is { } fin && fin > DateTime.Now ? fin : DateTime.Now;
                return new EvaluacionCompra(true, TierAccion.Extiende, null, actual,
                    SumarDuracion(desde, duration, unit));
            }

            if (rangoNuevo > rangoActual)
                return new EvaluacionCompra(true, TierAccion.Sube, null, actual, vencimientoNuevo);

            return new EvaluacionCompra(false, TierAccion.Baja,
                $"Ya tenés {actual.Tier}, que es superior a {tier}. Esta compra te dejaría con " +
                "menos beneficios y perderías el tiempo que te queda del actual.",
                actual, null);
        }

        /// <summary>Suma una duración a una fecha concreta, no a "ahora".</summary>
        private static DateTime SumarDuracion(DateTime desde, int? duration, string? unit)
        {
            if (duration == null || string.IsNullOrEmpty(unit)) return desde.AddDays(30);

            return unit switch
            {
                "minutes" => desde.AddMinutes(duration.Value),
                "hours"   => desde.AddHours(duration.Value),
                "days"    => desde.AddDays(duration.Value),
                "weeks"   => desde.AddDays(duration.Value * 7),
                "months"  => desde.AddMonths(duration.Value),
                "years"   => desde.AddYears(duration.Value),
                _         => desde.AddDays(30),
            };
        }

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

        /// <summary>Guarda el pago y devuelve su id, que es lo que enlaza el comprobante.</summary>
        public async Task<int> RecordPaymentAsync(RecordPaymentInput input)
        {
            await using var conn = CreateConnection();
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO supporter_payments
                    (user_id, twitch_login, amount, currency, paypal_order_id, tier, billing_type,
                     discount_code_id, payment_type, captured_at,
                     charged_amount, charged_currency, provider,
                     customer_email, customer_name, customer_country,
                     customer_doc_type, customer_doc_number, invoice_status, prefer_factura)
                VALUES
                    (@userId, @login, @amount, 'USD', @orderId, @tier, @billing,
                     @codeId, @type, NOW(),
                     @chargedAmount, @chargedCurrency, @provider,
                     @email, @name, @country,
                     @docType, @docNumber, @invoiceStatus, @preferFactura)
                RETURNING id", conn);

            cmd.Parameters.AddWithValue("userId",   (object?)input.UserId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("login",    (object?)input.TwitchLogin ?? DBNull.Value);
            cmd.Parameters.AddWithValue("amount",   input.Amount);
            cmd.Parameters.AddWithValue("orderId",  input.OrderId);
            cmd.Parameters.AddWithValue("tier",     (object?)input.Tier ?? DBNull.Value);
            cmd.Parameters.AddWithValue("billing",  input.BillingType);
            cmd.Parameters.AddWithValue("codeId",   (object?)input.DiscountCodeId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("type",     input.PaymentType);

            cmd.Parameters.AddWithValue("chargedAmount",   (object?)input.ChargedAmount ?? DBNull.Value);
            cmd.Parameters.AddWithValue("chargedCurrency", (object?)input.ChargedCurrency ?? DBNull.Value);
            cmd.Parameters.AddWithValue("provider",        (object?)input.Provider ?? DBNull.Value);

            cmd.Parameters.AddWithValue("email",     (object?)input.CustomerEmail ?? DBNull.Value);
            cmd.Parameters.AddWithValue("name",      (object?)input.CustomerName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("country",   (object?)input.CustomerCountry ?? DBNull.Value);
            cmd.Parameters.AddWithValue("docType",   (object?)input.CustomerDocType ?? DBNull.Value);
            cmd.Parameters.AddWithValue("docNumber", (object?)input.CustomerDocNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("invoiceStatus", (object?)input.InvoiceStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("preferFactura", input.PreferFactura);

            var id = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(id);
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

        public async Task AssignTierAsync(
            string twitchLogin, string tier, bool isPermanent, int? duration, string? unit,
            string source = "manual", string? sourceReference = null,
            decimal? amountPaid = null, string? currency = null,
            DateTime? expiresAtOverride = null)
        {
            var expiresAt = isPermanent ? null : (expiresAtOverride ?? CalculateExpiry(isPermanent, duration, unit));

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

            // El origen decide el texto. Antes solo se distinguía PayPal, así que una compra
            // con tarjeta quedaba anotada como "Manual assignment" — o sea, como un regalo.
            var origen = source switch
            {
                "paypal" => "PayPal payment",
                "culqi"  => "Culqi payment",
                "manual" => "Manual assignment",
                _        => source,
            };
            var notes = isPermanent ? $"{origen} — permanent" : $"{origen} — {duration} {unit}";

            // El tier anterior, para el historial. Se lee antes del upsert porque después ya
            // no existe: la tabla guarda un solo estado por usuario, no una línea de tiempo.
            await using var previoCmd = new NpgsqlCommand(
                "SELECT tier FROM user_subscription_tiers WHERE user_id = @userId", conn);
            previoCmd.Parameters.AddWithValue("userId", userId);
            var previoObj = await previoCmd.ExecuteScalarAsync();
            var tierPrevio = previoObj is string previo ? previo : null;

            // Red de seguridad, independiente de la política: si ya tenía este mismo tier con
            // más tiempo por delante, el tiempo no se toca. Cubre la carrera entre el momento
            // en que se evaluó la compra y el momento en que se acredita, donde el dinero ya
            // entró y quitarle días al comprador no sería reparable.
            if (!isPermanent && string.Equals(tierPrevio, tier, StringComparison.OrdinalIgnoreCase))
            {
                await using var vigenteCmd = new NpgsqlCommand(
                    "SELECT tier_expires_at FROM user_subscription_tiers WHERE user_id = @userId", conn);
                vigenteCmd.Parameters.AddWithValue("userId", userId);
                var vigenteObj = await vigenteCmd.ExecuteScalarAsync();

                if (vigenteObj is DBNull)
                {
                    expiresAt = null;                      // era permanente: sigue siéndolo
                }
                else if (vigenteObj is DateTime vigente && expiresAt is { } nuevo && vigente > nuevo)
                {
                    _logger.LogWarning(
                        "Tier '{Tier}' de '{Login}': el vencimiento calculado ({Nuevo}) era anterior al vigente ({Vigente}); se conserva el vigente",
                        tier, twitchLogin, nuevo, vigente);
                    expiresAt = vigente;
                }
            }

            await using var upsertCmd = new NpgsqlCommand(@"
                INSERT INTO user_subscription_tiers
                    (user_id, tier, tier_started_at, tier_expires_at, source, source_reference,
                     amount_paid, currency, notes)
                VALUES
                    (@userId, @tier, NOW(), @expiresAt, @source, @sourceRef,
                     @amountPaid, @currency, @notes)
                ON CONFLICT (user_id) DO UPDATE
                    SET tier             = EXCLUDED.tier,
                        tier_started_at  = EXCLUDED.tier_started_at,
                        tier_expires_at  = EXCLUDED.tier_expires_at,
                        source           = EXCLUDED.source,
                        source_reference = EXCLUDED.source_reference,
                        amount_paid      = EXCLUDED.amount_paid,
                        currency         = EXCLUDED.currency,
                        notes            = EXCLUDED.notes,
                        updated_at       = NOW()", conn);

            upsertCmd.Parameters.AddWithValue("userId",     userId);
            upsertCmd.Parameters.AddWithValue("tier",       tier);
            upsertCmd.Parameters.AddWithValue("source",     source);
            upsertCmd.Parameters.AddWithValue("expiresAt",  (object?)expiresAt ?? DBNull.Value);
            upsertCmd.Parameters.AddWithValue("sourceRef",  (object?)sourceReference ?? DBNull.Value);
            upsertCmd.Parameters.AddWithValue("amountPaid", (object?)amountPaid ?? DBNull.Value);
            upsertCmd.Parameters.AddWithValue("currency",   (object?)currency ?? DBNull.Value);
            upsertCmd.Parameters.AddWithValue("notes",      notes);

            await upsertCmd.ExecuteNonQueryAsync();

            // Historial. Es lo único que queda si mañana hay que reconstruir qué se le dio a
            // quién y por qué: la tabla de tiers se sobrescribe en cada cambio.
            await using var histCmd = new NpgsqlCommand(@"
                INSERT INTO tier_history
                    (user_id, previous_tier, new_tier, change_reason, source, source_reference)
                VALUES
                    (@userId, @previo, @tier, @razon, @source, @sourceRef)", conn);

            histCmd.Parameters.AddWithValue("userId",    userId);
            histCmd.Parameters.AddWithValue("previo",    (object?)tierPrevio ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("tier",      tier);
            histCmd.Parameters.AddWithValue("razon",     notes);
            histCmd.Parameters.AddWithValue("source",    source);
            histCmd.Parameters.AddWithValue("sourceRef", (object?)sourceReference ?? DBNull.Value);

            await histCmd.ExecuteNonQueryAsync();

            _logger.LogInformation(
                "Tier '{Tier}' assigned to user '{Login}' via {Source} {Ref} (expires: {Expiry})",
                tier, twitchLogin, source, sourceReference ?? "-", expiresAt?.ToString("O") ?? "never");
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
