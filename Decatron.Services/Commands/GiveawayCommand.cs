using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data; // Added
using Microsoft.EntityFrameworkCore; // Added
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Decatron.Services.Commands
{
    public class GiveawayCommand : ICommand
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<GiveawayCommand> _logger;

        public string Name => "!join"; // Changed to "!join" to match CommandService lookup
        public string Description => "Comando para unirse al giveaway activo";

        public GiveawayCommand(IServiceScopeFactory scopeFactory, ILogger<GiveawayCommand> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var giveawayService = scope.ServiceProvider.GetRequiredService<GiveawayService>();
            var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();
            var watchTimeService = scope.ServiceProvider.GetRequiredService<IWatchTimeTrackingService>();
            var chatActivityService = scope.ServiceProvider.GetRequiredService<IChatActivityService>();

            var platform = context.Metadata != null && context.Metadata.TryGetValue("platform", out var platformValue)
                ? platformValue?.ToString() ?? "twitch" : "twitch";
            if (platform == "kick")
            {
                await ExecuteKickAsync(context, giveawayService);
                return;
            }

            // Resolver Channel ID
            var channelUser = await dbContext.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Login == context.Channel.ToLower());

            if (channelUser == null)
            {
                _logger.LogError($"No se pudo resolver ID para canal {context.Channel} en GiveawayCommand");
                return;
            }

            // Verificar si el usuario es follower
            var isFollower = await dbContext.ChannelFollowers.AsNoTracking()
                .AnyAsync(f => f.BroadcasterId == channelUser.TwitchId
                    && f.UserId == context.UserId
                    && f.IsFollowing == 0);

            // Obtener datos del follow si existe
            var followerData = await dbContext.ChannelFollowers.AsNoTracking()
                .FirstOrDefaultAsync(f => f.BroadcasterId == channelUser.TwitchId
                    && f.UserId == context.UserId
                    && f.IsFollowing == 0);

            // La tabla local de seguidores puede estar vacía o desactualizada (canal nuevo, evento perdido):
            // si no hay dato, se pregunta a Twitch para no rechazar a un seguidor real
            DateTime? followedAtFromApi = null;
            if (followerData == null)
            {
                var followInfo = await twitchApiService.GetFollowInfoAsync(channelUser.TwitchId, context.UserId);
                if (followInfo.Follows == true)
                {
                    isFollower = true;
                    followedAtFromApi = followInfo.Since;
                }
            }

            // Detectar subscription tier del context
            byte? subTier = null;
            int subStreak = 0;
            if (context.IsSubscriber)
            {
                // Intentar obtener de metadata si existe
                if (context.Metadata.ContainsKey("sub-tier"))
                {
                    if (byte.TryParse(context.Metadata["sub-tier"].ToString(), out byte tier))
                    {
                        subTier = tier;
                    }
                }
                // Si no está en metadata, asumir tier 1
                subTier ??= 1;

                // 🎯 NUEVO: Detectar sub streak (meses acumulativos de suscripción)
                // El badge-info contiene "subscriber/X" donde X es el número de meses
                if (context.Metadata.ContainsKey("badge-info"))
                {
                    var badgeInfo = context.Metadata["badge-info"]?.ToString() ?? "";
                    _logger.LogDebug($"[SUB STREAK] Badge-info para {context.Username}: {badgeInfo}");

                    // Formato: "subscriber/18" o "subscriber/18,founder/0" etc.
                    var parts = badgeInfo.Split(',');
                    foreach (var part in parts)
                    {
                        if (part.Trim().StartsWith("subscriber/"))
                        {
                            var monthsStr = part.Trim().Substring("subscriber/".Length);
                            if (int.TryParse(monthsStr, out int months))
                            {
                                subStreak = months;
                                _logger.LogInformation($"✅ [SUB STREAK] {context.Username} tiene {months} meses de suscripción");
                                break;
                            }
                        }
                    }
                }

                // Fallback: si no encontramos en badge-info pero es sub, asumir al menos 1 mes
                if (subStreak == 0)
                {
                    subStreak = 1;
                    _logger.LogDebug($"[SUB STREAK] No se pudo detectar meses para {context.Username}, asumiendo 1 mes");
                }
            }

            // Obtener datos de watchtime y chat activity
            var watchTimeMinutes = await watchTimeService.GetWatchTimeMinutes(channelUser.TwitchId, context.UserId);
            var chatMessagesCount = await chatActivityService.GetMessageCount(channelUser.TwitchId, context.UserId);

            // Construir metadata requerida por GiveawayService
            var metadata = new Dictionary<string, object>
            {
                { "isFollower", isFollower },
                { "isSubscriber", context.IsSubscriber },
                { "subscriptionTier", subTier ?? (byte)0 },
                { "isVip", context.IsVip },
                { "isModerator", context.IsModerator }, // el streamer no cuenta como moderador; el Lead Moderator se suma según las opciones del sorteo
                { "isLeadModerator", context.IsLeadModerator },
                { "isBroadcaster", context.IsBroadcaster },
                { "watchTimeMinutes", watchTimeMinutes },
                { "chatMessagesCount", chatMessagesCount },
                { "bitsTotal", 0 }, // Se inicializa en 0, se actualiza cuando el usuario dona bits durante el giveaway
                { "subStreak", subStreak } // ✅ Meses acumulativos de suscripción detectados desde badge-info
            };

            // Agregar datos de follow si existen (asegurando que sean UTC)
            if (followerData != null)
            {
                metadata["followedAt"] = DateTime.SpecifyKind(followerData.FollowedAt, DateTimeKind.Utc);
                if (followerData.AccountCreatedAt.HasValue)
                {
                    metadata["accountCreatedAt"] = DateTime.SpecifyKind(followerData.AccountCreatedAt.Value, DateTimeKind.Utc);
                }
            }

            if (followedAtFromApi.HasValue)
                metadata["followedAt"] = DateTime.SpecifyKind(followedAtFromApi.Value, DateTimeKind.Utc);

            // Si no tenemos accountCreatedAt de followerData, obtenerlo de la API de Twitch
            if (!metadata.ContainsKey("accountCreatedAt"))
            {
                try
                {
                    var userData = await twitchApiService.GetUserByLoginAsync(context.Username);
                    if (userData != null && !string.IsNullOrEmpty(userData.created_at))
                    {
                        if (DateTime.TryParse(userData.created_at, out DateTime createdAt))
                        {
                            metadata["accountCreatedAt"] = DateTime.SpecifyKind(createdAt, DateTimeKind.Utc);
                            _logger.LogInformation($"AccountCreatedAt obtenido de API Twitch para {context.Username}: {createdAt}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"No se pudo obtener accountCreatedAt de API Twitch: {ex.Message}");
                }
            }

            _logger.LogDebug($"[GIVEAWAY CMD] Intentando añadir {context.Username}. Metadata: isFollower={metadata["isFollower"]}, isSubscriber={metadata["isSubscriber"]}, isVip={metadata["isVip"]}, isMod={metadata["isModerator"]}");

            var result = await giveawayService.AddParticipant(
                channelUser.TwitchId, // Usar ID real
                context.UserId,
                context.Username,
                context.Username, // DisplayName (usamos username por ahora)
                metadata,
                ipAddress: null // Twitch no proporciona IPs de usuarios
            );

            if (result.Joined)
            {
                _logger.LogInformation($"✅ Usuario {context.Username} unido al giveaway en {context.Channel}");
            }
            else
            {
                // "ya entró" es lo normal cuando el viewer repite el comando: no es un aviso
                var level = result.Reason == "already_entered" ? LogLevel.Debug : LogLevel.Information;
                _logger.Log(level, $"Usuario {context.Username} NO entró al giveaway en {context.Channel}: {result.Reason}");
            }
        }

        /// <summary>
        /// Entrada desde Kick. La API pública de Kick solo entrega los roles del mensaje de chat (suscriptor, VIP, moderador,
        /// streamer): seguidores, meses de sub, edad de cuenta, tiempo de visualización y mensajes no se pueden comprobar
        /// (ver GiveawayCapabilities). El servicio decide qué hacer con esos requisitos según la opción del streamer.
        /// </summary>
        private async Task ExecuteKickAsync(CommandContext context, GiveawayService giveawayService)
        {
            // El giveaway es el de la fila principal de la cuenta; CommandService ya la resolvió
            var channelId = context.ChannelTwitchId;
            if (string.IsNullOrEmpty(channelId))
            {
                _logger.LogWarning("Entrada de Kick sin cuenta principal de Twitch vinculada (canal {Channel})", context.Channel);
                return;
            }

            var metadata = new Dictionary<string, object>
            {
                { "isFollower", false },
                { "isSubscriber", context.IsSubscriber },
                { "subscriptionTier", context.IsSubscriber ? (byte)1 : (byte)0 }, // Kick no dice el nivel: cuenta como el básico
                { "isVip", context.IsVip },
                { "isModerator", context.IsModerator },
                { "isLeadModerator", false },
                { "isBroadcaster", context.IsBroadcaster },
                { "watchTimeMinutes", 0 },
                { "chatMessagesCount", 0 },
                { "bitsTotal", 0 },
                { "subStreak", context.IsSubscriber ? 1 : 0 }, // Kick no dice los meses: cuenta como uno
                { "platform", "kick" },
            };

            var result = await giveawayService.AddParticipant(channelId, context.UserId, context.Username, context.Username,
                metadata, ipAddress: null, platform: "kick");

            var level = result.Joined || result.Reason == "already_entered" ? LogLevel.Debug : LogLevel.Information;
            _logger.Log(level, "Kick: {User} {Outcome} el giveaway de {Channel}{Reason}", context.Username,
                result.Joined ? "entró al" : "NO entró al", context.Channel, result.Joined ? "" : $": {result.Reason}");
        }
    }
}
