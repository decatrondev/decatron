using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Decatron.Default.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Commands
{
    public class ShoutoutCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<ShoutoutCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly TwitchApiService _twitchApiService;
        private readonly ClipDownloadService _clipDownloadService;
        private readonly OverlayNotificationService _overlayNotificationService;

        // Cooldown: Canal -> TargetUser -> Timestamp del último shoutout
        private static readonly Dictionary<string, Dictionary<string, DateTime>> _shoutoutCooldowns = new();
        private const int DefaultCooldownSeconds = 30;

        public string Name => "!so";
        public string Description => "Hace shoutout a un usuario mostrando su último clip y perfil";

        public ShoutoutCommand(
            IConfiguration configuration,
            ILogger<ShoutoutCommand> logger,
            ICommandStateService commandStateService,
            IServiceProvider serviceProvider,
            TwitchApiService twitchApiService,
            ClipDownloadService clipDownloadService,
            OverlayNotificationService overlayNotificationService)
        {
            _configuration = configuration;
            _logger = logger;
            _commandStateService = commandStateService;
            _serviceProvider = serviceProvider;
            _twitchApiService = twitchApiService;
            _clipDownloadService = clipDownloadService;
            _overlayNotificationService = overlayNotificationService;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;
            try
            {
                _logger.LogInformation($"Ejecutando comando !so por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !so deshabilitado para el canal {channel}");
                    return;
                }

                // Verificar permisos (incluye whitelist)
                var hasPermission = await HasPermissionToShoutout(username, channel);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para ejecutar !so en {channel}");
                    return; // No enviar mensaje para no spamear el chat
                }

                var messageWithoutPrefix = message.StartsWith("!") ? message.Substring(1) : message;
                var args = messageWithoutPrefix.Split(' ', StringSplitOptions.RemoveEmptyEntries);

                if (args.Length < 2)
                {
                    await messageSender.SendMessageAsync(channel, "Uso: !so @usuario o !so usuario");
                    return;
                }

                // Obtener el usuario target
                var targetUser = args[1].TrimStart('@').ToLower();

                // Verificar blacklist
                var isBlacklisted = await IsUserBlacklisted(channel, targetUser);
                if (isBlacklisted)
                {
                    _logger.LogInformation($"🚫 {targetUser} está en la blacklist de {channel}");

                    // Enviar mensaje gracioso cuando intentan hacer shoutout a alguien en blacklist
                    var blacklistMessages = new[]
                    {
                        $"🚫 Lo siento, @{targetUser} está en la lista negra. ¡No hay shoutouts aquí!",
                        $"❌ @{targetUser}? Nah, ese nombre no me suena... 🤐",
                        $"🙅 @{targetUser} está tomando unas vacaciones permanentes de los shoutouts.",
                        $"🚷 @{targetUser} ha sido vetado del salón de la fama de shoutouts.",
                        $"⛔ Error 404: Shoutout para @{targetUser} no encontrado (y nunca lo estará)."
                    };

                    var random = new Random();
                    var randomMessage = blacklistMessages[random.Next(blacklistMessages.Length)];
                    await messageSender.SendMessageAsync(channel, randomMessage);
                    return;
                }

                // Obtener cooldown configurado para el canal
                var cooldownSeconds = await GetCooldownForChannel(channel);
                var cooldownDuration = TimeSpan.FromSeconds(cooldownSeconds);

                // Verificar cooldown
                if (!IsShoutoutAllowed(channel, targetUser, cooldownDuration))
                {
                    var remainingCooldown = GetRemainingCooldown(channel, targetUser, cooldownDuration);
                    await messageSender.SendMessageAsync(channel,
                        $"⏰ Espera {remainingCooldown.TotalSeconds:F0}s antes de hacer otro shoutout a @{targetUser}");
                    return;
                }

                _logger.LogInformation($"🔥 Procesando shoutout a {targetUser} en {channel}");

                // 1. Obtener información del usuario desde Twitch API
                var shoutoutData = await _twitchApiService.GetShoutoutDataAsync(targetUser);
                if (shoutoutData == null)
                {
                    // El usuario no existe en Twitch
                    _logger.LogWarning($"⚠️ Usuario no encontrado en Twitch: {targetUser}");
                    await messageSender.SendMessageAsync(channel, $"❌ El usuario @{targetUser} no existe en Twitch.");
                    return;
                }

                string? clipLocalPath = null;
                bool hasClips = !string.IsNullOrEmpty(shoutoutData.ClipUrl);

                // 2. Descargar clip si existe
                if (hasClips)
                {
                    _logger.LogInformation($"📥 Descargando clip para {targetUser}: {shoutoutData.ClipUrl}");

                    var downloadResult = await _clipDownloadService.DownloadClipAsync(
                        shoutoutData.ClipUrl!,
                        targetUser
                    );

                    if (downloadResult.Success)
                    {
                        clipLocalPath = downloadResult.LocalPath;
                        _logger.LogInformation($"✅ Clip {'('+((downloadResult.WasDownloaded ? "descargado" : "ya existía"))+')'}: {clipLocalPath}");
                    }
                    else
                    {
                        _logger.LogWarning($"⚠️ No se pudo descargar clip: {downloadResult.Error}");
                    }
                }
                else
                {
                    _logger.LogInformation($"ℹ️ {targetUser} no tiene clips disponibles");
                }

                // 3. Guardar en historial con toda la información
                await SaveShoutoutHistory(
                    channel,
                    targetUser,
                    username,
                    shoutoutData,
                    clipLocalPath
                );

                // 4. Enviar mensaje al chat
                var shoutoutMessage = BuildShoutoutMessage(shoutoutData, hasClips);
                await messageSender.SendMessageAsync(channel, shoutoutMessage);

                // 5. Emitir evento SignalR para overlay
                await _overlayNotificationService.SendShoutoutAsync(channel, shoutoutData, clipLocalPath);

                // 6. Registrar cooldown
                RegisterShoutoutCooldown(channel, targetUser, cooldownDuration);

                _logger.LogInformation($"✅ Shoutout completado: {targetUser} en {channel} (Clips: {(hasClips ? "Sí" : "No")})");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !so en {channel}");
                await messageSender.SendMessageAsync(channel, "❌ Error al ejecutar el shoutout.");
            }
        }

        private async Task<bool> HasPermissionToShoutout(string username, string channel)
        {
            try
            {
                // El broadcaster siempre tiene permiso
                if (username.Equals(channel, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                // Verificar si es moderador o tiene permisos (mods siempre pueden, excepto si están blacklisted)
                var isMod = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                if (isMod)
                {
                    _logger.LogDebug($"✅ {username} es moderador en {channel}");
                    return true;
                }

                // Si no es mod, verificar whitelist (usuarios adicionales que pueden usar !so)
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var config = await dbContext.ShoutoutConfigs
                    .FirstOrDefaultAsync(c => c.Username == channel.ToLower());

                if (config != null && !string.IsNullOrWhiteSpace(config.Whitelist) && config.Whitelist != "[]")
                {
                    try
                    {
                        var whitelist = System.Text.Json.JsonSerializer.Deserialize<List<string>>(config.Whitelist) ?? new List<string>();

                        if (whitelist.Count > 0)
                        {
                            var isInWhitelist = whitelist.Any(u => u.Equals(username, StringComparison.OrdinalIgnoreCase));
                            if (isInWhitelist)
                            {
                                _logger.LogDebug($"✅ {username} está en la whitelist de {channel}");
                                return true;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"Error parseando whitelist para {channel}");
                    }
                }

                _logger.LogDebug($"❌ {username} no tiene permisos para usar !so en {channel}");
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando permisos para {username} en {channel}");
                return false;
            }
        }

        private async Task<bool> IsUserBlacklisted(string channel, string targetUser)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var config = await dbContext.ShoutoutConfigs
                    .FirstOrDefaultAsync(c => c.Username == channel.ToLower());

                if (config == null || string.IsNullOrWhiteSpace(config.Blacklist) || config.Blacklist == "[]")
                {
                    return false;
                }

                var blacklist = System.Text.Json.JsonSerializer.Deserialize<List<string>>(config.Blacklist) ?? new List<string>();
                return blacklist.Any(u => u.Equals(targetUser, StringComparison.OrdinalIgnoreCase));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando blacklist para {channel}");
                return false; // En caso de error, permitir el shoutout
            }
        }

        private async Task SaveShoutoutHistory(
            string channel,
            string targetUser,
            string executedBy,
            Services.ShoutoutData shoutoutData,
            string? clipLocalPath)
        {
            try
            {
                // Crear un scope nuevo para el DbContext
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var history = new Core.Models.ShoutoutHistory
                {
                    ChannelName = channel,
                    TargetUser = targetUser,
                    ExecutedBy = executedBy,
                    ClipUrl = shoutoutData.ClipUrl,
                    ClipId = shoutoutData.ClipId,
                    ClipLocalPath = clipLocalPath,
                    ProfileImageUrl = shoutoutData.ProfileImageUrl,
                    GameName = shoutoutData.GameName,
                    ExecutedAt = DateTime.UtcNow
                };

                dbContext.Set<Core.Models.ShoutoutHistory>().Add(history);
                await dbContext.SaveChangesAsync();

                _logger.LogDebug($"Shoutout guardado en historial: {targetUser} en {channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando historial de shoutout");
            }
        }

        private string BuildShoutoutMessage(Services.ShoutoutData shoutoutData, bool hasClips)
        {
            var message = $"🔥 ¡Denle follow a @{shoutoutData.Username}! 🔥";

            if (!string.IsNullOrEmpty(shoutoutData.GameName) && shoutoutData.GameName != "Sin categoría")
            {
                message += $" Jugando: {shoutoutData.GameName}";
            }

            if (!hasClips)
            {
                message += " (No tiene clips, pero denle amor igual!)";
            }

            message += $" → twitch.tv/{shoutoutData.Username}";

            return message;
        }

        private async Task<bool> IsCommandEnabledForChannel(string channelLogin)
        {
            try
            {
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (userInfo == null)
                {
                    return true;
                }

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "so");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando !so está habilitado para {channelLogin}");
                return true;
            }
        }

        private async Task<int> GetCooldownForChannel(string channel)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var config = await dbContext.ShoutoutConfigs
                    .FirstOrDefaultAsync(c => c.Username == channel);

                return config?.Cooldown ?? DefaultCooldownSeconds;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo cooldown para {channel}, usando default");
                return DefaultCooldownSeconds;
            }
        }

        private bool IsShoutoutAllowed(string channel, string targetUser, TimeSpan cooldownDuration)
        {
            lock (_shoutoutCooldowns)
            {
                if (!_shoutoutCooldowns.ContainsKey(channel))
                {
                    return true;
                }

                if (!_shoutoutCooldowns[channel].ContainsKey(targetUser))
                {
                    return true;
                }

                var lastShoutout = _shoutoutCooldowns[channel][targetUser];
                var elapsed = DateTime.UtcNow - lastShoutout;

                return elapsed >= cooldownDuration;
            }
        }

        private TimeSpan GetRemainingCooldown(string channel, string targetUser, TimeSpan cooldownDuration)
        {
            lock (_shoutoutCooldowns)
            {
                if (!_shoutoutCooldowns.ContainsKey(channel) ||
                    !_shoutoutCooldowns[channel].ContainsKey(targetUser))
                {
                    return TimeSpan.Zero;
                }

                var lastShoutout = _shoutoutCooldowns[channel][targetUser];
                var elapsed = DateTime.UtcNow - lastShoutout;
                var remaining = cooldownDuration - elapsed;

                return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
            }
        }

        private void RegisterShoutoutCooldown(string channel, string targetUser, TimeSpan cooldownDuration)
        {
            lock (_shoutoutCooldowns)
            {
                if (!_shoutoutCooldowns.ContainsKey(channel))
                {
                    _shoutoutCooldowns[channel] = new Dictionary<string, DateTime>();
                }

                _shoutoutCooldowns[channel][targetUser] = DateTime.UtcNow;
                _logger.LogDebug($"Cooldown registrado: {channel} -> {targetUser} ({cooldownDuration.TotalSeconds}s)");
            }
        }
    }
}
