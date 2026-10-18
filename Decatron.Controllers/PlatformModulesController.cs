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
            "module.clips", "module.commands", "module.discord", "module.game_overlays", "module.giveaways", "module.live_translation",
            "module.lol_coach", "module.moderation", "module.multiview", "module.overlays", "module.pets", "module.roulette",
            "module.song_request", "module.spirits", "module.timers", "module.tournaments", "module.tts",
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
