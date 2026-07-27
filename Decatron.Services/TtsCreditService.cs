using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace Decatron.Services
{
    /// <summary>
    /// Punto único de cobro de TTS.
    ///
    /// 1 crédito = 1 carácter de voz standard = $0.000004 USD.
    /// Los multiplicadores son la proporción exacta de los precios de AWS Polly.
    /// </summary>
    public class TtsCreditService : ITtsCreditService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<TtsCreditService> _logger;
        private readonly IConfiguration _config;
        private readonly ITtsService _ttsService;
        private readonly PiperTtsService _piperService;

        /// <summary>Créditos por carácter según el motor (precio AWS / precio standard).</summary>
        private static readonly Dictionary<string, long> _engineMultipliers = new(StringComparer.OrdinalIgnoreCase)
        {
            ["standard"]   = 1,
            ["neural"]     = 4,
            ["generative"] = 8,   // 7.5 real, redondeado hacia arriba
            ["longform"]   = 25,
            ["long-form"]  = 25,
        };

        // Cuotas mensuales por tier (créditos)
        private static readonly Dictionary<string, long> _tierMonthlyCredits = new(StringComparer.OrdinalIgnoreCase)
        {
            ["free"]      = 0,
            ["supporter"] = 150_000,
            ["premium"]   = 500_000,
            ["fundador"]  = 1_500_000,
        };

        /// <summary>Créditos mensuales para cuentas sin tier, solo durante la transición.</summary>
        private const long TransitionMonthlyCredits = 20_000;

        /// <summary>
        /// Cuota mensual de voz estándar (Piper) por tier.
        ///
        /// Son cifras deliberadamente holgadas. Lo que protege el servidor no es este
        /// tope sino el límite de síntesis simultáneas de PiperTtsService: el contador
        /// mensual está para frenar abusos evidentes y para que el panel enseñe algo
        /// concreto, no para racionar. Piper habla a unos 13 caracteres por segundo, así
        /// que el millón del plan gratis son más de 20 horas de voz seguidas al mes.
        /// </summary>
        private static readonly Dictionary<string, long> _tierStandardCredits = new(StringComparer.OrdinalIgnoreCase)
        {
            ["free"]      = 1_000_000,
            ["supporter"] = 3_000_000,
            ["premium"]   = 6_000_000,
            ["fundador"]  = 10_000_000,
        };

        /// <summary>Cuota estándar de las cuentas sin tier reconocido.</summary>
        private const long DefaultStandardCredits = 1_000_000;

        public TtsCreditService(
            DecatronDbContext context,
            ILogger<TtsCreditService> logger,
            IConfiguration config,
            ITtsService ttsService,
            PiperTtsService piperService)
        {
            _context = context;
            _logger = logger;
            _config = config;
            _ttsService = ttsService;
            _piperService = piperService;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Costo
        // ─────────────────────────────────────────────────────────────────────

        public long CalculateCost(int chars, string engine)
        {
            if (chars <= 0) return 0;
            var multiplier = _engineMultipliers.TryGetValue(engine ?? "standard", out var m) ? m : 1;
            return (long)chars * multiplier;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Consumo
        // ─────────────────────────────────────────────────────────────────────

        public async Task<CreditConsumeResult> TryConsumeAsync(
            long userId, int chars, string engine, string feature,
            string? voice = null, string? language = null)
        {
            if (chars <= 0)
                return new CreditConsumeResult(true, 0, 0);

            var cost = CalculateCost(chars, engine);

            // Los tiers ilimitados (admin) no consumen ni bloquean
            var tier = await TierResolver.GetEffectiveTierAsync(_context, userId);
            if (await IsUnlimitedAsync(tier))
            {
                await AddLedgerEntryAsync(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "consume", Credits = 0, Bucket = "none",
                    Feature = feature, Engine = engine, Chars = chars,
                    Voice = voice, Language = language, Note = $"Tier {tier} sin límite"
                });
                return new CreditConsumeResult(true, 0, long.MaxValue);
            }

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var balance = await GetOrCreateBalanceAsync(userId, tier);

                var monthlyRemaining = Math.Max(0, balance.MonthlyGranted - balance.MonthlyUsed);
                var available = monthlyRemaining + balance.PurchasedBalance;

                if (available < cost)
                {
                    await tx.RollbackAsync();
                    _logger.LogInformation(
                        "[TtsCredits] Saldo insuficiente para {UserId} en {Feature}: necesita {Cost}, tiene {Available}",
                        userId, feature, cost, available);
                    return CreditConsumeResult.Denied(available, "saldo_insuficiente");
                }

                // Primero la bolsa mensual, luego la comprada
                var fromMonthly = Math.Min(monthlyRemaining, cost);
                var fromPurchased = cost - fromMonthly;

                balance.MonthlyUsed += fromMonthly;
                balance.PurchasedBalance -= fromPurchased;
                balance.UpdatedAt = DateTimeOffset.UtcNow;

                if (fromMonthly > 0)
                {
                    _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                    {
                        UserId = userId, Type = "consume", Credits = -fromMonthly, Bucket = "monthly",
                        Feature = feature, Engine = engine, Chars = chars, Voice = voice, Language = language
                    });
                }

                if (fromPurchased > 0)
                {
                    _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                    {
                        UserId = userId, Type = "consume", Credits = -fromPurchased, Bucket = "purchased",
                        Feature = feature, Engine = engine, Chars = chars, Voice = voice, Language = language
                    });
                }

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                var remaining = Math.Max(0, balance.MonthlyGranted - balance.MonthlyUsed) + balance.PurchasedBalance;
                return new CreditConsumeResult(true, cost, remaining);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "[TtsCredits] Error consumiendo créditos de {UserId}", userId);
                return CreditConsumeResult.Denied(0, "error");
            }
        }

        /// <summary>
        /// Descuenta de la bolsa de voz estándar. Es más simple que la premium: una sola
        /// bolsa, sin multiplicadores de motor y sin nada comprado detrás, porque los
        /// créditos estándar no se venden.
        /// </summary>
        private async Task<CreditConsumeResult> TryConsumeStandardAsync(
            long userId, int chars, string feature, string? voice = null, string? language = null,
            string? note = null)
        {
            if (chars <= 0)
                return new CreditConsumeResult(true, 0, 0);

            var tier = await TierResolver.GetEffectiveTierAsync(_context, userId);

            if (await IsUnlimitedAsync(tier))
            {
                await AddLedgerEntryAsync(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "consume", Credits = 0, Bucket = "none",
                    Feature = feature, Engine = "piper", Chars = chars,
                    Voice = voice, Language = language, Note = note ?? $"Tier {tier} sin límite"
                });
                return new CreditConsumeResult(true, 0, long.MaxValue);
            }

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var balance = await GetOrCreateBalanceAsync(userId, tier);
                var remaining = Math.Max(0, balance.StandardGranted - balance.StandardUsed);

                if (remaining < chars)
                {
                    await tx.RollbackAsync();
                    _logger.LogInformation(
                        "[TtsCredits] Sin voz estándar para {UserId} en {Feature}: necesita {Cost}, le quedan {Remaining}",
                        userId, feature, chars, remaining);
                    return CreditConsumeResult.Denied(remaining, "saldo_estandar_insuficiente");
                }

                balance.StandardUsed += chars;
                balance.UpdatedAt = DateTimeOffset.UtcNow;

                _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "consume", Credits = -chars, Bucket = "standard",
                    Feature = feature, Engine = "piper", Chars = chars,
                    Voice = voice, Language = language, Note = note
                });

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return new CreditConsumeResult(true, chars, remaining - chars);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "[TtsCredits] Error consumiendo voz estándar de {UserId}", userId);
                return CreditConsumeResult.Denied(0, "error");
            }
        }

        /// <summary>Devuelve créditos estándar tras un fallo de síntesis.</summary>
        private async Task RefundStandardAsync(long userId, long credits, string feature, string note)
        {
            if (credits <= 0) return;

            try
            {
                var balance = await _context.TtsCreditBalances.FirstOrDefaultAsync(b => b.UserId == userId);
                if (balance == null) return;

                balance.StandardUsed = Math.Max(0, balance.StandardUsed - credits);
                balance.UpdatedAt = DateTimeOffset.UtcNow;

                _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "refund", Credits = credits, Bucket = "standard",
                    Feature = feature, Engine = "piper", Note = note
                });

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TtsCredits] Error devolviendo voz estándar a {UserId}", userId);
            }
        }

        public async Task RefundAsync(long userId, long credits, string feature, string note)
        {
            if (credits <= 0) return;

            try
            {
                var balance = await _context.TtsCreditBalances.FirstOrDefaultAsync(b => b.UserId == userId);
                if (balance == null) return;

                // Se devuelve a la bolsa mensual hasta donde se había consumido
                var toMonthly = Math.Min(credits, balance.MonthlyUsed);
                balance.MonthlyUsed -= toMonthly;
                balance.PurchasedBalance += credits - toMonthly;
                balance.UpdatedAt = DateTimeOffset.UtcNow;

                _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "refund", Credits = credits,
                    Bucket = toMonthly >= credits ? "monthly" : "purchased",
                    Feature = feature, Note = note
                });

                await _context.SaveChangesAsync();
                _logger.LogInformation("[TtsCredits] Devueltos {Credits} créditos a {UserId}: {Note}", credits, userId, note);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TtsCredits] Error devolviendo créditos a {UserId}", userId);
            }
        }

        public async Task RecordCacheHitAsync(
            long userId, int chars, string feature, string? voice = null, string? language = null)
        {
            await AddLedgerEntryAsync(new TtsCreditLedgerEntry
            {
                UserId = userId, Type = "consume", Credits = 0, Bucket = "none",
                Feature = feature, Engine = "cache_hit", Chars = chars,
                Voice = voice, Language = language,
                Note = "Audio ya en caché — sin costo"
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // Otorgamiento
        // ─────────────────────────────────────────────────────────────────────

        public async Task<bool> GrantAsync(
            long userId, long credits, string type, string bucket,
            string? note = null, long? grantedBy = null,
            string? gateway = null, string? externalId = null)
        {
            // Idempotencia: si ya existe ese movimiento de esa pasarela, no se repite
            if (!string.IsNullOrEmpty(externalId))
            {
                var exists = await _context.TtsCreditLedger
                    .AnyAsync(e => e.Gateway == gateway && e.ExternalId == externalId);
                if (exists)
                {
                    _logger.LogWarning(
                        "[TtsCredits] Movimiento {Gateway}/{ExternalId} ya acreditado, se ignora", gateway, externalId);
                    return false;
                }
            }

            var tier = await TierResolver.GetEffectiveTierAsync(_context, userId);
            var balance = await GetOrCreateBalanceAsync(userId, tier);

            // Las bolsas mensuales se recalculan solas: si al retirar se bajara lo
            // otorgado, el próximo uso lo volvería a subir a la cuota del tier y la
            // retirada se desharía sola. Retirar de una bolsa mensual es, en la práctica,
            // darla por consumida — y eso sí aguanta.
            var removingFromMonthlyBucket = credits < 0 && bucket != "purchased";

            if (removingFromMonthlyBucket)
            {
                if (bucket == "standard")
                    balance.StandardUsed = Math.Min(balance.StandardGranted, balance.StandardUsed - credits);
                else
                    balance.MonthlyUsed = Math.Min(balance.MonthlyGranted, balance.MonthlyUsed - credits);
            }
            else if (bucket == "standard")
            {
                balance.StandardGranted += credits;
            }
            else if (bucket == "monthly")
            {
                balance.MonthlyGranted += credits;
            }
            else
            {
                balance.PurchasedBalance += credits;
            }

            balance.UpdatedAt = DateTimeOffset.UtcNow;

            _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
            {
                UserId = userId, Type = type, Credits = credits, Bucket = bucket,
                Feature = "admin", Note = note, GrantedBy = grantedBy,
                Gateway = gateway, ExternalId = externalId
            });

            await _context.SaveChangesAsync();
            _logger.LogInformation(
                "[TtsCredits] {Credits} créditos ({Type}/{Bucket}) para {UserId}: {Note}",
                credits, type, bucket, userId, note);
            return true;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Consulta
        // ─────────────────────────────────────────────────────────────────────

        public async Task<string?> GenerateWithCreditsAsync(
            long userId, string text, string voice, string engine,
            string language, string feature, string? channelName = null,
            string provider = "polly")
        {
            if (string.IsNullOrWhiteSpace(text)) return null;

            if (string.Equals(provider, "piper", StringComparison.OrdinalIgnoreCase))
                return await GenerateWithPiperAsync(userId, text, voice, language, feature);

            // Si el audio ya está en caché no se llama a AWS, así que no se cobra nada.
            // Se comprueba antes para no ensuciar el libro mayor con cobro + devolución.
            if (await _ttsService.IsCachedAsync(text, voice, engine, language))
            {
                var cachedResult = await _ttsService.GenerateWithInfoAsync(text, voice, engine, language, channelName);
                if (cachedResult.Success)
                {
                    await RecordCacheHitAsync(userId, text.Length, feature, voice, language);
                    return cachedResult.Url;
                }
                // El caché falló (archivo borrado): se sigue por el camino normal
            }

            // Cobrar antes de llamar a AWS; si falla la síntesis, se devuelve.
            var charge = await TryConsumeAsync(userId, text.Length, engine, feature, voice, language);

            if (!charge.Allowed)
            {
                _logger.LogInformation(
                    "[TtsCredits] {Feature} sin créditos premium para {UserId} ({Reason}), se cae a voz estándar",
                    feature, userId, charge.Reason);
                return await FallbackToStandardAsync(userId, text, language, feature, "sin créditos premium");
            }

            try
            {
                var result = await _ttsService.GenerateWithInfoAsync(text, voice, engine, language, channelName);

                if (!result.Success)
                {
                    await RefundAsync(userId, charge.CreditsCharged, feature, "Polly no devolvió audio");
                    return await FallbackToStandardAsync(userId, text, language, feature, "Polly no devolvió audio");
                }

                // Un acierto de caché no le cuesta nada a nadie
                if (result.FromCache && charge.CreditsCharged > 0)
                {
                    await RefundAsync(userId, charge.CreditsCharged, feature, "Audio servido desde caché");
                    await RecordCacheHitAsync(userId, text.Length, feature, voice, language);
                }

                return result.Url;
            }
            catch (Exception ex)
            {
                await RefundAsync(userId, charge.CreditsCharged, feature, "Error generando audio");
                _logger.LogError(ex, "[TtsCredits] Error generando audio de {Feature} para {UserId}", feature, userId);
                return await FallbackToStandardAsync(userId, text, language, feature, "error de Polly");
            }
        }

        /// <summary>
        /// Red de seguridad de las alertas premium: cuando Polly no puede generar, se
        /// lee con voz estándar en vez de dejar la alerta muda.
        ///
        /// El streamer pagó por una voz mejor, no por quedarse sin voz cuando se le acabe
        /// la cuota. Y el silencio no se distingue de un bot roto: quien lo sufre abre un
        /// ticket, no mira su saldo.
        ///
        /// Gasta bolsa estándar, porque es una síntesis de verdad. Si esa también está
        /// agotada, ahí sí se calla: ya no queda nada que intentar.
        /// </summary>
        private async Task<string?> FallbackToStandardAsync(
            long userId, string text, string language, string feature, string reason)
        {
            var voice = _piperService.ResolveFallbackVoice(language);
            if (voice == null)
            {
                _logger.LogWarning("[TtsCredits] {Feature}: sin voz estándar a la que caer", feature);
                return null;
            }

            return await GenerateWithPiperAsync(userId, text, voice, language, feature, reason);
        }

        /// <summary>
        /// Camino de la voz estándar. Cobra de la bolsa de Piper y sintetiza en el
        /// servidor. Si no hay saldo o la síntesis falla se devuelve null y la alerta
        /// sale sin voz — igual que con Polly, no hay un tercer camino al que caer.
        /// </summary>
        /// <param name="fallbackReason">
        /// Si esta síntesis es el respaldo de una alerta premium que no pudo generarse,
        /// el motivo. Queda en el libro mayor porque no es lo mismo "se quedó sin saldo"
        /// que "AWS falló": lo primero es normal, lo segundo hay que mirarlo.
        /// </param>
        private async Task<string?> GenerateWithPiperAsync(
            long userId, string text, string voice, string language, string feature,
            string? fallbackReason = null)
        {
            var resolved = _piperService.ResolveVoice(voice, language);
            if (resolved == null)
            {
                _logger.LogWarning("[TtsCredits] {Feature}: Piper no tiene voces instaladas", feature);
                return null;
            }

            var note = fallbackReason == null ? null : $"Respaldo de voz premium: {fallbackReason}";

            var charge = await TryConsumeStandardAsync(userId, text.Length, feature, resolved, language, note);

            if (!charge.Allowed)
            {
                _logger.LogInformation(
                    "[TtsCredits] {Feature} sin voz estándar para {UserId} ({Reason})",
                    feature, userId, charge.Reason);
                return null;
            }

            var result = await _piperService.SynthesizeAsync(text, resolved);

            if (!result.Success)
            {
                await RefundStandardAsync(userId, charge.CreditsCharged, feature, result.Error ?? "Piper no devolvió audio");
                return null;
            }

            // GenerationMs a cero significa que ya estaba en caché: no ha costado CPU,
            // así que tampoco debe costar créditos.
            if (result.GenerationMs == 0 && charge.CreditsCharged > 0)
            {
                await RefundStandardAsync(userId, charge.CreditsCharged, feature, "Audio servido desde caché");
                await RecordCacheHitAsync(userId, text.Length, feature, resolved, language);
            }

            return result.Url;
        }

        public async Task<CreditBalanceInfo> GetBalanceAsync(long userId)
        {
            var tier = await TierResolver.GetEffectiveTierAsync(_context, userId);
            var balance = await GetOrCreateBalanceAsync(userId, tier);
            var unlimited = await IsUnlimitedAsync(tier);

            return new CreditBalanceInfo(
                MonthlyGranted: balance.MonthlyGranted,
                MonthlyUsed: balance.MonthlyUsed,
                MonthlyRemaining: Math.Max(0, balance.MonthlyGranted - balance.MonthlyUsed),
                PurchasedBalance: balance.PurchasedBalance,
                TotalAvailable: Math.Max(0, balance.MonthlyGranted - balance.MonthlyUsed) + balance.PurchasedBalance,
                Tier: tier,
                IsUnlimited: unlimited,
                MonthlyPeriod: balance.MonthlyPeriod,
                InTransitionWindow: IsInTransitionWindow(),
                TransitionEndsAt: GetTransitionEnd(),
                StandardGranted: balance.StandardGranted,
                StandardUsed: balance.StandardUsed,
                StandardRemaining: Math.Max(0, balance.StandardGranted - balance.StandardUsed));
        }

        public async Task<List<TtsCreditLedgerEntry>> GetHistoryAsync(long userId, int limit = 50, int offset = 0)
        {
            return await _context.TtsCreditLedger
                .Where(e => e.UserId == userId)
                .OrderByDescending(e => e.CreatedAt)
                .Skip(Math.Max(0, offset))
                .Take(Math.Clamp(limit, 1, 200))
                .ToListAsync();
        }

        // ─────────────────────────────────────────────────────────────────────
        // Internos
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Devuelve el saldo del canal, creándolo si no existe y reiniciando la bolsa
        /// mensual si cambió el mes. Reinicio perezoso: sin cron.
        /// </summary>
        private async Task<TtsCreditBalance> GetOrCreateBalanceAsync(long userId, string tier)
        {
            var currentPeriod = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
            var monthlyQuota = GetMonthlyQuota(tier);
            var standardQuota = GetStandardQuota(tier);

            var balance = await _context.TtsCreditBalances.FirstOrDefaultAsync(b => b.UserId == userId);

            if (balance == null)
            {
                balance = new TtsCreditBalance
                {
                    UserId = userId,
                    MonthlyPeriod = currentPeriod,
                    MonthlyGranted = monthlyQuota,
                    MonthlyUsed = 0,
                    PurchasedBalance = 0,
                    StandardGranted = standardQuota,
                    StandardUsed = 0
                };
                _context.TtsCreditBalances.Add(balance);

                _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "grant_monthly", Credits = monthlyQuota, Bucket = "monthly",
                    Feature = "admin", Note = $"Cuota inicial del mes (tier {tier})"
                });

                await _context.SaveChangesAsync();
                return balance;
            }

            if (balance.MonthlyPeriod < currentPeriod)
            {
                balance.MonthlyPeriod = currentPeriod;
                balance.MonthlyGranted = monthlyQuota;
                balance.MonthlyUsed = 0;
                balance.StandardGranted = standardQuota;
                balance.StandardUsed = 0;
                balance.UpdatedAt = DateTimeOffset.UtcNow;

                _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "grant_monthly", Credits = monthlyQuota, Bucket = "monthly",
                    Feature = "admin", Note = $"Cuota mensual (tier {tier})"
                });

                await _context.SaveChangesAsync();
            }
            else if (balance.MonthlyGranted < monthlyQuota)
            {
                // Subió de tier a mitad de mes: se ajusta la cuota hacia arriba
                var diff = monthlyQuota - balance.MonthlyGranted;
                balance.MonthlyGranted = monthlyQuota;
                balance.UpdatedAt = DateTimeOffset.UtcNow;

                _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "grant_monthly", Credits = diff, Bucket = "monthly",
                    Feature = "admin", Note = $"Ajuste por cambio a tier {tier}"
                });

                await _context.SaveChangesAsync();
            }
            else if (balance.MonthlyGranted > monthlyQuota &&
                     !await TierResolver.ExpiredNaturallyAsync(_context, userId))
            {
                // Bajó de tier a mitad de mes y no fue por vencimiento de su ciclo pagado:
                // se recorta la cuota, pero NUNCA por debajo de lo que ya gastó. Si consumió
                // 50.000 de 150.000 y pasa a free, se queda en 50.000 y no puede gastar más.
                // Los créditos comprados no se tocan: esos no caducan.
                //
                // Tampoco se tocan los regalos manuales de este periodo. Sin esto, otorgar
                // cuota mensual desde el panel de admin no servía de nada: el regalo entraba
                // y este mismo bloque se lo llevaba en el siguiente uso, porque desde aquí
                // una cuota por encima de la del tier no se distingue de una bajada de plan.
                var periodStart = new DateTimeOffset(currentPeriod, TimeSpan.Zero);
                var manualBonus = await _context.TtsCreditLedger
                    .Where(e => e.UserId == userId &&
                                e.Bucket == "monthly" &&
                                (e.Type == "grant_gift" || e.Type == "purchase") &&
                                e.CreatedAt >= periodStart)
                    .SumAsync(e => (long?)e.Credits) ?? 0;

                var floor = monthlyQuota + Math.Max(0, manualBonus);
                var newGranted = Math.Max(floor, balance.MonthlyUsed);

                if (newGranted < balance.MonthlyGranted)
                {
                    var removed = balance.MonthlyGranted - newGranted;
                    balance.MonthlyGranted = newGranted;
                    balance.UpdatedAt = DateTimeOffset.UtcNow;

                    _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                    {
                        UserId = userId, Type = "adjust_monthly", Credits = -removed, Bucket = "monthly",
                        Feature = "admin", Note = $"Recorte por bajada a tier {tier}"
                    });

                    await _context.SaveChangesAsync();

                    _logger.LogInformation(
                        "[TtsCredits] Cuota de {UserId} recortada en {Removed} por bajada a tier {Tier}",
                        userId, removed, tier);
                }
            }

            // La cuota estándar se ajusta aparte de la premium: no comparten bolsa ni
            // motivo de cambio. También cubre a las cuentas que existían antes de que
            // hubiera voz estándar, que tienen la bolsa a cero y hay que llenarla.
            if (balance.StandardGranted < standardQuota)
            {
                var diff = standardQuota - balance.StandardGranted;
                balance.StandardGranted = standardQuota;
                balance.UpdatedAt = DateTimeOffset.UtcNow;

                _context.TtsCreditLedger.Add(new TtsCreditLedgerEntry
                {
                    UserId = userId, Type = "grant_monthly", Credits = diff, Bucket = "standard",
                    Feature = "admin", Engine = "piper", Note = $"Cuota de voz estándar (tier {tier})"
                });

                await _context.SaveChangesAsync();
            }

            return balance;
        }

        /// <summary>
        /// Cuota mensual de voz estándar. A diferencia de la premium, aquí no hay
        /// ventana de transición ni cuentas a cero: la voz estándar es el suelo del
        /// producto y todo el mundo la tiene.
        /// </summary>
        private static long GetStandardQuota(string tier) =>
            _tierStandardCredits.TryGetValue(tier ?? "free", out var quota) ? quota : DefaultStandardCredits;

        /// <summary>
        /// Cuota mensual del tier. Las cuentas sin tier solo reciben créditos durante
        /// la ventana de transición; después, 0.
        /// </summary>
        private long GetMonthlyQuota(string tier)
        {
            if (_tierMonthlyCredits.TryGetValue(tier, out var quota) && quota > 0)
                return quota;

            return IsInTransitionWindow() ? TransitionMonthlyCredits : 0;
        }

        /// <summary>Ventana global: termina la misma fecha para todos.</summary>
        private bool IsInTransitionWindow()
        {
            var end = GetTransitionEnd();
            return end.HasValue && DateTime.UtcNow < end.Value;
        }

        private DateTime? GetTransitionEnd()
        {
            var raw = _config["TtsCredits:TransitionEndsAt"];
            if (string.IsNullOrWhiteSpace(raw)) return null;

            return DateTime.TryParse(raw, CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed)
                ? parsed
                : null;
        }

        private async Task<bool> IsUnlimitedAsync(string tier)
        {
            var limit = await TierResolver.GetPollyCharLimitAsync(_context, tier);
            return limit == TierResolver.Unlimited;
        }

        private async Task AddLedgerEntryAsync(TtsCreditLedgerEntry entry)
        {
            try
            {
                _context.TtsCreditLedger.Add(entry);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // El libro mayor no debe tumbar la generación de audio
                _logger.LogError(ex, "[TtsCredits] Error escribiendo el libro mayor de {UserId}", entry.UserId);
            }
        }
    }
}
