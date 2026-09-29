using System.Text.RegularExpressions;
using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace Decatron.Controllers
{
    /// <summary>
    /// Apariencia de cada torneo (rediseño de la vista publica, R0): logo, portada,
    /// color principal y secundario, y fondo claro u oscuro. La pagina publica, "Mi
    /// inscripcion" y el widget se pintan con esto. Las imagenes son publicas (las ve
    /// cualquiera en la pagina del torneo) y se sirven por /api/public/tournament/assets.
    /// </summary>
    [ApiController]
    public class TournamentAppearanceController : TournamentControllerBase
    {
        private static readonly Regex HexColor = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);
        private const long MaxBytes = 10 * 1024 * 1024;

        private readonly DecatronDbContext _db;
        private readonly IConfiguration _config;

        public TournamentAppearanceController(DecatronDbContext db, IConfiguration config, IPermissionService permissionService) : base(db, permissionService)
        {
            _db = db;
            _config = config;
        }

        // Carpeta publica (creada 2026-09-29 con dueño decatron: el backend corre como decatron).
        private string AssetsPath => _config["Tournament:PublicAssetsPath"] ?? "/var/www/html/decatron/tournament-public-assets";

        private async Task<(TournamentEdition? edition, IActionResult? error)> ResolveAsync(long editionId, bool write)
        {
            var channelOwnerId = GetChannelOwnerId();
            if (write && !await IsChannelAuthorizedAsync(channelOwnerId))
                return (null, StatusCode(403, new { success = false, message = "Solo el dueño del canal o alguien con control total puede cambiar la apariencia" }));
            var edition = await GetOwnedEditionOrNullAsync(editionId, channelOwnerId);
            return edition == null ? (null, NotFound(new { success = false, message = "Edición no encontrada" })) : (edition, null);
        }

        private static object ToDto(TournamentEdition e) => new
        {
            e.LogoUrl,
            e.BannerUrl,
            e.PrimaryColor,
            e.SecondaryColor,
            e.Theme,
        };

        [HttpGet("api/admin/tournament/editions/{editionId}/appearance")]
        [Authorize]
        public async Task<IActionResult> Get(long editionId)
        {
            var (edition, error) = await ResolveAsync(editionId, write: false);
            if (error != null) return error;
            return Ok(new { success = true, appearance = ToDto(edition!) });
        }

        public class UpdateRequest
        {
            public string? PrimaryColor { get; set; }
            public string? SecondaryColor { get; set; }
            public string Theme { get; set; } = "dark";
        }

        [HttpPut("api/admin/tournament/editions/{editionId}/appearance")]
        [Authorize]
        public async Task<IActionResult> Update(long editionId, [FromBody] UpdateRequest request)
        {
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            if (request.PrimaryColor != null && !HexColor.IsMatch(request.PrimaryColor))
                return BadRequest(new { success = false, message = "El color principal tiene que ser un color como #1E90FF" });
            if (request.SecondaryColor != null && !HexColor.IsMatch(request.SecondaryColor))
                return BadRequest(new { success = false, message = "El color secundario tiene que ser un color como #1E90FF" });
            if (request.Theme is not ("dark" or "light"))
                return BadRequest(new { success = false, message = "El fondo tiene que ser claro u oscuro" });

            edition!.PrimaryColor = request.PrimaryColor?.ToUpperInvariant();
            edition.SecondaryColor = request.SecondaryColor?.ToUpperInvariant();
            edition.Theme = request.Theme;
            edition.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { success = true, appearance = ToDto(edition) });
        }

        /// <summary>
        /// Sube el logo o la portada. Se vuelve a codificar como WEBP (valida que sea una
        /// imagen, quita metadatos y achica): logo hasta 512 px, portada hasta 2400 px de
        /// ancho. Reemplaza la anterior y la borra del disco.
        /// </summary>
        [HttpPost("api/admin/tournament/editions/{editionId}/appearance/{kind}")]
        [Authorize]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxBytes + 64 * 1024)]
        public async Task<IActionResult> Upload(long editionId, string kind, [FromForm] IFormFile file)
        {
            if (kind is not ("logo" or "banner")) return NotFound();
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            if (file == null || file.Length == 0) return BadRequest(new { success = false, message = "El archivo está vacío" });
            if (file.Length > MaxBytes) return BadRequest(new { success = false, message = "La imagen pesa más de 10 MB" });

            Image image;
            await using (var input = file.OpenReadStream())
            {
                try { image = await Image.LoadAsync(input); }
                catch { return BadRequest(new { success = false, message = "El archivo no es una imagen válida (usa PNG, JPG o WEBP)" }); }
            }

            string fileName;
            using (image)
            {
                image.Metadata.ExifProfile = null;
                image.Metadata.XmpProfile = null;
                if (kind == "logo" && (image.Width > 512 || image.Height > 512))
                    image.Mutate(x => x.Resize(new ResizeOptions { Size = new Size(512, 512), Mode = ResizeMode.Max }));
                if (kind == "banner" && image.Width > 2400)
                    image.Mutate(x => x.Resize(2400, 0));

                var dir = Path.Combine(AssetsPath, editionId.ToString());
                Directory.CreateDirectory(dir);
                fileName = $"{kind}-{Guid.NewGuid():N}.webp";
                await image.SaveAsWebpAsync(Path.Combine(dir, fileName), new WebpEncoder { Quality = kind == "logo" ? 92 : 85 });
            }

            var url = $"/api/public/tournament/assets/{editionId}/{fileName}";
            var old = kind == "logo" ? edition!.LogoUrl : edition!.BannerUrl;
            if (kind == "logo") edition.LogoUrl = url; else edition.BannerUrl = url;
            edition.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            DeleteOwnFile(editionId, old);

            return Ok(new { success = true, appearance = ToDto(edition) });
        }

        [HttpDelete("api/admin/tournament/editions/{editionId}/appearance/{kind}")]
        [Authorize]
        public async Task<IActionResult> Remove(long editionId, string kind)
        {
            if (kind is not ("logo" or "banner")) return NotFound();
            var (edition, error) = await ResolveAsync(editionId, write: true);
            if (error != null) return error;

            var old = kind == "logo" ? edition!.LogoUrl : edition!.BannerUrl;
            if (kind == "logo") edition.LogoUrl = null; else edition.BannerUrl = null;
            edition.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            DeleteOwnFile(editionId, old);
            return Ok(new { success = true, appearance = ToDto(edition) });
        }

        /// <summary>Solo borra archivos propios (los que se subieron aca), nunca una URL externa.</summary>
        private void DeleteOwnFile(long editionId, string? url)
        {
            var prefix = $"/api/public/tournament/assets/{editionId}/";
            if (string.IsNullOrEmpty(url) || !url.StartsWith(prefix)) return;
            var path = Path.Combine(AssetsPath, editionId.ToString(), Path.GetFileName(url));
            try { if (System.IO.File.Exists(path)) System.IO.File.Delete(path); } catch { /* queda huerfano, no pasa nada */ }
        }

        /// <summary>Logos y portadas de los torneos: publicos y con nombre unico, se cachean mucho.</summary>
        [HttpGet("api/public/tournament/assets/{editionId:long}/{file}")]
        [AllowAnonymous]
        public IActionResult Asset(long editionId, string file)
        {
            if (!Regex.IsMatch(file, "^(logo|banner)-[0-9a-f]{32}\\.webp$")) return NotFound();
            var path = Path.Combine(AssetsPath, editionId.ToString(), file);
            if (!System.IO.File.Exists(path)) return NotFound();
            Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            return PhysicalFile(path, "image/webp");
        }
    }
}
