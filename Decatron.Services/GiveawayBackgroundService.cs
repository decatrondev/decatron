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
        private readonly Decatron.Services.Tenancy.TenantTaskRunner _tenants;

        public GiveawayBackgroundService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<GiveawayBackgroundService> logger,
            Decatron.Services.Tenancy.TenantTaskRunner tenants)
        {
            _tenants = tenants;
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
                    await _tenants.ForEachTenantAsync("giveaway", _ => CheckGiveawayTimeouts(), stoppingToken, module: "module.giveaways");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en GiveawayBackgroundService");
                }

                // Con ganadores esperando respuesta se mira cada segundo: al llegar el plazo a 0 el aviso sale en ese momento
                await Task.Delay(GiveawayService.AnyPendingWinners() ? TimeSpan.FromSeconds(1) : _checkInterval, stoppingToken);
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
            // PASO 1b: RECORDATORIOS DE LOS GIVEAWAYS ACTIVOS
            // ========================================================================
            try
            {
                await giveawayService.SendDueRemindersAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando recordatorios de giveaway");
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

                    _logger.LogDebug($"[TIMEOUT] Sesión {session.Id}: WinnerResponseTimeout configurado = {config.WinnerResponseTimeout} segundos");
                    var bgSettings = GiveawaySettings.Parse(config.Settings);

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

                    // Todos los ganadores cuyo plazo llegó a 0 se procesan JUNTOS en esta pasada y se avisan en UN solo mensaje
                    var expiredWinners = winners.Where(w => now >= w.SelectedAt.AddSeconds(config.WinnerResponseTimeout)).OrderBy(w => w.Position).ToList();

                    if (expiredWinners.Count > 0)
                    {
                        _logger.LogWarning($"⏰ Timeout expirado en sesión {session.Id}: {expiredWinners.Count} ganador(es) (Timeout={config.WinnerResponseTimeout}seg)");

                        var channelUser = await dbContext.Users.FirstOrDefaultAsync(u => u.TwitchId == session.ChannelId);
                        if (channelUser == null) continue;
                        var channelName = channelUser.Login;

                        var expiredNames = new System.Collections.Generic.List<string>();
                        foreach (var w in expiredWinners)
                        {
                            var pName = await dbContext.GiveawayParticipants.Where(p => p.Id == w.ParticipantId).Select(p => p.Username).FirstOrDefaultAsync();
                            if (pName != null) expiredNames.Add(pName);
                            w.TimeoutProcessed = true;   // para no procesarlo otra vez
                        }
                        await dbContext.SaveChangesAsync();

                        // Un solo aviso con todos los nombres: «@a, @b y @c no respondieron a tiempo…»
                        var root = GiveawayCommandRules.Normalize(bgSettings.Commands.Root, "!giveaway");
                        var many = expiredNames.Count > 1;
                        var nameList = many ? string.Join(", ", expiredNames.Select(n => "@" + n)) : expiredNames.FirstOrDefault() ?? "";
                        string noResponseMsg;
                        if (config.AutoRerollOnTimeout)
                        {
                            noResponseMsg = many
                                ? $"⏰ {nameList} no respondieron a tiempo."
                                : string.IsNullOrEmpty(config.NoResponseMessage)
                                    ? $"⏰ @{nameList} no respondió a tiempo."
                                    : config.NoResponseMessage.Replace("{winner}", nameList);
                        }
                        else
                        {
                            noResponseMsg = many
                                ? (string.IsNullOrWhiteSpace(bgSettings.Messages.NoResponseKeptMany) ? GiveawayMessages.DefaultNoResponseKeptMany : bgSettings.Messages.NoResponseKeptMany)
                                : (string.IsNullOrWhiteSpace(bgSettings.Messages.NoResponseKept) ? GiveawayMessages.DefaultNoResponseKept : bgSettings.Messages.NoResponseKept);
                            noResponseMsg = noResponseMsg.Replace("{winner}", nameList).Replace("{winners}", nameList).Replace("{user}", nameList)
                                .Replace("{prize}", config.PrizeName ?? "").Replace("{root}", root);
                        }
                        if (expiredNames.Count > 0) await giveawayService.AnnounceAsync(channelName, noResponseMsg);

                        // Re-sorteo automático: cada lugar vencido se cubre con un respaldo o con un sorteo
                        if (config.AutoRerollOnTimeout)
                        {
                            foreach (var winner in expiredWinners)
                            {
                                var backupWinner = await dbContext.GiveawayWinners
                                    .Where(w => w.SessionId == session.Id && w.IsBackup && w.Position == winner.Position && !w.WasDisqualified)
                                    .OrderBy(w => w.SelectedAt)
                                    .FirstOrDefaultAsync();

                                if (backupWinner != null && config.HasBackupWinners)
                                {
                                    backupWinner.IsBackup = false;
                                    backupWinner.PromotedAt = DateTime.UtcNow;
                                    // El plazo se reinicia; con overlay, cuenta desde que termina la ruleta
                                    backupWinner.SelectedAt = await giveawayService.BeginRevealRoundAsync(session);
                                    backupWinner.TimeoutProcessed = false;
                                    await dbContext.SaveChangesAsync();

                                    var backupParticipant = await dbContext.GiveawayParticipants.FirstOrDefaultAsync(p => p.Id == backupWinner.ParticipantId);
                                    if (backupParticipant != null)
                                    {
                                        var promotionMsg = (string.IsNullOrWhiteSpace(bgSettings.Messages.Promoted) ? GiveawayMessages.DefaultPromoted : bgSettings.Messages.Promoted)
                                            .Replace("{winner}", backupParticipant.Username).Replace("{user}", backupParticipant.Username)
                                            .Replace("{timeout}", config.WinnerResponseTimeout.ToString()).Replace("{prize}", config.PrizeName ?? "");
                                        await giveawayService.AnnounceAtAsync(channelName, promotionMsg, backupWinner.SelectedAt);
                                    }
                                }
                                else
                                {
                                    try
                                    {
                                        var newWinner = await giveawayService.RerollWinner(session.ChannelId, winner.Position, session.Id);
                                        var newParticipant = await dbContext.GiveawayParticipants.FirstOrDefaultAsync(p => p.Id == newWinner.ParticipantId);
                                        if (newParticipant != null)
                                        {
                                            var rerollMsg = config.WinnerMessage
                                                .Replace("{winner}", newParticipant.Username)
                                                .Replace("{prize}", config.PrizeName ?? "el premio")
                                                .Replace("{timeout}", config.WinnerResponseTimeout.ToString());
                                            await giveawayService.AnnounceAtAsync(channelName, rerollMsg, newWinner.SelectedAt);
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogError(ex, "Error al hacer reroll automático - No hay más participantes");

                                        var allWinnersTimeout = await dbContext.GiveawayWinners
                                            .Where(w => w.SessionId == session.Id && !w.IsBackup && !w.WasDisqualified)
                                            .AllAsync(w => w.TimeoutProcessed && !w.HasResponded);

                                        if (allWinnersTimeout)
                                        {
                                            // Ningún ganador respondió y no hay más participantes: se cancela
                                            session.Status = "cancelled";
                                            session.CancelReason = "Ningún ganador respondió a tiempo y no hay más participantes disponibles";
                                            session.EndedAt = DateTime.UtcNow;
                                            session.UpdatedAt = DateTime.UtcNow;
                                            await dbContext.SaveChangesAsync();
                                            await giveawayService.AnnounceAsync(channelName,
                                                "❌ Giveaway cancelado: Ningún ganador respondió a tiempo y no hay más participantes disponibles para re-sorteo.");
                                            break;
                                        }
                                        else
                                        {
                                            var messagesService = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();
                                            var gLang = await dbContext.Users.Where(u => u.Login == channelName.ToLower()).Select(u => u.PreferredLanguage).FirstOrDefaultAsync() ?? "es";
                                            await giveawayService.AnnounceAsync(channelName, messagesService.GetMessage("giveaway_bg", "no_more_participants", gLang));
                                            break;
                                        }
                                    }
                                }
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

                        // «Uno por uno»: el giveaway sigue abierto entre ganadores hasta confirmar todos los lugares (o cancelarlo)
                        var canComplete = GiveawayDrawPlan.ShouldComplete(allWinners.Select(w => new DrawWinnerRow(w.Position, w.ParticipantId, w.IsBackup, w.HasResponded, w.TimeoutProcessed, w.WasDisqualified)),
                            config.NumberOfWinners, bgSettings.Draw, config.AutoRerollOnTimeout);

                        if (canComplete)
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
                                var completedText = (string.IsNullOrWhiteSpace(bgSettings.Messages.Completed) ? GiveawayMessages.DefaultCompleted : bgSettings.Messages.Completed)
                                    .Replace("{responded}", respondedWinners.ToString()).Replace("{total}", Math.Max(config.NumberOfWinners, allWinners.Count).ToString())
                                    .Replace("{prize}", config.PrizeName ?? "");
                                await giveawayService.AnnounceAsync(channelNameFinal, completedText);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error procesando timeouts para sesión {session.Id}");
                }
            }

            // Estado para el overlay de OBS: cubre las transiciones por tiempo y lo que cambió en esta pasada
            try
            {
                await scope.ServiceProvider.GetRequiredService<GiveawayOverlayService>().PublishRecentAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error publicando el estado del giveaway al overlay");
            }
        }
    }
}
