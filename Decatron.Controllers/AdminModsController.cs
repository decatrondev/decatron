using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Controllers.Extensions;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Admin → Mod en canales. Los streamers piden seguido que el bot (y el dueño de Decatron) sean mod
    /// en su canal; Twitch solo deja dar mod con el token del propio streamer, que el bot ya guarda.
    /// Solo el bot y el dueño que está usando admin: no se puede dar mod a otra persona desde acá.
    /// Solo Twitch por ahora. Cada cambio queda en admin_mod_actions.
    /// </summary>
    [ApiController]
    [Route("api/admin/mods")]
    [Authorize]
    [RequireSystemOwner]
    public class AdminModsController : ControllerBase
    {
        private const int MaxParallelChecks = 8;

        private readonly DecatronDbContext _db;
        private readonly TwitchApiService _twitch;
        private readonly TwitchSettings _twitchSettings;
        private readonly ILogger<AdminModsController> _logger;

        public AdminModsController(DecatronDbContext db, TwitchApiService twitch, IOptions<TwitchSettings> twitchSettings, ILogger<AdminModsController> logger)
        {
            _db = db;
            _twitch = twitch;
            _twitchSettings = twitchSettings.Value;
            _logger = logger;
        }

        private sealed record Account(string Id, string Login, string DisplayName);

        /// <summary>El bot y el dueño que está en admin, con sus ids de Twitch.</summary>
        private async Task<(Account? Bot, Account? Owner, long OwnerUserId)> GetTargetsAsync()
        {
            var ownerUserId = this.GetAuthenticatedUserId();
            var owner = await _db.Users.AsNoTracking()
                .Where(u => u.Id == ownerUserId && u.TwitchId != null && u.TwitchId != "")
                .Select(u => new Account(u.TwitchId!, u.Login, u.DisplayName))
                .FirstOrDefaultAsync();

            var botLogin = (_twitchSettings.BotUsername ?? "").ToLowerInvariant();
            var botData = string.IsNullOrEmpty(botLogin) ? null : await _twitch.GetUserByLoginAsync(botLogin);
            var bot = botData == null ? null : new Account(botData.id, botData.login, botData.display_name);
            return (bot, owner, ownerUserId);
        }

        /// <summary>Los canales de Twitch conectados, con si el bot y el dueño son mod en cada uno.</summary>
        [HttpGet("channels")]
        public async Task<IActionResult> GetChannels(CancellationToken ct)
        {
            var (bot, owner, _) = await GetTargetsAsync();
            if (bot == null || owner == null)
                return Ok(new { success = false, error = bot == null ? "bot_not_found" : "owner_without_twitch" });

            var channels = await _db.Users.AsNoTracking()
                .Where(u => u.IsActive && u.KickId == null && u.TwitchId != null && u.TwitchId != ""
                            && u.AccessToken != null && u.AccessToken != "")
                .OrderBy(u => u.Login)
                .Select(u => new { u.Id, u.TwitchId, u.Login, u.DisplayName, u.ProfileImageUrl, u.TokenExpiration })
                .ToListAsync(ct);

            using var gate = new SemaphoreSlim(MaxParallelChecks);
            var rows = await Task.WhenAll(channels.Select(async c =>
            {
                var isOwnChannel = c.TwitchId == owner.Id;
                var isBotChannel = c.TwitchId == bot.Id;
                string? error = null;
                bool? botIsMod = null, ownerIsMod = null;

                if (c.TokenExpiration < DateTime.UtcNow)
                {
                    error = "token_expired";
                }
                else
                {
                    await gate.WaitAsync(ct);
                    try
                    {
                        var result = await _twitch.GetModeratorsAmongAsync(c.TwitchId!, new[] { bot.Id, owner.Id });
                        if (result.Success)
                        {
                            botIsMod = result.ModeratorIds.Contains(bot.Id);
                            ownerIsMod = result.ModeratorIds.Contains(owner.Id);
                        }
                        else
                        {
                            error = result.Error;
                        }
                    }
                    finally
                    {
                        gate.Release();
                    }
                }

                return new
                {
                    userId = c.Id,
                    login = c.Login,
                    displayName = c.DisplayName,
                    avatarUrl = c.ProfileImageUrl,
                    // En su propio canal no hace falta ser mod: el broadcaster ya tiene todo
                    botIsMod = isBotChannel ? (bool?)null : botIsMod,
                    ownerIsMod = isOwnChannel ? (bool?)null : ownerIsMod,
                    isOwnChannel,
                    isBotChannel,
                    error
                };
            }));

            return Ok(new
            {
                success = true,
                bot = new { login = bot.Login, displayName = bot.DisplayName },
                owner = new { login = owner.Login, displayName = owner.DisplayName },
                channels = rows
            });
        }

        public sealed class SetModRequest
        {
            /// <summary>bot | owner</summary>
            public string Target { get; set; } = "";
            /// <summary>add | remove</summary>
            public string Action { get; set; } = "";
        }

        [HttpPost("channels/{userId:long}")]
        public async Task<IActionResult> SetMod(long userId, [FromBody] SetModRequest body, CancellationToken ct)
        {
            if (body.Target is not ("bot" or "owner") || body.Action is not ("add" or "remove"))
                return BadRequest(new { success = false, error = "invalid_request" });

            var (bot, owner, ownerUserId) = await GetTargetsAsync();
            if (bot == null || owner == null)
                return Ok(new { success = false, error = bot == null ? "bot_not_found" : "owner_without_twitch" });

            var channel = await _db.Users.AsNoTracking()
                .Where(u => u.Id == userId && u.IsActive && u.KickId == null && u.TwitchId != null && u.TwitchId != "")
                .Select(u => new { u.Id, u.TwitchId, u.Login })
                .FirstOrDefaultAsync(ct);
            if (channel == null)
                return NotFound(new { success = false, error = "channel_not_found" });

            var target = body.Target == "bot" ? bot : owner;
            if (channel.TwitchId == target.Id)
                return Ok(new { success = false, error = "own_channel" });

            var add = body.Action == "add";
            var result = await _twitch.SetModeratorAsync(channel.TwitchId!, target.Id, add);
            // Pedir lo que ya estaba (dar mod a quien ya es mod) no es un fallo
            var success = result.Success || (add ? result.Error == "already_mod" : result.Error == "not_mod");

            _db.AdminModActions.Add(new AdminModAction
            {
                ChannelUserId = channel.Id,
                ChannelLogin = channel.Login,
                Target = body.Target,
                TargetLogin = target.Login,
                Action = body.Action,
                Success = success,
                Error = success ? null : result.Error,
                AdminUserId = ownerUserId,
                AdminLogin = owner.Login,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("[AdminMods] {Admin} {Action} mod a {Target} en {Channel}: {Result}",
                owner.Login, add ? "dio" : "quitó", target.Login, channel.Login, success ? "ok" : result.Error);

            return Ok(new { success, error = success ? null : result.Error });
        }

        /// <summary>Los últimos cambios hechos desde admin.</summary>
        [HttpGet("log")]
        public async Task<IActionResult> GetLog([FromQuery] int limit = 50, CancellationToken ct = default)
        {
            var items = await _db.AdminModActions.AsNoTracking()
                .OrderByDescending(a => a.CreatedAt)
                .Take(Math.Clamp(limit, 1, 200))
                .Select(a => new
                {
                    a.Id, a.ChannelLogin, a.Target, a.TargetLogin, a.Action, a.Success, a.Error, a.AdminLogin, a.CreatedAt
                })
                .ToListAsync(ct);
            return Ok(new { success = true, items });
        }
    }
}
