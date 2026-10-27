using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma: qué módulos incluye el plan del tenant del Host, para que el panel del streamer oculte o marque lo que no trae.
    /// Es solo informativo: el cumplimiento real sigue siendo <see cref="RequiresModuleAttribute"/> en cada controlador.
    /// </summary>
    [ApiController]
    public class PlatformModulesController : ControllerBase
    {
        /// <summary>Los módulos que existen como capacidad (catálogo de la Fase 5.2).</summary>
        public static readonly string[] Modules =
        {
            "module.analytics", "module.bots", "module.clips", "module.cmd_custom", "module.cmd_followage", "module.cmd_game", "module.cmd_micro",
            "module.cmd_public", "module.cmd_scripting", "module.cmd_title", "module.cmd_watchtime", "module.credits",
            "module.decatron_ai", "module.decatron_chat", "module.developer", "module.discord", "module.emotes", "module.followers", "module.gacha",
            "module.game_overlays", "module.giveaways", "module.live_translation", "module.lol_coach", "module.mod_banned_words",
            "module.mod_commands", "module.mod_history", "module.mod_links", "module.mod_raids", "module.mod_spam",
            "module.multiview", "module.ov_chat", "module.ov_event_alerts", "module.ov_goals", "module.ov_live", "module.ov_now_playing",
            "module.ov_promo", "module.ov_shoutout", "module.ov_sound_alerts", "module.pets", "module.roulette", "module.song_request",
            "module.spirits", "module.timers", "module.tips", "module.tournaments", "module.tts",
        };

        private readonly IEntitlements _ent;

        public PlatformModulesController(IEntitlements ent) { _ent = ent; }

        [HttpGet("api/platform/my-modules")]
        [Authorize]
        public async Task<IActionResult> Mine(CancellationToken ct)
        {
            var tid = TenantAmbient.Current ?? 1;
            var included = new List<string>();
            foreach (var m in Modules)
                if (await _ent.HasAsync(m, tid, live: false, ct)) included.Add(m);
            return Ok(new { success = true, operational = await _ent.IsOperationalAsync(tid, false, ct), modules = included });
        }
    }
}
