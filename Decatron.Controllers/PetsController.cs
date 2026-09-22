using System;
using System.Linq;
using Decatron.Services.Pets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Mascotas (plan: .dev/plans/PETS_PLAN.md). Fase 0: catálogo de modelos y entrega firmada del glb.
    /// </summary>
    [ApiController]
    [Route("api/pets")]
    [Authorize]
    public class PetsController : ControllerBase
    {
        private static readonly TimeSpan SignedUrlTtl = TimeSpan.FromMinutes(10);

        private readonly PetCatalogService _catalog;

        public PetsController(PetCatalogService catalog)
        {
            _catalog = catalog;
        }

        /// <summary>Modelos disponibles (sin rutas de archivo).</summary>
        [HttpGet("catalog")]
        public IActionResult Catalog()
        {
            var items = _catalog.GetAll().Select(m => new
            {
                m.Id, m.Name, m.Credit, m.Triangles, m.Scale, m.GroundOffset, m.States, m.Skins
            });
            return Ok(items);
        }

        /// <summary>URL firmada de corta duración para cargar el glb de un modelo.</summary>
        [HttpGet("models/{id}/sign")]
        public IActionResult Sign(string id)
        {
            var manifest = _catalog.Get(id);
            if (manifest == null) return NotFound();
            var (expires, signature) = _catalog.Sign(manifest.Id, SignedUrlTtl);
            var url = Url.Action(nameof(GetFile), "Pets", new { id = manifest.Id, e = expires, s = signature });
            return Ok(new { url, expires });
        }

        /// <summary>Entrega el glb. Solo con firma válida y no vencida; nunca se cachea en proxies.</summary>
        [HttpGet("models/{id}/file")]
        [AllowAnonymous]
        public IActionResult GetFile(string id, [FromQuery] long e, [FromQuery] string? s)
        {
            if (!_catalog.Verify(id, e, s)) return Unauthorized();
            var path = _catalog.GetModelPath(id);
            if (path == null) return NotFound();

            Response.Headers["Cache-Control"] = "private, no-store";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return PhysicalFile(path, "model/gltf-binary", enableRangeProcessing: true);
        }
    }
}
