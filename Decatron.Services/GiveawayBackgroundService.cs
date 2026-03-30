using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Decatron.Services
{
    /// <summary>
    /// Servicio de fondo que monitorea giveaways activos para:
    /// - Finalizar automáticamente giveaways con tiempo límite (timed)
    /// - Detectar timeouts de respuesta de ganadores
    /// - Ejecutar auto-reroll si está configurado
    /// - Promover backup winners si es necesario
    /// </summary>
    public class GiveawayBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<GiveawayBackgroundService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(5);

        public GiveawayBackgroundService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<GiveawayBackgroundService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🎁 GiveawayBackgroundService iniciado");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckGiveawayTimeouts();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en GiveawayBackgroundService");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }

            _logger.LogInformation("🎁 GiveawayBackgroundService detenido");
        }

        private async Task CheckGiveawayTimeouts()
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var giveawayService = scope.ServiceProvider.GetRequiredService<GiveawayService>();
            var messageSender = scope.ServiceProvider.GetRequiredService<IMessageSender>();

            var now = DateTime.UtcNow;

            // ========================================================================
            // PASO 1: VERIFICAR GIVEAWAYS CON TIEMPO LÍMITE (timed) QUE YA EXPIRARON
            // ========================================================================
            var timedGiveaways = await dbContext.GiveawaySessions
                .Where(s => s.Status == "active" && s.EndsAt != null && s.EndsAt <= now)
                .ToListAsync();

            foreach (var session in timedGiveaways)
            {
                try
                {
                    _logger.LogInformation($"⏰ Giveaway {session.Id} ({session.Name}) ha expirado. Finalizando automáticamente...");

                    // Obtener nombre del canal
                    var channelUser = await dbContext.Users
                        .FirstOrDefaultAsync(u => u.TwitchId == session.ChannelId);

                    if (channelUser == null)
                    {
                        _logger.LogWarning($"No se encontró usuario para ChannelId={session.ChannelId}");
                        continue;
                    }

                    var channelName = channelUser.Login;

                    // Finalizar el giveaway automáticamente
                    await giveawayService.EndGiveaway(session.ChannelId);

                    _logger.LogInformation($"✅ Giveaway {session.Id} finalizado automáticamente por tiempo límite");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error finalizando automáticamente giveaway {session.Id}");
                }
            }

            // ========================================================================
            // PASO 2: VERIFICAR TIMEOUTS DE RESPUESTAS DE GANADORES
            // ========================================================================
            var sessionsWithTimeouts = await dbContext.GiveawaySessions
                .Where(s => s.Status == "selecting_winners" && s.EndedAt != null)
                .ToListAsync();

            foreach (var session in sessionsWithTimeouts)
            {
                try
                {
                    // Deserializar config
                    var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot);
                    if (config == null) continue;

                    _logger.LogInformation($"[TIMEOUT] Sesión {session.Id}: WinnerResponseTimeout configurado = {config.WinnerResponseTimeout} segundos");

                    // Buscar ganadores sin respuesta que hayan expirado
                    var winners = await dbContext.GiveawayWinners
                        .Where(w => w.SessionId == session.Id
                            && !w.IsBackup
                            && !w.HasResponded
                            && !w.WasDisqualified
                            && !w.TimeoutProcessed)
                        .ToListAsync();

                    if (winners.Count > 0)
                    {
                        _logger.LogInformation($"[TIMEOUT] Sesión {session.Id}: {winners.Count} ganadores pendientes de procesar");
                    }

                    // IMPORTANTE: Procesar SOLO el primer ganador que haya expirado
                    // Los demás se procesarán en la siguiente iteración (5 segundos después)
                    var winnerToProcess = winners.FirstOrDefault(w =>
                    {
                        var timeoutSeconds = config.WinnerResponseTimeout;
                        var timeoutExpires = w.SelectedAt.AddSeconds(timeoutSeconds);
                        var hasExpired = now >= timeoutExpires;

                        _logger.LogInformation($"[TIMEOUT CHECK] Ganador ParticipantId={w.ParticipantId}: SelectedAt={w.SelectedAt:HH:mm:ss} UTC, Timeout={timeoutSeconds}seg, Expires={timeoutExpires:HH:mm:ss} UTC, Now={now:HH:mm:ss} UTC, HasExpired={hasExpired}");

                        return hasExpired;
                    });

                    if (winnerToProcess != null)
                    {
                        var winner = winnerToProcess;
                        var timeoutSeconds = config.WinnerResponseTimeout;
                        var timeoutExpires = winner.SelectedAt.AddSeconds(timeoutSeconds);

                        {
                            _logger.LogWarning($"⏰ Timeout expirado para ganador en sesión {session.Id} (SelectedAt={winner.SelectedAt:yyyy-MM-dd HH:mm:ss} UTC, Timeout={timeoutSeconds}seg)");

                            // Obtener datos del participante
                            var participant = await dbContext.GiveawayParticipants
                                .FirstOrDefaultAsync(p => p.Id == winner.ParticipantId);

                            if (participant == null) continue;

                            // Obtener nombre del canal
                            var channelUser = await dbContext.Users
                                .FirstOrDefaultAsync(u => u.TwitchId == session.ChannelId);

                            if (channelUser == null) continue;

                            var channelName = channelUser.Login;

                            // Marcar como procesado para no volver a procesarlo
                            winner.TimeoutProcessed = true;
                            await dbContext.SaveChangesAsync();

                            // AUTO-REROLL SI ESTÁ HABILITADO
                            if (config.AutoRerollOnTimeout)
                            {
                                _logger.LogInformation($"🔄 Auto-reroll habilitado. Procesando...");

                                // Anunciar que el ganador no respondió
                                var noResponseMsg = string.IsNullOrEmpty(config.NoResponseMessage)
                                    ? $"⏰ @{participant.Username} no respondió a tiempo."
                                    : config.NoResponseMessage.Replace("{winner}", participant.Username);

                                await messageSender.SendMessageAsync(channelName, noResponseMsg);

                                // Opción 1: Promover backup winner si existe
                                var backupWinner = await dbContext.GiveawayWinners
                                    .Where(w => w.SessionId == session.Id
                                        && w.IsBackup
                                        && w.Position == winner.Position
                                        && !w.WasDisqualified)
                                    .OrderBy(w => w.SelectedAt)
                                    .FirstOrDefaultAsync();

                                if (backupWinner != null && config.HasBackupWinners)
                                {
                                    // Promover backup a ganador principal
                                    _logger.LogInformation($"📈 Promoviendo backup winner a ganador principal");

                                    backupWinner.IsBackup = false;
                                    backupWinner.PromotedAt = DateTime.UtcNow;
                                    backupWinner.SelectedAt = DateTime.UtcNow; // IMPORTANTE: Reiniciar el timer de timeout
                                    backupWinner.TimeoutProcessed = false; // Permitir que sea procesado nuevamente
                                    await dbContext.SaveChangesAsync();

                                    var backupParticipant = await dbContext.GiveawayParticipants
                                        .FirstOrDefaultAsync(p => p.Id == backupWinner.ParticipantId);

                                    if (backupParticipant != null)
                                    {
                                        var promotionMsg = $"🎉 ¡Felicidades @{backupParticipant.Username}! Has sido promovido de respaldo a ganador principal. Tienes {config.WinnerResponseTimeout} segundos para responder.";
                                        await messageSender.SendMessageAsync(channelName, promotionMsg);
                                        _logger.LogInformation($"✅ Backup winner promovido: {backupParticipant.Username}");
                                    }
                                }
                                else
                                {
                                    // Opción 2: Hacer reroll completo
                                    _logger.LogInformation($"🎲 No hay backup winners. Haciendo reroll completo...");

                                    try
                                    {
                                        var newWinner = await giveawayService.RerollWinner(session.ChannelId, winner.Position);

                                        var newParticipant = await dbContext.GiveawayParticipants
                                            .FirstOrDefaultAsync(p => p.Id == newWinner.ParticipantId);

                                        if (newParticipant != null)
                                        {
                                            var rerollMsg = config.WinnerMessage
                                                .Replace("{winner}", newParticipant.Username)
                                                .Replace("{prize}", config.PrizeName ?? "el premio")
                                                .Replace("{timeout}", config.WinnerResponseTimeout.ToString());

                                            await messageSender.SendMessageAsync(channelName, rerollMsg);
                                            _logger.LogInformation($"✅ Nuevo ganador por reroll: {newParticipant.Username}");
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogError(ex, "Error al hacer reroll automático - No hay más participantes");

                                        // Verificar si todos los ganadores ya no respondieron
                                        var allWinnersTimeout = await dbContext.GiveawayWinners
                                            .Where(w => w.SessionId == session.Id && !w.IsBackup && !w.WasDisqualified)
                                            .AllAsync(w => w.TimeoutProcessed && !w.HasResponded);

                                        if (allWinnersTimeout)
                                        {
                                            // Ningún ganador respondió y no hay más participantes
                                            // Cancelar el giveaway
                                            _logger.LogWarning($"⚠️ Cancelando giveaway {session.Id} - Ningún ganador respondió y no hay más participantes");

                                            session.Status = "cancelled";
                                            session.CancelReason = "Ningún ganador respondió a tiempo y no hay más participantes disponibles";
                                            session.EndedAt = DateTime.UtcNow;
                                            session.UpdatedAt = DateTime.UtcNow;

                                            await dbContext.SaveChangesAsync();

                                            await messageSender.SendMessageAsync(channelName,
                                                "❌ Giveaway cancelado: Ningún ganador respondió a tiempo y no hay más participantes disponibles para re-sorteo.");

                                            // Salir del procesamiento para esta sesión
                                            break;
                                        }
                                        else
                                        {
                                            // Aún hay ganadores pendientes, solo anunciar que no hay más participantes
                                            var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                                            var gLang = await dbContext.Users.Where(u => u.Login == channelName.ToLower()).Select(u => u.PreferredLanguage).FirstOrDefaultAsync() ?? "es";
                                            await messageSender.SendMessageAsync(channelName, messagesService.GetMessage("giveaway_bg", "no_more_participants", gLang));
                                        }
                                    }
                                }
                            }
                            else
                            {
                                // NO AUTO-REROLL: Solo anunciar que no respondió
                                _logger.LogInformation($"⏰ Auto-reroll deshabilitado. Ganador sigue siendo válido.");

                                var noResponseMsg = string.IsNullOrEmpty(config.NoResponseMessage)
                                    ? $"⏰ @{participant.Username} no respondió a tiempo pero sigue siendo el ganador."
                                    : config.NoResponseMessage.Replace("{winner}", participant.Username);

                                await messageSender.SendMessageAsync(channelName, noResponseMsg);
                            }
                        }
                    }
                    else
                    {
                        // No hay ganadores que hayan expirado todavía
                        _logger.LogDebug($"No hay ganadores con timeout expirado en sesión {session.Id}");
                    }

                    // IMPORTANTE: Verificar si todos los ganadores han sido procesados
                    // Si es así, marcar la sesión como completed
                    // PERO solo si NO fue cancelada
                    if (session.Status == "selecting_winners") // Solo si sigue en selecting_winners
                    {
                        var allWinners = await dbContext.GiveawayWinners
                            .Where(w => w.SessionId == session.Id && !w.IsBackup && !w.WasDisqualified)
                            .ToListAsync();

                        var allProcessed = allWinners.All(w => w.HasResponded || w.TimeoutProcessed);

                        if (allProcessed && allWinners.Count > 0)
                        {
                            _logger.LogInformation($"✅ Todos los ganadores procesados. Marcando giveaway {session.Id} como completed");

                            session.Status = "completed";
                            session.UpdatedAt = DateTime.UtcNow;

                            await dbContext.SaveChangesAsync();

                            // Obtener nombre del canal para anuncio final
                            var channelUser = await dbContext.Users
                                .FirstOrDefaultAsync(u => u.TwitchId == session.ChannelId);

                            if (channelUser != null)
                            {
                                var channelNameFinal = channelUser.Login;
                                var respondedWinners = allWinners.Count(w => w.HasResponded);
                                await messageSender.SendMessageAsync(channelNameFinal,
                                    $"🎉 Giveaway completado. {respondedWinners} de {allWinners.Count} ganadores respondieron.");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error procesando timeouts para sesión {session.Id}");
                }
            }
        }
    }
}
