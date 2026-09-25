using System.Threading;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Services.SongRequest;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Song Request (.dev/plans/SONG_REQUEST_PLAN.md). Fase 0: resolver un link o texto,
    /// lo mismo que hará !sr y el "agregar" del dashboard.
    /// </summary>
    [ApiController]
    [Route("api/song-request")]
    [Authorize]
    public class SongRequestController : ControllerBase
    {
        private readonly SongResolverService _resolver;

        public SongRequestController(SongResolverService resolver)
        {
            _resolver = resolver;
        }

        [HttpGet("resolve")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Resolve([FromQuery] string input, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(input) || input.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });

            var result = await _resolver.ResolveAsync(input, ct);
            var origin = result.Origin == null ? null : new
            {
                source = result.Origin.Origin,
                url = result.Origin.Url,
                title = result.Origin.Title,
                artist = result.Origin.Artist,
                durationSeconds = result.Origin.DurationSeconds,
                thumbnailUrl = result.Origin.ThumbnailUrl
            };

            if (!result.Success)
                return Ok(new { success = false, error = ToCode(result.Error), origin });

            var track = result.Track!;
            return Ok(new
            {
                success = true,
                track = new
                {
                    source = track.Source,
                    sourceId = track.SourceId,
                    url = _resolver.GetSource(track.Source)?.GetPublicUrl(track.SourceId),
                    title = track.Title,
                    artist = track.Artist,
                    durationSeconds = track.DurationSeconds,
                    viewCount = track.ViewCount,
                    thumbnailUrl = track.ThumbnailUrl
                },
                origin
            });
        }

        /// <summary>snake_case para que el front lo use como clave de i18n.</summary>
        private static string ToCode(SongResolveError error) => error switch
        {
            SongResolveError.Unsupported => "unsupported",
            SongResolveError.InvalidLink => "invalid_link",
            SongResolveError.NotFound => "not_found",
            SongResolveError.Private => "private",
            SongResolveError.Live => "live",
            SongResolveError.Upcoming => "upcoming",
            SongResolveError.NotEmbeddable => "not_embeddable",
            SongResolveError.AgeRestricted => "age_restricted",
            SongResolveError.NoMatch => "no_match",
            SongResolveError.Blocked => "blocked",
            _ => "failed"
        };
    }
}
