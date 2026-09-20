using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Services.Desktop;
using Decatron.Services.GameData.LolLive;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Coach de LoL: ajustes por canal y estado en vivo (fase del cliente, últimos
    /// comentarios). Plan: .dev/plans/LOL_COACH_PLAN.md
    /// </summary>
    [ApiController]
    [Route("api/lol-coach")]
    [Authorize]
    public class LolCoachController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly LolLiveStateStore _live;
        private readonly LolCoachBrain _brain;
        private readonly DesktopConnectionRegistry _desktop;

        public LolCoachController(DecatronDbContext db, LolLiveStateStore live, LolCoachBrain brain, DesktopConnectionRegistry desktop)
        {
            _db = db; _live = live; _brain = brain; _desktop = desktop;
        }

        public record SettingsDto(
            bool Enabled,
            [MaxLength(40)] string CoachName,
            string Tone,
            bool CommentPicks,
            bool PostGameSummary,
            bool ShowOnOverlay,
            [MaxLength(400)] string? ChampPool,
            [MaxLength(600)] string? Notes);

        private static object ToDto(LolCoachSettings s) => new
        {
            s.Enabled, s.CoachName, s.Tone, s.CommentPicks, s.PostGameSummary, s.ShowOnOverlay, s.ChampPool, s.Notes,
        };

        [HttpGet("settings")]
        [RequirePermission("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var userId = GetChannelOwnerId();
            var s = await _db.LolCoachSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId) ?? new LolCoachSettings { UserId = userId };
            var linked = await LinkedCountAsync(userId);
            return Ok(new
            {
                settings = ToDto(s),
                aiAvailable = _brain.IsAvailable,
                linkedAccounts = linked,
                desktopConnected = _desktop.CountFor(userId) > 0,
                tones = new[] { "analyst", "hype", "troll" },
            });
        }

        [HttpPut("settings")]
        [RequirePermission("settings", "control_total")]
        public async Task<IActionResult> UpdateSettings([FromBody] SettingsDto dto)
        {
            var userId = GetChannelOwnerId();
            var s = await _db.LolCoachSettings.FirstOrDefaultAsync(x => x.UserId == userId);
            if (s == null) { s = new LolCoachSettings { UserId = userId }; _db.LolCoachSettings.Add(s); }
            s.Enabled = dto.Enabled;
            s.CoachName = string.IsNullOrWhiteSpace(dto.CoachName) ? "Coach" : dto.CoachName.Trim();
            s.Tone = dto.Tone is "analyst" or "hype" or "troll" ? dto.Tone : "analyst";
            s.CommentPicks = dto.CommentPicks;
            s.PostGameSummary = dto.PostGameSummary;
            s.ShowOnOverlay = dto.ShowOnOverlay;
            s.ChampPool = (dto.ChampPool ?? "").Trim();
            s.Notes = (dto.Notes ?? "").Trim();
            s.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _desktop.NotifyModuleChangedAsync(userId, LolCoachDesktopChannel.ChannelName);
            return Ok(ToDto(s));
        }

        /// <summary>Fase actual del cliente (si el Desktop está conectado) y últimos comentarios del coach.</summary>
        [HttpGet("state")]
        [RequirePermission("settings")]
        public IActionResult GetState()
        {
            var userId = GetChannelOwnerId();
            var e = _live.Get(userId);
            return Ok(new
            {
                desktopConnected = _desktop.CountFor(userId) > 0,
                clientConnected = e?.Puuid != null,
                summoner = e?.SummonerName,
                phase = e?.Phase,
                history = e?.CoachHistory.AsEnumerable().Reverse().Take(10) ?? Enumerable.Empty<LiveCoachInfo>(),
                callsThisSelect = e?.CoachCalls ?? 0,
                maxCallsPerSelect = LolCoachBrain.MaxCallsPerChampSelect,
            });
        }

        private async Task<int> LinkedCountAsync(long userId)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return 0;
            var accountId = user.AccountId ?? user.Id;
            return await _db.LinkedGameAccounts.CountAsync(a => a.AccountId == accountId && a.IsActive && a.Game == GameIds.Lol);
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(claim, out var id)) return id;
            throw new UnauthorizedAccessException("User not found");
        }

        private long GetChannelOwnerId()
        {
            var session = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(session) && long.TryParse(session, out var sid)) return sid;
            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var cid)) return cid;
            return GetUserId();
        }
    }
}
