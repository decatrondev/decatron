using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class SoundAlertTriggerService : ISoundAlertTriggerService
    {
        private readonly DecatronDbContext _db;
        private readonly IHubContext<OverlayHub> _hubContext;
        private readonly ILogger<SoundAlertTriggerService> _logger;

        public SoundAlertTriggerService(DecatronDbContext db, IHubContext<OverlayHub> hubContext, ILogger<SoundAlertTriggerService> logger)
        {
            _db = db;
            _hubContext = hubContext;
            _logger = logger;
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
                    redeemer = redemption.RedeemerUsername,
                    reward = redemption.RewardTitle,
                    fileUrl,
                    fileType,
                    imageUrl,
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

                await _hubContext.Clients.Group($"overlay_{redemption.OverlayGroupKey}").SendAsync("ShowSoundAlert", alertData);

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
