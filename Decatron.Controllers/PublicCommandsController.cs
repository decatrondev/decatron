using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Decatron.Controllers
{
    [ApiController]
    public class PublicCommandsController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ICommandStateService _commandStateService;
        private readonly ICommandTranslationService _commandTranslationService;
        private readonly Decatron.Services.SongRequest.SongRequestService _songs;
        private readonly ILogger<PublicCommandsController> _logger;

        public PublicCommandsController(
            DecatronDbContext dbContext,
            ICommandStateService commandStateService,
            ICommandTranslationService commandTranslationService,
            Decatron.Services.SongRequest.SongRequestService songs,
            ILogger<PublicCommandsController> logger)
        {
            _dbContext = dbContext;
            _commandStateService = commandStateService;
            _commandTranslationService = commandTranslationService;
            _songs = songs;
            _logger = logger;
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
                return channelOwnerId;

            return GetUserId();
        }

        // ── Config (dashboard, autenticado) ─────────────────────────────────────

        [Authorize]
        [HttpGet("api/publiccommands/config")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var items = await BuildCommandListAsync(channelOwnerId, applyHiddenFilter: false);
                var channelInfo = await ChannelResolver.ResolveChannelInfoByIdAsync(_dbContext, channelOwnerId);
                return Ok(new { success = true, items, channel = channelInfo?.Login });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🌐 [PublicCommands] Error obteniendo config");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [Authorize]
        [HttpPost("api/publiccommands/config")]
        public async Task<IActionResult> SaveConfig([FromBody] List<PublicCommandOverrideDto> overrides)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();

                var existing = await _dbContext.PublicCommandOverrides
                    .Where(o => o.UserId == channelOwnerId)
                    .ToListAsync();
                _dbContext.PublicCommandOverrides.RemoveRange(existing);

                // Solo persistimos overrides que difieren del default (oculto o con descripción pública)
                var toSave = overrides
                    .Where(o => o.Hidden || !string.IsNullOrWhiteSpace(o.PublicDescription))
                    .Select(o => new PublicCommandOverride
                    {
                        UserId = channelOwnerId,
                        Category = o.Category,
                        CommandKey = o.CommandKey,
                        Hidden = o.Hidden,
                        PublicDescription = string.IsNullOrWhiteSpace(o.PublicDescription) ? null : o.PublicDescription,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    });

                await _dbContext.PublicCommandOverrides.AddRangeAsync(toSave);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation("🌐 [PublicCommands] Overrides guardados para canal {ChannelOwnerId}", channelOwnerId);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🌐 [PublicCommands] Error guardando config");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ── Vista pública (sin auth) ─────────────────────────────────────────────

        [HttpGet("api/public/commands/{channel}")]
        public async Task<IActionResult> GetPublicCommands(string channel)
        {
            try
            {
                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(_dbContext, channel);
                if (channelInfo == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var items = await BuildCommandListAsync(channelInfo.UserId, applyHiddenFilter: true);

                return Ok(new
                {
                    success = true,
                    channel = channelInfo.Login,
                    displayName = channelInfo.DisplayName,
                    items = items.Select(i => new
                    {
                        i.category,
                        i.name,
                        description = i.publicDescription ?? i.description,
                        i.restriction,
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🌐 [PublicCommands] Error obteniendo vista pública para {Channel}", channel);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ── Helper compartido ────────────────────────────────────────────────────

        private async Task<List<PublicCommandItemResult>> BuildCommandListAsync(long channelOwnerId, bool applyHiddenFilter)
        {
            var overrides = await _dbContext.PublicCommandOverrides
                .AsNoTracking()
                .Where(o => o.UserId == channelOwnerId)
                .ToListAsync();

            var overrideMap = overrides.ToDictionary(o => (o.Category, o.CommandKey));

            var results = new List<PublicCommandItemResult>();

            // Default commands
            var defaultMetadata = _commandTranslationService.GetAllDefaultCommandsMetadata("es");
            foreach (var meta in defaultMetadata)
            {
                var enabled = await _commandStateService.IsCommandEnabledAsync(channelOwnerId, meta.Name);
                if (!enabled) continue;

                AddItem(results, overrideMap, "default", meta.Name, meta.Name, meta.Description, null, applyHiddenFilter);
            }

            // Custom commands
            var customCommands = await _dbContext.CustomCommands
                .AsNoTracking()
                .Where(c => c.UserId == channelOwnerId && c.IsActive)
                .ToListAsync();
            foreach (var cmd in customCommands)
            {
                AddItem(results, overrideMap, "custom", cmd.Id.ToString(), cmd.CommandName, "", cmd.Restriction, applyHiddenFilter);
            }

            // Microcommands
            var microCommands = await _dbContext.MicroGameCommands
                .AsNoTracking()
                .Where(c => c.UserId == channelOwnerId)
                .ToListAsync();
            foreach (var cmd in microCommands)
            {
                AddItem(results, overrideMap, "microcommands", cmd.Id.ToString(), cmd.ShortCommand, cmd.CategoryName, null, applyHiddenFilter);
            }

            // Scripting
            var scripts = await _dbContext.ScriptedCommands
                .AsNoTracking()
                .Where(s => s.UserId == channelOwnerId && s.IsActive)
                .ToListAsync();
            foreach (var script in scripts)
            {
                AddItem(results, overrideMap, "scripting", script.Id.ToString(), script.CommandName, "", null, applyHiddenFilter);
            }

            await AddSongRequestItemsAsync(results, overrideMap, channelOwnerId, applyHiddenFilter);

            return results;
        }

        /// <summary>
        /// Los comandos de song request, solo si el módulo está activo. Kick vinculado usa la cola de su
        /// Twitch, así que se mira esa config. La restricción sale de los permisos que eligió el streamer.
        /// </summary>
        private async Task AddSongRequestItemsAsync(
            List<PublicCommandItemResult> results,
            Dictionary<(string Category, string CommandKey), PublicCommandOverride> overrideMap,
            long channelOwnerId, bool applyHiddenFilter)
        {
            var config = await _songs.GetConfigAsync(await _songs.GetQueueOwnerIdAsync(channelOwnerId));
            if (config == null || !config.Enabled)
                return;

            var settings = Decatron.Services.SongRequest.SongRequestService.ParseSettings(config);
            var permissions = settings.Permissions;
            var request = RoleRestriction(permissions.Request);
            var skip = RoleRestriction(permissions.Skip);
            var manage = RoleRestriction(permissions.Manage);
            var review = RoleRestriction(permissions.Review);
            var playlistLink = RoleRestriction(permissions.Playlist);

            var commands = new (string Name, string Description, string? Restriction)[]
            {
                ("sr", "Pide una canción con un link de YouTube, Spotify, SoundCloud, Deezer o Apple Music, o con el nombre (también !songrequest); !sr #12 pide a la cola la 12 de la playlist de fondo", request),
                ("wrongsong", "Quita de la cola tu último pedido", request),
                ("queue", "Muestra las próximas canciones y el link a la cola", request),
                ("song", "Muestra la canción que está sonando (también !currentsong)", request),
                ("myqueue", "Muestra en qué puesto están tus pedidos", request),
                ("skip", settings.SkipVoteEnabled
                    ? $"Salta la canción; los demás votan y se salta con {Math.Max(1, settings.SkipVotesRequired)} votos"
                    : "Salta la canción que está sonando (también !srskip y !srnext)",
                    settings.SkipVoteEnabled ? request : skip),
                ("srclear", "Vacía la cola de pedidos (el que suena sigue)", manage),
                ("lastsong", "Dice cuál fue la canción anterior (también !prevsong)", request),
                ("srremove", "Quita un pedido de la cola por su número (!srremove 3)", skip),
                ("sropen", "Abre los pedidos de canciones", manage),
                ("srclose", "Cierra los pedidos de canciones", manage),
                ("srpause", "Pausa la música (el overlay sigue a la vista)", manage),
                ("srstop", "Detiene la música y oculta el overlay; !srresume lo vuelve a mostrar y sigue donde se quedó", manage),
                ("srresume", "Vuelve a reproducir la música, tras una pausa o un stop", manage),
                ("srban", "Veta la canción que suena, o a un usuario con !srban @usuario", manage),
                ("srunban", "Le quita el veto a un usuario (!srunban @usuario)", manage),
                ("srvolume", "Dice el volumen de la música; los que administran lo cambian con !srvolume 40", request),
                ("srpromote", "Sube un pedido al primer lugar de la cola por su número (!srpromote 3)", skip),
                ("srvideo", "El reproductor muestra el video en vez de la portada", manage),
                ("srcover", "El reproductor muestra la portada en vez del video", manage),
                ("pladd", "Agrega una canción a una playlist del canal (!pladd <playlist> <link o nombre>); cada playlist decide quién puede", null),
                ("srmode", "Cambia el modo de pedidos: open (abiertos), playlists (solo de las playlists), review (con revisión) o closed (cerrados)", manage),
                ("pl", "Dice cuál es la playlist de fondo (la que suena sin pedidos) y qué número está sonando", request),
                ("playlist", "Da el enlace para escuchar las playlists públicas del canal (!playlist <nombre> da el de esa playlist)", playlistLink),
                ("plplay", "Pone una playlist de fondo (!plplay <playlist>) o salta a una canción de ella (!plplay #19); también !srplay", manage),
                ("plstop", "Para la playlist de fondo: con la cola vacía no suena nada", manage),
                ("plnext", "Pasa a la siguiente canción de la playlist de fondo (no salta pedidos)", skip),
                ("plshuffle", "La playlist de fondo al azar o en orden (!plshuffle on / off)", manage),
                ("srapprove", "Aprueba lo que espera revisión, por su número (!srapprove 2; sin número, el más viejo)", review),
                ("srreject", "Rechaza lo que espera revisión, por su número (!srreject 2; sin número, el más viejo)", review),
            };
            foreach (var (name, description, restriction) in commands)
                AddItem(results, overrideMap, "songrequest", name, name, description, restriction, applyHiddenFilter);
        }

        /// <summary>El rol mínimo de song request, con las mismas claves cortas que usa la vista pública.</summary>
        private static string? RoleRestriction(string role) => role switch
        {
            "subscriber" => "sub",
            "vip" => "vip",
            "moderator" => "mod",
            "lead_moderator" => "lead_mod",
            "broadcaster" => "streamer",
            _ => null
        };

        private static void AddItem(
            List<PublicCommandItemResult> results,
            Dictionary<(string Category, string CommandKey), PublicCommandOverride> overrideMap,
            string category, string commandKey, string name, string description, string? restriction,
            bool applyHiddenFilter)
        {
            overrideMap.TryGetValue((category, commandKey), out var over);
            var hidden = over?.Hidden ?? false;

            if (applyHiddenFilter && hidden) return;

            results.Add(new PublicCommandItemResult
            {
                category = category,
                commandKey = commandKey,
                name = name,
                description = description,
                restriction = restriction,
                hidden = hidden,
                publicDescription = over?.PublicDescription,
            });
        }
    }

    public class PublicCommandItemResult
    {
        public string category { get; set; } = "";
        public string commandKey { get; set; } = "";
        public string name { get; set; } = "";
        public string description { get; set; } = "";
        public string? restriction { get; set; }
        public bool hidden { get; set; }
        public string? publicDescription { get; set; }
    }

    public class PublicCommandOverrideDto
    {
        public string Category { get; set; } = "";
        public string CommandKey { get; set; } = "";
        public bool Hidden { get; set; }
        public string? PublicDescription { get; set; }
    }
}
