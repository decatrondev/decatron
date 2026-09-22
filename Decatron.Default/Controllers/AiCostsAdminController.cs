using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.AI;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Controllers
{
    /// <summary>
    /// Panel de costos de IA: cuánto gasta el bot por módulo, por streamer y por día, más el
    /// saldo de OpenRouter y los modelos por módulo. Plan: .dev/plans/AI_OPENROUTER_UNIFICACION_PLAN.md
    /// </summary>
    [Authorize]
    [RequireSystemOwner]
    [Route("api/admin/ai-costs")]
    [ApiController]
    public class AiCostsAdminController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly OpenRouterClient _openRouter;
        private readonly AiSettingsCache _settings;
        private readonly ILogger<AiCostsAdminController> _logger;

        public AiCostsAdminController(DecatronDbContext db, OpenRouterClient openRouter, AiSettingsCache settings, ILogger<AiCostsAdminController> logger)
        {
            _db = db;
            _openRouter = openRouter;
            _settings = settings;
            _logger = logger;
        }

        /// <summary>Resumen: totales, por módulo, por día, por modelo, top streamers y últimas llamadas.</summary>
        [HttpGet("summary")]
        public async Task<IActionResult> Summary([FromQuery] int days = 30)
        {
            days = Math.Clamp(days, 1, 365);
            var since = DateTime.UtcNow.Date.AddDays(-days + 1);
            var today = DateTime.UtcNow.Date;
            var q = _db.AiUsageLogs.AsNoTracking().Where(u => u.UsedAt >= since);

            var totals = await q.GroupBy(_ => 1).Select(g => new
            {
                calls = g.Count(),
                failed = g.Count(u => !u.Success),
                promptTokens = g.Sum(u => (long)u.PromptTokens),
                completionTokens = g.Sum(u => (long)u.CompletionTokens),
                costUsd = g.Sum(u => u.EstimatedCostUsd),
            }).FirstOrDefaultAsync();

            var todayCost = await _db.AiUsageLogs.Where(u => u.UsedAt >= today).SumAsync(u => (decimal?)u.EstimatedCostUsd) ?? 0m;

            var byModule = await q.GroupBy(u => u.Module).Select(g => new
            {
                module = g.Key,
                calls = g.Count(),
                failed = g.Count(u => !u.Success),
                promptTokens = g.Sum(u => (long)u.PromptTokens),
                completionTokens = g.Sum(u => (long)u.CompletionTokens),
                costUsd = g.Sum(u => u.EstimatedCostUsd),
                avgMs = (int)g.Average(u => u.ResponseTimeMs),
            }).OrderByDescending(x => x.costUsd).ToListAsync();

            var byModel = await q.GroupBy(u => new { u.Provider, u.Model }).Select(g => new
            {
                provider = g.Key.Provider,
                model = g.Key.Model,
                calls = g.Count(),
                promptTokens = g.Sum(u => (long)u.PromptTokens),
                completionTokens = g.Sum(u => (long)u.CompletionTokens),
                costUsd = g.Sum(u => u.EstimatedCostUsd),
            }).OrderByDescending(x => x.costUsd).ToListAsync();

            var byDayRaw = await q.GroupBy(u => new { u.UsedAt.Date, u.Module }).Select(g => new
            {
                day = g.Key.Date,
                module = g.Key.Module,
                calls = g.Count(),
                costUsd = g.Sum(u => u.EstimatedCostUsd),
            }).ToListAsync();
            var byDay = byDayRaw.GroupBy(x => x.day).OrderBy(g => g.Key).Select(g => new
            {
                day = g.Key.ToString("yyyy-MM-dd"),
                calls = g.Sum(x => x.calls),
                costUsd = g.Sum(x => x.costUsd),
                modules = g.ToDictionary(x => x.module, x => x.costUsd),
            }).ToList();

            var topChannels = await q.Where(u => u.UserId != 0 || u.ChannelName != null)
                .GroupBy(u => new { u.UserId, u.ChannelName }).Select(g => new
                {
                    userId = g.Key.UserId,
                    channel = g.Key.ChannelName,
                    calls = g.Count(),
                    tokens = g.Sum(u => (long)u.PromptTokens + u.CompletionTokens),
                    costUsd = g.Sum(u => u.EstimatedCostUsd),
                }).OrderByDescending(x => x.costUsd).ThenByDescending(x => x.calls).Take(10).ToListAsync();

            return Ok(new
            {
                success = true,
                days,
                totals = totals ?? new { calls = 0, failed = 0, promptTokens = 0L, completionTokens = 0L, costUsd = 0m },
                todayCost,
                byModule, byModel, byDay, topChannels,
            });
        }

        /// <summary>
        /// Llamadas una por una, paginadas y filtrables (módulo, modelo, canal, éxito, fechas).
        /// Es la herramienta para verificar qué cobró cada cosa; el resumen de arriba no alcanza
        /// cuando hay que buscar una llamada concreta.
        /// </summary>
        [HttpGet("calls")]
        public async Task<IActionResult> Calls(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 25,
            [FromQuery] string? module = null, [FromQuery] string? model = null, [FromQuery] string? channel = null,
            [FromQuery] bool? success = null, [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 10, 200);
            var q = _db.AiUsageLogs.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(module)) q = q.Where(u => u.Module == module);
            if (!string.IsNullOrWhiteSpace(model)) q = q.Where(u => u.Model == model);
            if (!string.IsNullOrWhiteSpace(channel))
            {
                var term = channel.Trim().ToLowerInvariant();
                q = q.Where(u => u.ChannelName != null && u.ChannelName.ToLower().Contains(term));
            }
            if (success.HasValue) q = q.Where(u => u.Success == success.Value);
            if (from.HasValue) q = q.Where(u => u.UsedAt >= DateTime.SpecifyKind(from.Value, DateTimeKind.Utc));
            if (to.HasValue) q = q.Where(u => u.UsedAt < DateTime.SpecifyKind(to.Value, DateTimeKind.Utc).AddDays(1));

            var total = await q.CountAsync();
            var items = await q.OrderByDescending(u => u.Id).Skip((page - 1) * pageSize).Take(pageSize).Select(u => new
            {
                u.Id, u.Module, u.Provider, u.Model, u.UserId, u.ChannelName, u.PromptTokens, u.CompletionTokens,
                u.EstimatedCostUsd, u.ResponseTimeMs, u.Success, u.ErrorMessage, u.UsedAt,
            }).ToListAsync();

            // Valores distintos para los desplegables de filtro (son pocos: módulos y modelos).
            var modules = await _db.AiUsageLogs.AsNoTracking().Select(u => u.Module).Distinct().OrderBy(m => m).ToListAsync();
            var models = await _db.AiUsageLogs.AsNoTracking().Select(u => u.Model).Distinct().OrderBy(m => m).ToListAsync();

            return Ok(new { success = true, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize), items, modules, models });
        }

        /// <summary>Saldo de OpenRouter en vivo.</summary>
        [HttpGet("credits")]
        public async Task<IActionResult> Credits()
        {
            var c = await _openRouter.GetCreditsAsync(HttpContext.RequestAborted);
            if (c == null) return Ok(new { success = false, configured = _openRouter.IsConfigured });
            return Ok(new { success = true, totalCredits = c.Value.TotalCredits, totalUsage = c.Value.TotalUsage, remaining = c.Value.TotalCredits - c.Value.TotalUsage });
        }

        /// <summary>Modelos por módulo y tabla de precios.</summary>
        [HttpGet("models")]
        public async Task<IActionResult> Models()
        {
            var cfg = await _db.DecatronAIGlobalConfigs.AsNoTracking().FirstOrDefaultAsync() ?? new DecatronAIGlobalConfig();
            return Ok(new
            {
                success = true,
                chatProvider = cfg.AIProvider,
                fallbackEnabled = cfg.FallbackEnabled,
                chatModel = cfg.OpenRouterModel,
                geminiModel = cfg.Model,
                translationModel = cfg.TranslationModel,
                coachModel = cfg.CoachModel,
                prices = JsonSerializer.Deserialize<JsonElement>(cfg.ModelPricesJson),
            });
        }

        public class UpdateModelsRequest
        {
            public string? ChatModel { get; set; }
            public string? TranslationModel { get; set; }
            public string? CoachModel { get; set; }
            /// <summary>{ "modelo": { "in": 0.15, "out": 0.47 } }</summary>
            public JsonElement? Prices { get; set; }
        }

        [HttpPut("models")]
        public async Task<IActionResult> UpdateModels([FromBody] UpdateModelsRequest req)
        {
            var cfg = await _db.DecatronAIGlobalConfigs.FirstOrDefaultAsync();
            if (cfg == null) { cfg = new DecatronAIGlobalConfig(); _db.DecatronAIGlobalConfigs.Add(cfg); }

            if (!string.IsNullOrWhiteSpace(req.ChatModel)) cfg.OpenRouterModel = req.ChatModel.Trim();
            if (!string.IsNullOrWhiteSpace(req.TranslationModel)) cfg.TranslationModel = req.TranslationModel.Trim();
            if (!string.IsNullOrWhiteSpace(req.CoachModel)) cfg.CoachModel = req.CoachModel.Trim();
            if (req.Prices is { ValueKind: JsonValueKind.Object } prices)
            {
                foreach (var m in prices.EnumerateObject())
                {
                    if (m.Value.ValueKind != JsonValueKind.Object
                        || !m.Value.TryGetProperty("in", out var i) || !i.TryGetDecimal(out _)
                        || !m.Value.TryGetProperty("out", out var o) || !o.TryGetDecimal(out _))
                        return BadRequest(new { success = false, message = $"Precio inválido para '{m.Name}': se espera {{ \"in\": n, \"out\": n }}" });
                }
                cfg.ModelPricesJson = prices.GetRawText();
            }

            cfg.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            _settings.Invalidate();
            await _settings.RefreshAsync();
            _logger.LogInformation("✅ [ADMIN] Modelos de IA actualizados: chat={Chat} translation={Tr} coach={Coach}", cfg.OpenRouterModel, cfg.TranslationModel, cfg.CoachModel);
            return Ok(new { success = true });
        }
    }
}
