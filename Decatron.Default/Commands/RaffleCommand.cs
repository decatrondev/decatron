using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace Decatron.Default.Commands
{
    /// <summary>
    /// Comando !raffle / !sorteo - Sistema completo de sorteos
    /// Uso:
    ///   !raffle join            - Unirse al sorteo activo
    ///   !raffle create [nombre] - Crear sorteo (solo mods/broadcaster)
    ///   !raffle close           - Cerrar sorteo (solo mods/broadcaster)
    ///   !raffle draw            - Sortear ganadores (solo mods/broadcaster)
    ///   !raffle status          - Ver estado del sorteo activo
    /// </summary>
    public class RaffleCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<RaffleCommand> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!raffle";
        public string Description => "Sistema de sorteos (uso: !raffle join, !raffle create [nombre], !raffle close, !raffle draw)";

        public RaffleCommand(
            IConfiguration configuration,
            ILogger<RaffleCommand> logger,
            IServiceProvider serviceProvider,
            ICommandMessagesService messagesService)
        {
            _configuration = configuration;
            _logger = logger;
            _serviceProvider = serviceProvider;
            _messagesService = messagesService;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                var username = context.Username;
                var channel = context.Channel;
                var message = context.Message;

                _logger.LogInformation($"Ejecutando comando !raffle por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !raffle deshabilitado para el canal {channel}");
                    return;
                }

                var messageWithoutPrefix = message.StartsWith("!") ? message.Substring(1) : message;
                var parts = messageWithoutPrefix.Split(' ', 3, StringSplitOptions.RemoveEmptyEntries);

                var lang = await GetChannelLanguageAsync(channel);

                // Si solo escriben "!raffle" sin argumentos, mostrar ayuda
                if (parts.Length < 2)
                {
                    await messageSender.SendMessageAsync(channel,
                        _messagesService.GetMessage("raffle_cmd", "help", lang));
                    return;
                }

                var subcommand = parts[1].ToLower();
                var argument = parts.Length > 2 ? parts[2] : null;

                switch (subcommand)
                {
                    case "join":
                    case "participar":
                    case "entrar":
                        await HandleJoinAsync(username, channel, lang, messageSender);
                        break;

                    case "create":
                    case "crear":
                        await HandleCreateAsync(username, channel, argument, lang, messageSender);
                        break;

                    case "close":
                    case "cerrar":
                        await HandleCloseAsync(username, channel, lang, messageSender);
                        break;

                    case "draw":
                    case "sortear":
                        await HandleDrawAsync(username, channel, lang, messageSender);
                        break;

                    case "status":
                    case "estado":
                        await HandleStatusAsync(channel, lang, messageSender);
                        break;

                    case "reroll":
                        await HandleRerollAsync(username, channel, lang, messageSender);
                        break;

                    default:
                        await messageSender.SendMessageAsync(channel,
                            _messagesService.GetMessage("raffle_cmd", "invalid_subcommand", lang, subcommand));
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !raffle en {context.Channel}");
                var lang = await GetChannelLanguageAsync(context.Channel);
                await messageSender.SendMessageAsync(context.Channel, _messagesService.GetMessage("raffle_cmd", "error_generic", lang));
            }
        }

        private async Task HandleJoinAsync(string username, string channel, string lang, IMessageSender messageSender)
        {
            using var scope = _serviceProvider.CreateScope();
            var raffleService = scope.ServiceProvider.GetRequiredService<IRaffleService>();

            // Obtener sorteo activo del canal
            var activeRaffle = await GetActiveRaffleAsync(channel);

            if (activeRaffle == null)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "no_active", lang, username));
                return;
            }

            // Verificar si ya está participando
            var existing = await raffleService.GetParticipantByUsernameAsync(activeRaffle.Id, username);
            if (existing != null)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "already_participating", lang, username, activeRaffle.Name, existing.Tickets.ToString()));
                return;
            }

            // TODO: Aquí se deberían aplicar validaciones de requisitos (follower, sub, etc.)
            // Por ahora, permitir a todos participar

            // Agregar participante
            await raffleService.AddParticipantAsync(
                raffleId: activeRaffle.Id,
                username: username,
                twitchUserId: null,
                entryMethod: "command",
                tickets: 1
            );

            await messageSender.SendMessageAsync(channel,
                _messagesService.GetMessage("raffle_cmd", "joined", lang, username, activeRaffle.Name, (activeRaffle.TotalParticipants + 1).ToString()));
        }

        private async Task HandleCreateAsync(string username, string channel, string? raffleName, string lang, IMessageSender messageSender)
        {
            // Verificar permisos (solo broadcaster/mods)
            var hasPermission = await HasPermissionAsync(username, channel);
            if (!hasPermission)
            {
                _logger.LogDebug($"❌ {username} no tiene permisos para crear sorteos en {channel}");
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "permission_denied", lang, username));
                return;
            }

            if (string.IsNullOrWhiteSpace(raffleName))
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "specify_name", lang, username));
                return;
            }

            using var scope = _serviceProvider.CreateScope();
            var raffleService = scope.ServiceProvider.GetRequiredService<IRaffleService>();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            // Verificar si ya hay un sorteo activo
            var activeRaffle = await GetActiveRaffleAsync(channel);
            if (activeRaffle != null)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "already_active", lang, username, activeRaffle.Name));
                return;
            }

            // Obtener userId del broadcaster
            var channelLower = channel.ToLower();
            var channelUser = await dbContext.Users.FirstOrDefaultAsync(u => u.Login == channelLower);
            if (channelUser == null)
            {
                _logger.LogError($"No se encontró usuario para el canal {channel}");
                return;
            }

            // Crear sorteo
            var raffle = new Raffle
            {
                ChannelName = channelLower,
                Name = raffleName,
                WinnersCount = 1,
                ConfigJson = JsonSerializer.Serialize(new { createdViaCommand = true }),
                CreatedBy = channelUser.Id
            };

            await raffleService.CreateAsync(raffle);

            await messageSender.SendMessageAsync(channel,
                _messagesService.GetMessage("raffle_cmd", "created", lang, raffleName));
        }

        private async Task HandleCloseAsync(string username, string channel, string lang, IMessageSender messageSender)
        {
            var hasPermission = await HasPermissionAsync(username, channel);
            if (!hasPermission)
            {
                _logger.LogDebug($"❌ {username} no tiene permisos para cerrar sorteos en {channel}");
                return;
            }

            using var scope = _serviceProvider.CreateScope();
            var raffleService = scope.ServiceProvider.GetRequiredService<IRaffleService>();

            var activeRaffle = await GetActiveRaffleAsync(channel);
            if (activeRaffle == null)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "no_active_to_close", lang, username));
                return;
            }

            await raffleService.CloseRaffleAsync(activeRaffle.Id);

            await messageSender.SendMessageAsync(channel,
                _messagesService.GetMessage("raffle_cmd", "closed", lang, activeRaffle.Name, activeRaffle.TotalParticipants.ToString()));
        }

        private async Task HandleDrawAsync(string username, string channel, string lang, IMessageSender messageSender)
        {
            var hasPermission = await HasPermissionAsync(username, channel);
            if (!hasPermission)
            {
                _logger.LogDebug($"❌ {username} no tiene permisos para sortear en {channel}");
                return;
            }

            using var scope = _serviceProvider.CreateScope();
            var raffleService = scope.ServiceProvider.GetRequiredService<IRaffleService>();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var channelLower = channel.ToLower();
            var closedRaffle = await dbContext.Raffles
                .FirstOrDefaultAsync(r => r.ChannelName == channelLower && r.Status == "closed");

            if (closedRaffle == null)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "no_closed_to_draw", lang, username));
                return;
            }

            if (closedRaffle.TotalParticipants == 0)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "no_participants", lang, username, closedRaffle.Name));
                return;
            }

            // Ejecutar sorteo
            var winners = await raffleService.DrawWinnersAsync(closedRaffle.Id, weighted: false);

            if (winners.Count == 1)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "winner_singular", lang, closedRaffle.Name, winners[0].Username));
            }
            else
            {
                var winnersText = string.Join(", ", winners.Select(w => $"@{w.Username}"));
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "winners_plural", lang, closedRaffle.Name, winnersText));
            }
        }

        private async Task HandleStatusAsync(string channel, string lang, IMessageSender messageSender)
        {
            var activeRaffle = await GetActiveRaffleAsync(channel);

            if (activeRaffle == null)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "no_active_status", lang));
                return;
            }

            var timeElapsed = DateTime.UtcNow - activeRaffle.CreatedAt;
            var timeElapsedText = timeElapsed.TotalMinutes < 60
                ? $"{(int)timeElapsed.TotalMinutes} minutos"
                : $"{(int)timeElapsed.TotalHours} horas";

            await messageSender.SendMessageAsync(channel,
                _messagesService.GetMessage("raffle_cmd", "status", lang, activeRaffle.Name, activeRaffle.TotalParticipants.ToString(), timeElapsedText));
        }

        private async Task HandleRerollAsync(string username, string channel, string lang, IMessageSender messageSender)
        {
            var hasPermission = await HasPermissionAsync(username, channel);
            if (!hasPermission)
            {
                _logger.LogDebug($"❌ {username} no tiene permisos para re-sortear en {channel}");
                return;
            }

            using var scope = _serviceProvider.CreateScope();
            var raffleService = scope.ServiceProvider.GetRequiredService<IRaffleService>();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var channelLower = channel.ToLower();
            var completedRaffle = await dbContext.Raffles
                .Include(r => r.Winners)
                .FirstOrDefaultAsync(r => r.ChannelName == channelLower && r.Status == "completed");

            if (completedRaffle == null)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "no_completed_reroll", lang, username));
                return;
            }

            var lastWinner = completedRaffle.Winners
                .Where(w => !w.WasRerolled)
                .OrderByDescending(w => w.Position)
                .FirstOrDefault();

            if (lastWinner == null)
            {
                await messageSender.SendMessageAsync(channel,
                    _messagesService.GetMessage("raffle_cmd", "no_winner_reroll", lang, username));
                return;
            }

            var newWinner = await raffleService.RerollWinnerAsync(lastWinner.Id, "Reroll requested via command");

            await messageSender.SendMessageAsync(channel,
                _messagesService.GetMessage("raffle_cmd", "reroll", lang, newWinner.Username));
        }

        private async Task<Raffle?> GetActiveRaffleAsync(string channel)
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var channelLower = channel.ToLower();
            return await dbContext.Raffles
                .FirstOrDefaultAsync(r => r.ChannelName == channelLower && r.Status == "open");
        }

        private async Task<bool> IsCommandEnabledForChannel(string channel)
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var channelLower = channel.ToLower();

            // Obtener usuario primero
            var channelUser = await dbContext.Users.FirstOrDefaultAsync(u => u.Login == channelLower);
            if (channelUser == null) return true;

            // Obtener settings por UserId
            var settings = await dbContext.SystemSettings.FirstOrDefaultAsync(s => s.UserId == channelUser.Id);

            // Si no hay settings, asumir que está habilitado por defecto
            if (settings == null) return true;

            // TODO: Agregar campo "RafflesEnabled" a SystemSettings
            return true;
        }

        private async Task<bool> HasPermissionAsync(string username, string channel)
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var channelLower = channel.ToLower();
            var usernameLower = username.ToLower();

            // Broadcaster siempre tiene permiso
            if (usernameLower == channelLower)
            {
                return true;
            }

            // Verificar si es moderador
            // TODO: Implementar verificación real de moderadores desde Twitch API
            // Por ahora, solo broadcaster puede usar comandos de admin
            return false;
        }

        private async Task<string> GetChannelLanguageAsync(string channel)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var lang = await db.Users
                    .Where(u => u.Login == channel.ToLower())
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();
                return lang ?? "es";
            }
            catch { return "es"; }
        }
    }
}
