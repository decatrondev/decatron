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

        public string Name => "!raffle";
        public string Description => "Sistema de sorteos (uso: !raffle join, !raffle create [nombre], !raffle close, !raffle draw)";

        public RaffleCommand(
            IConfiguration configuration,
            ILogger<RaffleCommand> logger,
            IServiceProvider serviceProvider)
        {
            _configuration = configuration;
            _logger = logger;
            _serviceProvider = serviceProvider;
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

                // Si solo escriben "!raffle" sin argumentos, mostrar ayuda
                if (parts.Length < 2)
                {
                    await messageSender.SendMessageAsync(channel,
                        "🎁 Comandos: !raffle join (participar) | !raffle status (ver estado)");
                    return;
                }

                var subcommand = parts[1].ToLower();
                var argument = parts.Length > 2 ? parts[2] : null;

                switch (subcommand)
                {
                    case "join":
                    case "participar":
                    case "entrar":
                        await HandleJoinAsync(username, channel, messageSender);
                        break;

                    case "create":
                    case "crear":
                        await HandleCreateAsync(username, channel, argument, messageSender);
                        break;

                    case "close":
                    case "cerrar":
                        await HandleCloseAsync(username, channel, messageSender);
                        break;

                    case "draw":
                    case "sortear":
                        await HandleDrawAsync(username, channel, messageSender);
                        break;

                    case "status":
                    case "estado":
                        await HandleStatusAsync(channel, messageSender);
                        break;

                    case "reroll":
                        await HandleRerollAsync(username, channel, messageSender);
                        break;

                    default:
                        await messageSender.SendMessageAsync(channel,
                            $"❌ Subcomando '{subcommand}' no reconocido. Usa: join, create, close, draw, status");
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !raffle en {context.Channel}");
                await messageSender.SendMessageAsync(context.Channel, "❌ Error al ejecutar el comando.");
            }
        }

        private async Task HandleJoinAsync(string username, string channel, IMessageSender messageSender)
        {
            using var scope = _serviceProvider.CreateScope();
            var raffleService = scope.ServiceProvider.GetRequiredService<IRaffleService>();

            // Obtener sorteo activo del canal
            var activeRaffle = await GetActiveRaffleAsync(channel);

            if (activeRaffle == null)
            {
                await messageSender.SendMessageAsync(channel,
                    $"@{username} ❌ No hay ningún sorteo activo en este momento.");
                return;
            }

            // Verificar si ya está participando
            var existing = await raffleService.GetParticipantByUsernameAsync(activeRaffle.Id, username);
            if (existing != null)
            {
                await messageSender.SendMessageAsync(channel,
                    $"@{username} ✅ Ya estás participando en el sorteo '{activeRaffle.Name}' ({existing.Tickets} tickets)");
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
                $"@{username} 🎫 ¡Te has unido al sorteo '{activeRaffle.Name}'! Total de participantes: {activeRaffle.TotalParticipants + 1}");
        }

        private async Task HandleCreateAsync(string username, string channel, string? raffleName, IMessageSender messageSender)
        {
            // Verificar permisos (solo broadcaster/mods)
            var hasPermission = await HasPermissionAsync(username, channel);
            if (!hasPermission)
            {
                _logger.LogDebug($"❌ {username} no tiene permisos para crear sorteos en {channel}");
                await messageSender.SendMessageAsync(channel,
                    $"@{username} ❌ Solo moderadores y el broadcaster pueden crear sorteos.");
                return;
            }

            if (string.IsNullOrWhiteSpace(raffleName))
            {
                await messageSender.SendMessageAsync(channel,
                    $"@{username} ❌ Debes especificar un nombre para el sorteo. Ej: !raffle create Teclado RGB");
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
                    $"@{username} ❌ Ya existe un sorteo activo: '{activeRaffle.Name}'. Ciérralo primero con !raffle close");
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
                $"🎁 ¡Sorteo '{raffleName}' creado! Escribe !raffle join para participar. Total de participantes: 0");
        }

        private async Task HandleCloseAsync(string username, string channel, IMessageSender messageSender)
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
                    $"@{username} ❌ No hay ningún sorteo activo para cerrar.");
                return;
            }

            await raffleService.CloseRaffleAsync(activeRaffle.Id);

            await messageSender.SendMessageAsync(channel,
                $"🔒 ¡Sorteo '{activeRaffle.Name}' cerrado! Total de participantes: {activeRaffle.TotalParticipants}. Usa !raffle draw para sortear.");
        }

        private async Task HandleDrawAsync(string username, string channel, IMessageSender messageSender)
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
                    $"@{username} ❌ No hay ningún sorteo cerrado para sortear. Cierra uno primero con !raffle close");
                return;
            }

            if (closedRaffle.TotalParticipants == 0)
            {
                await messageSender.SendMessageAsync(channel,
                    $"@{username} ❌ El sorteo '{closedRaffle.Name}' no tiene participantes.");
                return;
            }

            // Ejecutar sorteo
            var winners = await raffleService.DrawWinnersAsync(closedRaffle.Id, weighted: false);

            if (winners.Count == 1)
            {
                await messageSender.SendMessageAsync(channel,
                    $"🎉 ¡GANADOR del sorteo '{closedRaffle.Name}': @{winners[0].Username}! ¡Felicidades! 🎊");
            }
            else
            {
                var winnersText = string.Join(", ", winners.Select(w => $"@{w.Username}"));
                await messageSender.SendMessageAsync(channel,
                    $"🎉 ¡GANADORES del sorteo '{closedRaffle.Name}': {winnersText}! ¡Felicidades! 🎊");
            }
        }

        private async Task HandleStatusAsync(string channel, IMessageSender messageSender)
        {
            var activeRaffle = await GetActiveRaffleAsync(channel);

            if (activeRaffle == null)
            {
                await messageSender.SendMessageAsync(channel,
                    "📊 No hay ningún sorteo activo en este momento.");
                return;
            }

            var timeElapsed = DateTime.UtcNow - activeRaffle.CreatedAt;
            var timeElapsedText = timeElapsed.TotalMinutes < 60
                ? $"{(int)timeElapsed.TotalMinutes} minutos"
                : $"{(int)timeElapsed.TotalHours} horas";

            await messageSender.SendMessageAsync(channel,
                $"📊 Sorteo '{activeRaffle.Name}': {activeRaffle.TotalParticipants} participantes | Abierto hace {timeElapsedText} | !raffle join para participar");
        }

        private async Task HandleRerollAsync(string username, string channel, IMessageSender messageSender)
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
                    $"@{username} ❌ No hay ningún sorteo completado para re-sortear.");
                return;
            }

            var lastWinner = completedRaffle.Winners
                .Where(w => !w.WasRerolled)
                .OrderByDescending(w => w.Position)
                .FirstOrDefault();

            if (lastWinner == null)
            {
                await messageSender.SendMessageAsync(channel,
                    $"@{username} ❌ No se encontró ganador para re-sortear.");
                return;
            }

            var newWinner = await raffleService.RerollWinnerAsync(lastWinner.Id, "Reroll requested via command");

            await messageSender.SendMessageAsync(channel,
                $"🔄 Re-roll ejecutado! Nuevo ganador: @{newWinner.Username}! 🎉");
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
    }
}
