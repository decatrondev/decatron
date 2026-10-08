using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services.Accounts;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Decatron.Services
{
    public class SoundAlertTriggerService : ISoundAlertTriggerService
    {
        private readonly DecatronDbContext _db;
        private readonly IHubContext<OverlayHub> _hubContext;
        private readonly AccountChannelResolver _accounts;
        private readonly ILogger<SoundAlertTriggerService> _logger;

        public SoundAlertTriggerService(DecatronDbContext db, IHubContext<OverlayHub> hubContext, AccountChannelResolver accounts, ILogger<SoundAlertTriggerService> logger)
        {
            _db = db;
            _hubContext = hubContext;
            _accounts = accounts;
            _logger = logger;
        }

        /// <summary>
        /// Grupo v2 de la cuenta. El overlay nuevo se une solo a este (con JoinChannel("v2:" + clave)) y filtra por
        /// plataforma; el prefijo "v2:" no puede ser parte de un login, así que no choca con ningún canal.
        /// </summary>
        public static string V2Group(string overlayKey) => $"overlay_{V2Key(overlayKey)}";

        /// <summary>Lo que el overlay pasa a JoinChannel y a RegisterOverlay (el hub le antepone "overlay_" al grupo)</summary>
        public static string V2Key(string overlayKey) => $"v2:{overlayKey}";

        /// <summary>
        /// Emite al grupo de siempre y al v2 de la cuenta, en dos envíos separados: una conexión está en uno solo de los
        /// dos, así que nunca recibe el aviso dos veces (SignalR sí duplicaría con una lista de grupos).
        /// </summary>
        private async Task EmitAsync(long channelUserId, string legacyKey, string method, params object[] args)
        {
            await _hubContext.Clients.Group($"overlay_{legacyKey}").SendCoreAsync(method, args);
            var account = await _accounts.ResolveByUserIdAsync(channelUserId);
            if (account != null)
                await _hubContext.Clients.Group(V2Group(account.OverlayKey)).SendCoreAsync(method, args);
        }

        public async Task SendAlertAsync(long channelUserId, string legacyKey, object alertData)
        {
            var node = JsonSerializer.SerializeToNode(alertData) as JsonObject ?? new JsonObject();
            if (node["id"] == null) node["id"] = Guid.NewGuid().ToString("N");
            if (node["platform"] == null) node["platform"] = await PlatformOfAsync(channelUserId);
            await EmitAsync(channelUserId, legacyKey, "ShowSoundAlert", node);
        }

        public Task NotifyConfigChangedAsync(long channelUserId, string legacyKey) =>
            EmitAsync(channelUserId, legacyKey, "ConfigurationChanged");

        /// <summary>De qué plataforma es el canal que recibió el canje: lo filtra cada overlay según su variante (todo / twitch / kick)</summary>
        private async Task<string> PlatformOfAsync(long channelUserId)
        {
            var account = await _accounts.ResolveByUserIdAsync(channelUserId);
            var origin = account?.Members.FirstOrDefault(m => m.UserId == channelUserId);
            return origin?.Platform == "kick" ? "kick" : "twitch";
        }

        public async Task TriggerAsync(SoundAlertRedemption redemption)
        {
            try
            {
                var mapping = await _db.SoundAlertRewardFiles
                    .Include(m => m.MediaFile)
                    .FirstOrDefaultAsync(m => m.UserId == redemption.ChannelUserId && m.RewardId == redemption.RewardId);

                if (mapping == null)
                {
                    _logger.LogInformation("[SoundAlerts] No hay archivo configurado para reward {RewardId} en canal {ChannelUserId}", redemption.RewardId, redemption.ChannelUserId);
                    await RegistrarHistorialAsync(redemption, null, false, "No hay archivo configurado");
                    return;
                }

                if (!mapping.Enabled)
                {
                    await RegistrarHistorialAsync(redemption, mapping.MediaFile?.FilePath ?? mapping.SystemFilePath, false, "Alerta deshabilitada");
                    return;
                }

                var config = await _db.SoundAlertConfigs.FirstOrDefaultAsync(c => c.UserId == redemption.ChannelUserId);

                if (config != null && !config.GlobalEnabled)
                {
                    await RegistrarHistorialAsync(redemption, mapping.MediaFile?.FilePath ?? mapping.SystemFilePath, false, "Sistema deshabilitado");
                    return;
                }

                var (fileUrl, fileType, imageUrl) = BuildUrls(mapping);

                var alertData = new
                {
                    type = "soundalert",
                    // Id único del aviso: el overlay descarta uno que ya reprodujo (protección contra el doble sonido)
                    id = Guid.NewGuid().ToString("N"),
                    platform = await PlatformOfAsync(redemption.ChannelUserId),
                    redeemer = redemption.RedeemerUsername,
                    reward = redemption.RewardTitle,
                    fileUrl,
                    fileType,
                    imageUrl,
                    showImage = mapping.ShowImage,
                    volume = mapping.Volume ?? config?.GlobalVolume ?? 70,
                    duration = config?.Duration ?? 10,
                    textLines = config?.TextLines ?? "[]",
                    styles = config?.Styles ?? "{}",
                    layout = config?.Layout ?? "{}",
                    animation = new
                    {
                        type = config?.AnimationType ?? "fade",
                        speed = config?.AnimationSpeed ?? "normal"
                    },
                    textOutline = new
                    {
                        enabled = config?.TextOutlineEnabled ?? false,
                        color = config?.TextOutlineColor ?? "#000000",
                        width = config?.TextOutlineWidth ?? 2
                    }
                };

                // Al grupo de siempre (idéntico a antes, para los overlays que ya están puestos en OBS) y al grupo v2 de la
                // cuenta (el overlay nuevo, que filtra por plataforma). Nunca una lista de grupos: ver EmitAsync.
                await EmitAsync(redemption.ChannelUserId, redemption.OverlayGroupKey, "ShowSoundAlert", alertData);

                if (mapping.MediaFile != null)
                {
                    mapping.MediaFile.UsageCount += 1;
                    mapping.MediaFile.UpdatedAt = DateTime.UtcNow;
                }
                await _db.SaveChangesAsync();

                _logger.LogInformation("✅ [SoundAlerts] Alerta enviada para canal {ChannelUserId} — Reward: {RewardTitle}", redemption.ChannelUserId, redemption.RewardTitle);
                await RegistrarHistorialAsync(redemption, mapping.MediaFile?.FilePath ?? mapping.SystemFilePath, true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SoundAlerts] Error disparando alerta para canje de reward {RewardId}", redemption.RewardId);
            }
        }

        private static (string FileUrl, string FileType, string? ImageUrl) BuildUrls(SoundAlertRewardFile mapping)
        {
            string fileUrl;
            string fileType;

            if (mapping.MediaFile != null)
            {
                fileUrl = ToPublicPath(mapping.MediaFile.FilePath);
                fileType = mapping.MediaFile.FileType;
            }
            else
            {
                fileUrl = ToPublicPath(mapping.SystemFilePath!);
                fileType = InferSystemFileType(mapping.SystemFilePath!);
            }

            string? imageUrl = null;
            if (mapping.ShowImage)
            {
                if (mapping.ImageSource == "url" && !string.IsNullOrEmpty(mapping.ImageUrl))
                {
                    imageUrl = mapping.ImageUrl;
                }
                else if (!string.IsNullOrEmpty(mapping.ImagePath))
                {
                    imageUrl = ToPublicPath(mapping.ImagePath);
                }
            }

            return (fileUrl, fileType, imageUrl);
        }

        /// <summary>Los archivos de sistema no tienen fila de BD con FileType — se infiere de la carpeta (sounds/videos/images), igual que los organiza SoundAlertsController.GetSystemFiles.</summary>
        private static string InferSystemFileType(string systemFilePath)
        {
            if (systemFilePath.Contains("/sounds/")) return "sound";
            if (systemFilePath.Contains("/videos/")) return "video";
            if (systemFilePath.Contains("/images/")) return "image";
            return "sound";
        }

        // Una sola implementación en Decatron.Core: las cuatro copias privadas que
        // había tenían la misma lógica rota, así que arreglar una sola habría dejado
        // las otras tres generando URLs invalidas.
        private static string ToPublicPath(string filePath) =>
            Decatron.Core.Helpers.MediaPathHelpers.ToPublicPath(filePath);

        private async Task RegistrarHistorialAsync(SoundAlertRedemption redemption, string? filePath, bool playedSuccessfully, string? errorMessage)
        {
            try
            {
                _db.SoundAlertHistories.Add(new SoundAlertHistory
                {
                    ChannelName = redemption.OverlayGroupKey,
                    UserId = redemption.ChannelUserId,
                    RewardId = redemption.RewardId,
                    RewardTitle = redemption.RewardTitle,
                    FilePath = filePath,
                    RedeemedBy = redemption.RedeemerUsername,
                    RedeemedById = redemption.RedeemerId,
                    RedeemedAt = redemption.RedeemedAt.UtcDateTime,
                    PlayedSuccessfully = playedSuccessfully,
                    ErrorMessage = errorMessage
                });
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SoundAlerts] Error registrando historial de canje {RewardId}", redemption.RewardId);
            }
        }
    }
}
