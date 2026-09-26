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
        private readonly ICommandMessagesService _messagesService;
        private readonly ShoutoutService _shoutoutService;

        public string Name => "!so";
        public string Description => "Hace shoutout a un usuario mostrando su último clip y perfil";

        public ShoutoutCommand(
            IConfiguration configuration,
            ILogger<ShoutoutCommand> logger,
            ICommandStateService commandStateService,
            IServiceProvider serviceProvider,
            ICommandMessagesService messagesService,
            ShoutoutService shoutoutService)
        {
            _configuration = configuration;
            _logger = logger;
            _commandStateService = commandStateService;
            _serviceProvider = serviceProvider;
            _messagesService = messagesService;
            _shoutoutService = shoutoutService;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;
            var lang = "es";
            try
            {
                _logger.LogInformation($"Ejecutando comando !so por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel, context);
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

                lang = await GetChannelLanguageAsync(channel, context);

                // El shoutout usa clips de Twitch (TwitchApiService.GetShoutoutDataAsync)
                // sin equivalente en Kick — no hay recurso de clips en su API
                // publica. "No disponible", no "Proximamente". Sin este chequeo el
                // comando corria igual y terminaba en un error crudo de Twitch.
                if (Utils.IsNonTwitchChannelIdentifier(channel))
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("so_cmd", "platform_unavailable", lang));
                    return;
                }

                if (args.Length < 2)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("so_cmd", "usage", lang));
                    return;
                }

                // Lista negra, espera, clip, historial, chat, overlay y nativo: lo mismo que el shoutout por raid
                var targetUser = args[1].TrimStart('@').ToLower();
                await _shoutoutService.RunAsync(channel, targetUser, username, ShoutoutService.Trigger.Command, context.ChannelUserId, lang);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !so en {channel}");
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("so_cmd", "error_generic", lang));
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

        private async Task<bool> IsCommandEnabledForChannel(string channelLogin, CommandContext context)
        {
            try
            {
                var userInfo = context.ChannelUserId.HasValue
                    ? await Utils.GetUserInfoByUserIdAsync(_configuration, context.ChannelUserId.Value)
                    : await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
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

        private async Task<string> GetChannelLanguageAsync(string channel, CommandContext context)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var lang = await db.Users
                    .Where(u => context.ChannelUserId != null ? u.Id == context.ChannelUserId : u.Login == channel.ToLower())
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();
                return lang ?? "es";
            }
            catch { return "es"; }
        }
    }
}
