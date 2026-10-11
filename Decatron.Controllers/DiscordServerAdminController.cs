using System.Text.RegularExpressions;
using Decatron.Attributes;
using Decatron.Discord.Models;
using Decatron.Services.DiscordServer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Vista previa y carga de la plantilla del servidor de Discord (plan: .dev/plans/DISCORD_SERVIDOR_PLAN.md). Solo el administrador del
    /// sistema. La carga nunca borra nada y solo corre si coincide con la vista previa.
    /// </summary>
    [ApiController]
    [Route("api/admin/discord-server")]
    [Authorize]
    [RequireSystemOwner]
    public class DiscordServerAdminController : ControllerBase
    {
        private readonly ServerTemplateService _service;
        private readonly DiscordSettings _discord;
        private readonly ILogger<DiscordServerAdminController> _logger;
        private static readonly Regex Snowflake = new(@"^\d{15,22}$", RegexOptions.Compiled);

        public DiscordServerAdminController(ServerTemplateService service, IOptions<DiscordSettings> discord, ILogger<DiscordServerAdminController> logger)
        {
            _service = service;
            _discord = discord.Value;
            _logger = logger;
        }

        /// <summary>Resumen de la plantilla (nombre, versión y cuántas piezas trae).</summary>
        [HttpGet("template")]
        public IActionResult Template()
        {
            var t = _service.LoadTemplate();
            return Ok(new
            {
                success = true,
                key = t.Template.Key, name = t.Template.Name, version = t.Template.Version,
                roles = new { active = t.Roles.Count(r => r.Enabled), total = t.Roles.Count },
                categories = new { active = t.Categories.Count(c => c.Enabled), total = t.Categories.Count },
                channels = new { active = t.Categories.Where(c => c.Enabled).Sum(c => c.Channels.Count), total = t.Categories.Sum(c => c.Channels.Count) },
                languages = t.Languages.Where(l => l.Enabled).Select(l => l.Code),
                // El id de la aplicación es público (va en cualquier enlace de invitación). Para la primera carga hace falta Administrador
                // (activar Comunidad lo exige); después se le puede quitar al rol del bot y quedarse con el enlace mínimo.
                invite = new
                {
                    admin = $"https://discord.com/oauth2/authorize?client_id={_discord.AppId}&scope=bot%20applications.commands&permissions=8",
                    minimal = $"https://discord.com/oauth2/authorize?client_id={_discord.AppId}&scope=bot%20applications.commands&permissions=328833821776"
                }
            });
        }

        [HttpPost("preview")]
        public async Task<IActionResult> Preview([FromBody] DiscordServerRequest req)
        {
            if (req == null || !Snowflake.IsMatch(req.GuildId ?? "")) return BadRequest(new { success = false, code = "bad_guild_id" });
            try
            {
                var (plan, snap, _) = await _service.PreviewAsync(req.GuildId!, ToOptions(req));
                return Ok(new
                {
                    success = true,
                    guild = new { id = snap.Guild.Id, name = snap.Guild.Name, community = snap.Guild.Features.Contains("COMMUNITY"), botIsAdmin = snap.BotIsAdmin },
                    hash = plan.Hash(),
                    hasActions = plan.HasActions,
                    counts = plan.Counts,
                    items = plan.Items.Select(i => new { i.Seq, i.Phase, i.Kind, i.Key, i.Name, i.Op, i.Code, i.Args, i.Detail })
                });
            }
            catch (DiscordApiException ex)
            {
                _logger.LogWarning("[Discord] Vista previa fallida para {Guild}: {Status}/{Code}", req.GuildId, ex.Status, ex.Code);
                // 404 / 50001: el bot no está en ese servidor o no ve nada
                return Ok(new { success = false, code = ex.Status == 404 || ex.Code == 50001 || ex.Status == 403 ? "bot_not_in_guild" : "discord_error" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Discord] Error en la vista previa");
                return StatusCode(500, new { success = false, code = "unexpected" });
            }
        }

        [HttpPost("apply")]
        public async Task<IActionResult> Apply([FromBody] DiscordServerApplyRequest req)
        {
            if (req == null || !Snowflake.IsMatch(req.GuildId ?? "")) return BadRequest(new { success = false, code = "bad_guild_id" });
            try
            {
                var job = await _service.StartApplyAsync(req.GuildId!, ToOptions(req), req.PlanHash ?? "", req.ConfirmGuildName ?? "");
                _logger.LogInformation("[Discord] Carga de plantilla en {Guild}: {Status} {Error}", req.GuildId, job.Status, job.Error);
                return Ok(new { success = job.Status == "running", jobId = job.Id, status = job.Status, error = job.Error, total = job.Total });
            }
            catch (DiscordApiException ex)
            {
                return Ok(new { success = false, error = "discord_error", detail = ex.Status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Discord] Error lanzando la carga");
                return StatusCode(500, new { success = false, error = "unexpected" });
            }
        }

        [HttpGet("jobs/{id}")]
        public IActionResult Job(string id)
        {
            var job = _service.GetJob(id);
            if (job == null) return NotFound(new { success = false });
            List<ApplyResult> results;
            lock (job.Results) results = job.Results.ToList();
            return Ok(new
            {
                success = true, id = job.Id, status = job.Status, error = job.Error, total = job.Total, done = results.Count,
                failed = results.Count(r => r.Status == "failed"),
                results = results.Select(r => new { r.Seq, r.Kind, r.Key, r.Name, r.Status, r.Message })
            });
        }

        private static PlanOptions ToOptions(DiscordServerRequest r) => new()
        {
            ApplyGuildSettings = r.ApplyGuildSettings, EnableCommunity = r.EnableCommunity, PostSeedMessages = r.PostSeedMessages, ApplyAutomod = r.ApplyAutomod
        };
    }

    public class DiscordServerRequest
    {
        public string? GuildId { get; set; }
        public bool ApplyGuildSettings { get; set; }
        public bool EnableCommunity { get; set; }
        public bool PostSeedMessages { get; set; } = true;
        public bool ApplyAutomod { get; set; }
    }

    public class DiscordServerApplyRequest : DiscordServerRequest
    {
        public string? PlanHash { get; set; }
        public string? ConfirmGuildName { get; set; }
    }
}
