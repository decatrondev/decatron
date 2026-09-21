using Decatron.Core.Interfaces;
using Decatron.Core.Models.Fortnite;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Entrega los avisos de "hay spirits nuevos" por Twitch chat y Discord DM.
    /// El calculo de "que hay nuevo" vive en IFortniteService; esto solo decide
    /// a quien avisar y por donde, y mueve el marcador de "hasta cuando ya avise"
    /// de cada canal para no repetir.
    /// </summary>
    public interface ISpiritNotificationDeliveryService
    {
        /// <summary>Se llama desde stream.online. Si el streamer tiene el aviso de Twitch prendido y hay sprites nuevos pendientes, los anuncia en su propio chat.</summary>
        Task NotifyStreamOnlineAsync(long userId, string channelLogin);

        /// <summary>
        /// Barrido periodico de Twitch — cubre a quien YA estaba en vivo cuando
        /// salio el sprite nuevo (stream.online no vuelve a disparar hasta que
        /// corte y prenda de nuevo). A cualquiera con el aviso prendido que este
        /// en vivo ahora mismo, con algo pendiente, se lo manda.
        /// </summary>
        Task RunTwitchSweepAsync();

        /// <summary>Barrido periodico: DM de Discord a todos los que lo tengan prendido y tengan Discord vinculado.</summary>
        Task RunDiscordSweepAsync();
    }

    public class SpiritNotificationDeliveryService : ISpiritNotificationDeliveryService
    {
        private readonly DecatronDbContext _context;
        private readonly IFortniteService _fortnite;
        private readonly IMessageSender _messageSender;
        private readonly IDiscordDmSender _discordDmSender;
        private readonly IStreamStatusService _streamStatusService;
        private readonly ILogger<SpiritNotificationDeliveryService> _logger;

        public SpiritNotificationDeliveryService(
            DecatronDbContext context,
            IFortniteService fortnite,
            IMessageSender messageSender,
            IDiscordDmSender discordDmSender,
            IStreamStatusService streamStatusService,
            ILogger<SpiritNotificationDeliveryService> logger)
        {
            _context = context;
            _fortnite = fortnite;
            _messageSender = messageSender;
            _discordDmSender = discordDmSender;
            _streamStatusService = streamStatusService;
            _logger = logger;
        }

        private static string BuildMessage(List<FortniteSprite> newSprites)
        {
            var names = string.Join(", ", newSprites.Take(5).Select(s => s.Name));
            var extra = newSprites.Count > 5 ? $" (+{newSprites.Count - 5} más)" : "";
            var plural = newSprites.Count == 1 ? "spirit nuevo" : "spirits nuevos";
            return $"🎃 ¡{newSprites.Count} {plural} en Fortnite! {names}{extra} · twitch.decatron.net/sprites";
        }

        public async Task NotifyStreamOnlineAsync(long userId, string channelLogin)
        {
            try
            {
                var prefs = await _fortnite.GetOrCreateNotificationPrefsAsync(userId);
                if (!prefs.NotifyTwitchChat)
                    return;

                var newSprites = await _fortnite.GetSpritesReleasedSinceAsync(prefs.LastNotifiedTwitchAt);
                if (newSprites.Count == 0)
                    return;

                await _messageSender.SendMessageAsync(channelLogin.ToLower(), BuildMessage(newSprites));

                prefs.LastNotifiedTwitchAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpiritNotificationDelivery] Error avisando en Twitch a userId {UserId}", userId);
            }
        }

        public async Task RunTwitchSweepAsync()
        {
            var subscribers = await _context.UserSpiritNotificationPrefs
                .Where(p => p.NotifyTwitchChat)
                .ToListAsync();

            if (subscribers.Count == 0)
                return;

            foreach (var prefs in subscribers)
            {
                try
                {
                    var newSprites = await _fortnite.GetSpritesReleasedSinceAsync(prefs.LastNotifiedTwitchAt);
                    if (newSprites.Count == 0)
                        continue;

                    var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == prefs.UserId);
                    if (string.IsNullOrEmpty(user?.TwitchId) || !_streamStatusService.IsLive(user.TwitchId))
                        continue;

                    await _messageSender.SendMessageAsync(user.Login.ToLower(), BuildMessage(newSprites));

                    prefs.LastNotifiedTwitchAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[SpiritNotificationDelivery] Error en barrido de Twitch para userId {UserId}", prefs.UserId);
                }
            }
        }

        public async Task RunDiscordSweepAsync()
        {
            var subscribers = await _context.UserSpiritNotificationPrefs
                .Where(p => p.NotifyDiscordDm)
                .ToListAsync();

            if (subscribers.Count == 0)
                return;

            foreach (var prefs in subscribers)
            {
                try
                {
                    var newSprites = await _fortnite.GetSpritesReleasedSinceAsync(prefs.LastNotifiedDiscordAt);
                    if (newSprites.Count == 0)
                        continue;

                    var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == prefs.UserId);
                    if (user?.DiscordId == null)
                        continue;

                    var sent = await _discordDmSender.SendDmAsync(user.DiscordId, BuildMessage(newSprites));
                    if (!sent)
                        continue;

                    prefs.LastNotifiedDiscordAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[SpiritNotificationDelivery] Error mandando DM de Discord a userId {UserId}", prefs.UserId);
                }
            }
        }
    }
}
