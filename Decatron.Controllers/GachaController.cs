using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Decatron.Attributes;
using Decatron.Core.Models.Gacha;
using Decatron.Services;
using Decatron.Data;
using System.Security.Claims;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/gacha")]
    [Authorize]
    public class GachaController : ControllerBase
    {
        private readonly IGachaService _gachaService;
        private readonly ILogger<GachaController> _logger;
        private readonly DecatronDbContext _context;

        public GachaController(IGachaService gachaService, ILogger<GachaController> logger, DecatronDbContext context)
        {
            _gachaService = gachaService;
            _logger = logger;
            _context = context;
        }

        private async Task<(long channelOwnerId, string channelName)?> GetActiveChannelContext()
        {
            try
            {
                long channelOwnerId;

                var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
                if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                    channelOwnerId = sessionId;
                else
                {
                    var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
                    if (!string.IsNullOrEmpty(channelOwnerIdClaim) && long.TryParse(channelOwnerIdClaim, out var claimId))
                        channelOwnerId = claimId;
                    else
                    {
                        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (!long.TryParse(userIdClaim, out var userId)) return null;
                        channelOwnerId = userId;
                    }
                }

                var channel = await _context.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .Select(u => new { u.Login })
                    .FirstOrDefaultAsync();

                return channel == null ? null : (channelOwnerId, channel.Login.ToLower());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo contexto del canal activo");
                return null;
            }
        }

        // ========================================================================
        // ITEMS CRUD
        // ========================================================================

        [HttpGet("items")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetItems()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var items = await _gachaService.GetItemsAsync(ctx.Value.channelName);
            return Ok(new { success = true, items });
        }

        [HttpPost("items")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> CreateItem([FromBody] GachaItemDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var item = new GachaItem
            {
                ChannelName = ctx.Value.channelName,
                UserId = ctx.Value.channelOwnerId,
                Name = dto.Name,
                Rarity = dto.Rarity,
                Image = dto.Image,
                Available = dto.Available
            };

            var created = await _gachaService.CreateItemAsync(item);
            return Ok(new { success = true, item = created });
        }

        [HttpPut("items/{id:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> UpdateItem(int id, [FromBody] GachaItemDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var item = new GachaItem
                {
                    Id = id,
                    ChannelName = ctx.Value.channelName,
                    UserId = ctx.Value.channelOwnerId,
                    Name = dto.Name,
                    Rarity = dto.Rarity,
                    Image = dto.Image,
                    Available = dto.Available
                };
                var updated = await _gachaService.UpdateItemAsync(item);
                return Ok(new { success = true, item = updated });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Item no encontrado" }); }
        }

        [HttpDelete("items/{id:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> DeleteItem(int id)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.DeleteItemAsync(id, ctx.Value.channelName);
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Item no encontrado" }); }
        }

        // ========================================================================
        // RESTRICTIONS CRUD
        // ========================================================================

        [HttpGet("restrictions")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetRestrictions()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var restrictions = await _gachaService.GetRestrictionsAsync(ctx.Value.channelName);
            return Ok(new { success = true, restrictions });
        }

        [HttpPost("restrictions")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> CreateRestriction([FromBody] GachaRestrictionDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var restriction = new GachaItemRestriction
            {
                ChannelName = ctx.Value.channelName,
                UserId = ctx.Value.channelOwnerId,
                ItemId = dto.ItemId,
                MinDonationRequired = dto.MinDonationRequired,
                TotalQuantity = dto.TotalQuantity,
                IsUnique = dto.IsUnique,
                CooldownPeriod = dto.CooldownPeriod ?? "none",
                CooldownValue = dto.CooldownValue,
                AllowedPullTypes = dto.AllowedPullTypes ?? "all",
                CoinMinSpent = dto.CoinMinSpent,
                CumulativeDonationThreshold = dto.CumulativeDonationThreshold,
                CumulativeCoinsThreshold = dto.CumulativeCoinsThreshold,
                CumulativeGuarantee = dto.CumulativeGuarantee,
                CumulativeProbability = dto.CumulativeProbability,
                MilestonePriority = dto.MilestonePriority
            };

            var created = await _gachaService.CreateRestrictionAsync(restriction);
            return Ok(new { success = true, restriction = created });
        }

        [HttpPut("restrictions/{id:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> UpdateRestriction(int id, [FromBody] GachaRestrictionDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var restriction = new GachaItemRestriction
                {
                    Id = id,
                    ChannelName = ctx.Value.channelName,
                    UserId = ctx.Value.channelOwnerId,
                    MinDonationRequired = dto.MinDonationRequired,
                    TotalQuantity = dto.TotalQuantity,
                    IsUnique = dto.IsUnique,
                    CooldownPeriod = dto.CooldownPeriod ?? "none",
                    CooldownValue = dto.CooldownValue,
                    AllowedPullTypes = dto.AllowedPullTypes ?? "all",
                    CoinMinSpent = dto.CoinMinSpent,
                    CumulativeDonationThreshold = dto.CumulativeDonationThreshold,
                    CumulativeCoinsThreshold = dto.CumulativeCoinsThreshold,
                    CumulativeGuarantee = dto.CumulativeGuarantee,
                    CumulativeProbability = dto.CumulativeProbability,
                    MilestonePriority = dto.MilestonePriority
                };
                var updated = await _gachaService.UpdateRestrictionAsync(restriction);
                return Ok(new { success = true, restriction = updated });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Restriccion no encontrada" }); }
        }

        [HttpPut("restrictions/reorder-milestones")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> ReorderMilestones([FromBody] List<int> orderedIds)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            await _gachaService.ReorderMilestonesAsync(ctx.Value.channelName, orderedIds);
            return Ok(new { success = true });
        }

        [HttpDelete("restrictions/{id:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> DeleteRestriction(int id)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.DeleteRestrictionAsync(id, ctx.Value.channelName);
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Restriccion no encontrada" }); }
        }

        // ========================================================================
        // PREFERENCES CRUD
        // ========================================================================

        [HttpGet("preferences")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetPreferences()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var preferences = await _gachaService.GetPreferencesAsync(ctx.Value.channelName);
            return Ok(new { success = true, preferences });
        }

        [HttpPost("preferences")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> CreatePreference([FromBody] GachaPreferenceDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var preference = new GachaPreference
                {
                    ChannelName = ctx.Value.channelName,
                    UserId = ctx.Value.channelOwnerId,
                    ItemId = dto.ItemId,
                    ParticipantId = dto.ParticipantId,
                    ProbabilityPercentage = dto.ProbabilityPercentage,
                    CoinProbabilityOverride = dto.CoinProbabilityOverride,
                    IsActive = dto.IsActive
                };
                var created = await _gachaService.CreatePreferenceAsync(preference);
                return Ok(new { success = true, preference = created });
            }
            catch (ArgumentException ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        [HttpPut("preferences/{id:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> UpdatePreference(int id, [FromBody] GachaPreferenceDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var preference = new GachaPreference
                {
                    Id = id,
                    ChannelName = ctx.Value.channelName,
                    UserId = ctx.Value.channelOwnerId,
                    ProbabilityPercentage = dto.ProbabilityPercentage,
                    CoinProbabilityOverride = dto.CoinProbabilityOverride,
                    IsActive = dto.IsActive
                };
                var updated = await _gachaService.UpdatePreferenceAsync(preference);
                return Ok(new { success = true, preference = updated });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Preferencia no encontrada" }); }
        }

        [HttpDelete("preferences/{id:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> DeletePreference(int id)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.DeletePreferenceAsync(id, ctx.Value.channelName);
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Preferencia no encontrada" }); }
        }

        // ========================================================================
        // RARITY CONFIG
        // ========================================================================

        [HttpGet("rarity-config")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetRarityConfig()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var configs = await _gachaService.GetRarityConfigsAsync(ctx.Value.channelName);
            return Ok(new { success = true, configs });
        }

        [HttpPost("rarity-config")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> UpdateRarityConfig([FromBody] List<GachaRarityConfigDto> dtos)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var configs = dtos.Select(d => new GachaRarityConfig { Rarity = d.Rarity, Probability = d.Probability, CoinProbability = d.CoinProbability, ChannelName = ctx.Value.channelName, UserId = ctx.Value.channelOwnerId }).ToList();
                await _gachaService.UpdateRarityConfigsAsync(ctx.Value.channelName, configs);
                return Ok(new { success = true, message = "Probabilidades actualizadas" });
            }
            catch (ArgumentException ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        // ========================================================================
        // RARITY RESTRICTIONS
        // ========================================================================

        [HttpGet("rarity-restrictions")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetRarityRestrictions()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var restrictions = await _gachaService.GetRarityRestrictionsAsync(ctx.Value.channelName);
            return Ok(new { success = true, restrictions });
        }

        [HttpPost("rarity-restrictions")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> CreateRarityRestriction([FromBody] GachaRarityRestrictionDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var restriction = new GachaRarityRestriction
            {
                ChannelName = ctx.Value.channelName,
                UserId = ctx.Value.channelOwnerId,
                ItemId = dto.ItemId,
                ParticipantId = dto.ParticipantId,
                Rarity = dto.Rarity,
                PullInterval = dto.PullInterval,
                TimeInterval = dto.TimeInterval,
                TimeUnit = dto.TimeUnit,
                CoinPullInterval = dto.CoinPullInterval,
                CoinTimeInterval = dto.CoinTimeInterval,
                CoinTimeUnit = dto.CoinTimeUnit,
                IsActive = dto.IsActive
            };
            var created = await _gachaService.CreateRarityRestrictionAsync(restriction);
            return Ok(new { success = true, restriction = created });
        }

        [HttpDelete("rarity-restrictions/{id:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> DeleteRarityRestriction(int id)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.DeleteRarityRestrictionAsync(id, ctx.Value.channelName);
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Restriccion no encontrada" }); }
        }

        // ========================================================================
        // BANNERS
        // ========================================================================

        [HttpGet("banners")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetBanners()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var banners = await _gachaService.GetBannersAsync(ctx.Value.channelName);
            return Ok(new { success = true, banners });
        }

        [HttpPost("banners")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> CreateBanner([FromBody] GachaBannerDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var banner = new GachaBanner { ChannelName = ctx.Value.channelName, UserId = ctx.Value.channelOwnerId, BannerUrl = dto.BannerUrl };
                var created = await _gachaService.CreateBannerAsync(banner);
                return Ok(new { success = true, banner = created });
            }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        [HttpPost("banners/{id:int}/activate")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> ActivateBanner(int id)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            await _gachaService.SetActiveBannerAsync(id, ctx.Value.channelName);
            return Ok(new { success = true });
        }

        [HttpDelete("banners/{id:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> DeleteBanner(int id)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.DeleteBannerAsync(id, ctx.Value.channelName);
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Banner no encontrado" }); }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        // ========================================================================
        // OVERLAY CONFIG
        // ========================================================================

        [HttpGet("overlay-config")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetOverlayConfig()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var config = await _gachaService.GetOverlayConfigAsync(ctx.Value.channelName);
            return Ok(new { success = true, config, channelName = ctx.Value.channelName });
        }

        [HttpPost("overlay-config")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> SaveOverlayConfig([FromBody] GachaOverlayConfigDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var config = new GachaOverlayConfig
            {
                ChannelName = ctx.Value.channelName,
                UserId = ctx.Value.channelOwnerId,
                OverlaySize = dto.OverlaySize ?? "standard",
                CustomWidth = dto.CustomWidth,
                CustomHeight = dto.CustomHeight,
                AnimationSpeed = dto.AnimationSpeed,
                EnableDebug = dto.EnableDebug,
                EnableSounds = dto.EnableSounds
            };
            var saved = await _gachaService.SaveOverlayConfigAsync(config);
            return Ok(new { success = true, config = saved });
        }

        // ========================================================================
        // SOUND CONFIG
        // ========================================================================

        [HttpGet("sound-config")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetSoundConfig()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var config = await _gachaService.GetSoundConfigAsync(ctx.Value.channelName);
            return Ok(new { success = true, config });
        }

        [HttpPost("sound-config")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> SaveSoundConfig([FromBody] GachaSoundConfigDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var config = new GachaSoundConfig
            {
                ChannelName = ctx.Value.channelName,
                UserId = ctx.Value.channelOwnerId,
                MasterVolume = Math.Clamp(dto.MasterVolume, 0, 100),
                EnableSounds = dto.EnableSounds,
                SoundsJson = dto.SoundsJson ?? "{}"
            };
            var saved = await _gachaService.SaveSoundConfigAsync(config);
            return Ok(new { success = true, config = saved });
        }

        // ========================================================================
        // PARTICIPANTS & DONATIONS
        // ========================================================================

        [HttpGet("participants")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetParticipants()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var participants = await _gachaService.GetParticipantsAsync(ctx.Value.channelName);
            return Ok(new { success = true, participants });
        }

        [HttpPost("donations")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> AddDonation([FromBody] GachaDonationDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var participant = await _gachaService.AddDonationAsync(ctx.Value.channelName, dto.ParticipantName, dto.Amount, dto.TwitchUserId);
                return Ok(new { success = true, participant });
            }
            catch (ArgumentException ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        // ========================================================================
        // DISPLAY NAME
        // ========================================================================

        [HttpPut("participants/{participantId:int}/display-name")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> UpdateDisplayName(int participantId, [FromBody] DisplayNameDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.UpdateDisplayNameAsync(participantId, ctx.Value.channelName, dto.DisplayName);
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
        }

        [HttpDelete("participants/{participantId:int}/display-name")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> ResetDisplayName(int participantId)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.UpdateDisplayNameAsync(participantId, ctx.Value.channelName, null);
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
        }

        // ========================================================================
        // COMMAND CONFIGS
        // ========================================================================

        [HttpGet("command-configs")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetCommandConfigs()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var configs = await _gachaService.GetCommandConfigsAsync(ctx.Value.channelName);
            return Ok(new { success = true, configs });
        }

        [HttpPut("command-configs/{command}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> UpdateCommandConfig(string command, [FromBody] GachaCommandConfigDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var config = new GachaCommandConfig
                {
                    ChannelName = ctx.Value.channelName,
                    UserId = ctx.Value.channelOwnerId,
                    Enabled = dto.Enabled,
                    Permission = dto.Permission ?? "everyone",
                    CooldownGlobal = dto.CooldownGlobal,
                    CooldownUser = dto.CooldownUser,
                    CustomResponse = dto.CustomResponse
                };
                var updated = await _gachaService.UpdateCommandConfigAsync(ctx.Value.channelName, command, config);
                return Ok(new { success = true, config = updated });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
        }

        [HttpGet("command-aliases")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetCommandAliases()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var aliases = await _gachaService.GetCommandAliasesAsync(ctx.Value.channelName);
            return Ok(new { success = true, aliases });
        }

        [HttpPost("command-aliases")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> CreateCommandAlias([FromBody] GachaCommandAliasDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var alias = await _gachaService.CreateCommandAliasAsync(ctx.Value.channelName, dto.Alias, dto.TargetCommand);
                return Ok(new { success = true, alias });
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            { return BadRequest(new { success = false, message = ex.Message }); }
        }

        [HttpDelete("command-aliases/{alias}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> DeleteCommandAlias(string alias)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.DeleteCommandAliasAsync(ctx.Value.channelName, alias);
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
        }

        // ========================================================================
        // PULL
        // ========================================================================

        [HttpPost("pull")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> PerformPull([FromBody] GachaPullDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                var pullType = dto.PullType == "coins" ? "coins" : "donation";
                var result = await _gachaService.PerformPullAsync(ctx.Value.channelName, dto.ParticipantId, pullType);
                return Ok(new
                {
                    success = true,
                    result = new
                    {
                        result.Item.Id,
                        result.Item.Name,
                        result.Item.Rarity,
                        result.Item.Image
                    },
                    participant = new
                    {
                        result.Participant.Id,
                        result.Participant.Name,
                        result.Participant.DonationAmount,
                        result.Participant.Pulls,
                        result.Participant.EffectiveDonation,
                        result.Participant.CoinPullsAvailable,
                        result.Participant.CoinsSpentTotal,
                        result.Participant.DisplayName
                    },
                    pullsRemaining = result.PullsRemaining,
                    pullType = result.PullType
                });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        // ========================================================================
        // COLLECTION / INVENTORY
        // ========================================================================

        [HttpGet("inventory/{participantId:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetInventory(int participantId)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var inventory = await _gachaService.GetInventoryAsync(ctx.Value.channelName, participantId);
            return Ok(new { success = true, inventory });
        }

        [HttpGet("stats/{participantId:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetCollectionStats(int participantId)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var stats = await _gachaService.GetCollectionStatsAsync(ctx.Value.channelName, participantId);
            return Ok(new { success = true, stats });
        }

        [HttpPost("redeem/{inventoryId:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> RedeemItem(int inventoryId)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            try
            {
                await _gachaService.RedeemItemAsync(inventoryId, ctx.Value.channelName);
                return Ok(new { success = true, message = "Item canjeado" });
            }
            catch (KeyNotFoundException) { return NotFound(new { success = false, message = "Item no encontrado" }); }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        // ========================================================================
        // PULL LOGS
        // ========================================================================

        [HttpGet("logs/{participantId:int}")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetPullLogs(int participantId, [FromQuery] int limit = 50)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var logs = await _gachaService.GetPullLogsAsync(ctx.Value.channelName, participantId, Math.Min(limit, 200));
            return Ok(new { success = true, logs });
        }

        // ========================================================================
        // INTEGRATION CONFIG
        // ========================================================================

        [HttpGet("integration-config")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetIntegrationConfig()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var config = await _gachaService.GetIntegrationConfigAsync(ctx.Value.channelName);
            return Ok(new { success = true, config, channelName = ctx.Value.channelName });
        }

        [HttpPost("integration-config")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> SaveIntegrationConfig([FromBody] GachaIntegrationConfigDto dto)
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var config = new Decatron.Core.Models.Gacha.GachaIntegrationConfig
            {
                ChannelName = ctx.Value.channelName,
                UserId = ctx.Value.channelOwnerId,
                TipsEnabled = dto.TipsEnabled,
                PullsPerDollar = dto.PullsPerDollar,
                BitsEnabled = dto.BitsEnabled,
                BitsPerPull = dto.BitsPerPull,
                SubsEnabled = dto.SubsEnabled,
                PullsSubPrime = dto.PullsSubPrime,
                PullsSubTier1 = dto.PullsSubTier1,
                PullsSubTier2 = dto.PullsSubTier2,
                PullsSubTier3 = dto.PullsSubTier3,
                GiftSubsEnabled = dto.GiftSubsEnabled,
                PullsPerGift = dto.PullsPerGift,
                CoinsEnabled = dto.CoinsEnabled,
                CoinsPerPull = dto.CoinsPerPull,
                MultiPullEnabled = dto.MultiPullEnabled,
                MultiPullMax = dto.MultiPullMax,
                MultiPullDelay = dto.MultiPullDelay
            };
            var saved = await _gachaService.SaveIntegrationConfigAsync(config);
            return Ok(new { success = true, config = saved });
        }

        // ========================================================================
        // MOST WISHED (for streamer dashboard)
        // ========================================================================

        [HttpGet("most-wished")]
        [RequirePermission("raffles")]
        public async Task<IActionResult> GetMostWished()
        {
            var ctx = await GetActiveChannelContext();
            if (!ctx.HasValue) return BadRequest(new { success = false, message = "Canal no encontrado" });

            var wished = await _context.GachaWishlists
                .Include(w => w.Item)
                .Include(w => w.Participant)
                .Where(w => w.Participant != null && w.Participant.ChannelName == ctx.Value.channelName)
                .GroupBy(w => new { w.ItemId, Name = w.Item != null ? w.Item.Name : "", Rarity = w.Item != null ? w.Item.Rarity : "common", Image = w.Item != null ? w.Item.Image : "" })
                .Select(g => new
                {
                    itemId = g.Key.ItemId,
                    name = g.Key.Name,
                    rarity = g.Key.Rarity,
                    image = g.Key.Image,
                    wishCount = g.Count(),
                    wishedBy = g.Select(w => w.Participant != null ? w.Participant.Name : "").ToList()
                })
                .OrderByDescending(x => x.wishCount)
                .Take(20)
                .ToListAsync();

            return Ok(new { success = true, items = wished });
        }
    }

    // ========================================================================
    // DTOs
    // ========================================================================

    public class GachaItemDto
    {
        public string Name { get; set; } = "";
        public string Rarity { get; set; } = "common";
        public string? Image { get; set; }
        public bool Available { get; set; } = true;
    }

    public class GachaRestrictionDto
    {
        public int ItemId { get; set; }
        public decimal MinDonationRequired { get; set; } = 0;
        public int? TotalQuantity { get; set; }
        public bool IsUnique { get; set; } = false;
        public string? CooldownPeriod { get; set; } = "none";
        public int CooldownValue { get; set; } = 0;
        public string AllowedPullTypes { get; set; } = "all";
        public int? CoinMinSpent { get; set; }
        public decimal? CumulativeDonationThreshold { get; set; }
        public int? CumulativeCoinsThreshold { get; set; }
        public bool CumulativeGuarantee { get; set; } = true;
        public decimal? CumulativeProbability { get; set; }
        public int MilestonePriority { get; set; } = 0;
    }

    public class GachaPreferenceDto
    {
        public int ItemId { get; set; }
        public int? ParticipantId { get; set; }
        public decimal ProbabilityPercentage { get; set; }
        public decimal? CoinProbabilityOverride { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class GachaRarityConfigDto
    {
        public string Rarity { get; set; } = "";
        public decimal Probability { get; set; }
        public decimal? CoinProbability { get; set; }
    }

    public class GachaRarityRestrictionDto
    {
        public int? ItemId { get; set; }
        public int? ParticipantId { get; set; }
        public string? Rarity { get; set; }
        public int? PullInterval { get; set; }
        public int? TimeInterval { get; set; }
        public string? TimeUnit { get; set; }
        public int? CoinPullInterval { get; set; }
        public int? CoinTimeInterval { get; set; }
        public string? CoinTimeUnit { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class GachaBannerDto
    {
        public string BannerUrl { get; set; } = "";
    }

    public class GachaOverlayConfigDto
    {
        public string? OverlaySize { get; set; } = "standard";
        public int? CustomWidth { get; set; }
        public int? CustomHeight { get; set; }
        public int AnimationSpeed { get; set; } = 10;
        public bool EnableDebug { get; set; } = false;
        public bool EnableSounds { get; set; } = false;
    }

    public class GachaIntegrationConfigDto
    {
        public bool TipsEnabled { get; set; } = false;
        public int PullsPerDollar { get; set; } = 1;
        public bool BitsEnabled { get; set; } = false;
        public int BitsPerPull { get; set; } = 100;
        public bool SubsEnabled { get; set; } = false;
        public int PullsSubPrime { get; set; } = 1;
        public int PullsSubTier1 { get; set; } = 2;
        public int PullsSubTier2 { get; set; } = 3;
        public int PullsSubTier3 { get; set; } = 5;
        public bool GiftSubsEnabled { get; set; } = false;
        public int PullsPerGift { get; set; } = 1;
        public bool CoinsEnabled { get; set; } = false;
        public int CoinsPerPull { get; set; } = 100;
        public bool MultiPullEnabled { get; set; } = true;
        public int MultiPullMax { get; set; } = 10;
        public int MultiPullDelay { get; set; } = 10;
    }

    public class GachaDonationDto
    {
        public string ParticipantName { get; set; } = "";
        public decimal Amount { get; set; }
        public string? TwitchUserId { get; set; }
    }

    public class GachaPullDto
    {
        public int ParticipantId { get; set; }
        public string PullType { get; set; } = "donation";
    }

    public class DisplayNameDto
    {
        public string? DisplayName { get; set; }
    }

    public class GachaCommandConfigDto
    {
        public bool Enabled { get; set; } = true;
        public string? Permission { get; set; } = "everyone";
        public int CooldownGlobal { get; set; } = 0;
        public int CooldownUser { get; set; } = 3;
        public string? CustomResponse { get; set; }
    }

    public class GachaCommandAliasDto
    {
        public string Alias { get; set; } = "";
        public string TargetCommand { get; set; } = "";
    }

    public class GachaSoundConfigDto
    {
        public int MasterVolume { get; set; } = 80;
        public bool EnableSounds { get; set; } = true;
        public string? SoundsJson { get; set; }
    }
}
