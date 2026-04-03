using System.Text;
using System.Text.Json;
using DSharpPlus;
using DSharpPlus.Entities;
using DSharpPlus.EventArgs;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using Decatron.Discord.Commands;
using Decatron.Discord.Models;

namespace Decatron.Discord;

public class DiscordBotService : BackgroundService
{
    private readonly DiscordClientProvider _clientProvider;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DiscordBotService> _logger;
    private readonly DiscordSettings _settings;
    private DecatronSlashCommands? _commandHandler;

    private static readonly string CommandsJson = JsonSerializer.Serialize(new object[]
    {
        new { name = "live", description = "Muestra si el streamer esta en vivo", type = 1, options = new[] { new { name = "canal", description = "Canal de Twitch (opcional)", type = 3, required = false, autocomplete = true } } },
        new { name = "timer", description = "Muestra el estado actual del timer", type = 1, options = new[] { new { name = "canal", description = "Canal de Twitch (opcional)", type = 3, required = false, autocomplete = true } } },
        new { name = "stats", description = "Muestra estadisticas del stream", type = 1, options = new[] { new { name = "canal", description = "Canal de Twitch (opcional)", type = 3, required = false, autocomplete = true } } },
        new { name = "followage", description = "Muestra desde cuando sigues el canal", type = 1, options = new object[] {
            new { name = "discord", description = "Usuario de Discord (por defecto: tu)", type = 6, required = false },
            new { name = "twitch", description = "Nombre de Twitch (auto-detecta si no pones)", type = 3, required = false },
            new { name = "canal", description = "Canal de Twitch (por defecto: el del servidor)", type = 3, required = false, autocomplete = true }
        }},
        new { name = "song", description = "Muestra la cancion que esta sonando", type = 1, options = new[] { new { name = "canal", description = "Canal de Twitch (opcional)", type = 3, required = false, autocomplete = true } } },
        new { name = "level", description = "Muestra tu nivel y XP", type = 1, options = new object[] { new { name = "user", description = "Usuario de Discord (opcional)", type = 6, required = false } } },
        new { name = "top", description = "Muestra el ranking de niveles", type = 1, options = new object[] { new { name = "tipo", description = "Tipo de ranking", type = 3, required = false, choices = new object[] { new { name = "Servidor", value = "server" }, new { name = "Global", value = "global" }, new { name = "Mensual", value = "monthly" } } }, new { name = "pagina", description = "Numero de pagina", type = 4, required = false } } },
        new { name = "achievements", description = "Muestra tus logros y badges", type = 1 },
        new { name = "shop", description = "Tienda de XP — compra rewards", type = 1, options = new object[] {
            new { name = "buy", description = "Nombre del item a comprar", type = 3, required = false }
        }},
        new { name = "xp", description = "Gestiona el sistema de XP (admin)", type = 1, options = new object[] {
            new { name = "give", description = "Dar XP a un usuario", type = 1, options = new object[] {
                new { name = "user", description = "Usuario", type = 6, required = true },
                new { name = "amount", description = "Cantidad de XP", type = 4, required = true }
            }},
            new { name = "remove", description = "Quitar XP a un usuario", type = 1, options = new object[] {
                new { name = "user", description = "Usuario", type = 6, required = true },
                new { name = "amount", description = "Cantidad de XP", type = 4, required = true }
            }},
            new { name = "reset", description = "Resetear XP de un usuario", type = 1, options = new object[] {
                new { name = "user", description = "Usuario", type = 6, required = true }
            }},
            new { name = "set", description = "Setear XP exacto", type = 1, options = new object[] {
                new { name = "user", description = "Usuario", type = 6, required = true },
                new { name = "amount", description = "Cantidad de XP", type = 4, required = true }
            }},
            new { name = "boost", description = "Activar XP boost temporal", type = 1, options = new object[] {
                new { name = "multiplier", description = "Multiplicador", type = 3, required = true, choices = new object[] {
                    new { name = "1.5x", value = "1.5" }, new { name = "2x", value = "2" },
                    new { name = "3x", value = "3" }, new { name = "5x", value = "5" }
                }},
                new { name = "duration", description = "Duracion", type = 3, required = true, choices = new object[] {
                    new { name = "30 minutos", value = "0.5" }, new { name = "1 hora", value = "1" },
                    new { name = "2 horas", value = "2" }, new { name = "4 horas", value = "4" },
                    new { name = "8 horas", value = "8" }, new { name = "24 horas", value = "24" }
                }}
            }}
        }},
    });

    public DiscordBotService(
        DiscordClientProvider clientProvider,
        IServiceProvider serviceProvider,
        ILogger<DiscordBotService> logger,
        IOptions<DiscordSettings> settings)
    {
        _clientProvider = clientProvider;
        _serviceProvider = serviceProvider;
        _logger = logger;
        _settings = settings.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var client = _clientProvider.Client;

        try
        {
            // Create command handler
            _commandHandler = ActivatorUtilities.CreateInstance<DecatronSlashCommands>(_serviceProvider);

            // Handle interactions manually (bypass DSharpPlus slash command bugs)
            client.InteractionCreated += OnInteractionCreated;

            // Register welcome/goodbye events
            var welcomeHandler = _serviceProvider.GetRequiredService<Decatron.Discord.Events.WelcomeHandler>();
            welcomeHandler.RegisterEvents();

            // Register XP message handler
            var xpHandler = _serviceProvider.GetRequiredService<Decatron.Discord.Events.MessageXpHandler>();
            xpHandler.RegisterEvents();

            // Auto-register commands when bot joins a new server
            client.GuildCreated += async (sender, e) =>
            {
                try
                {
                    await RegisterCommandsForGuild(e.Guild.Id, e.Guild.Name);
                    _logger.LogInformation("Auto-registered commands for new guild: {Guild}", e.Guild.Name);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error auto-registering commands for {Guild}", e.Guild.Name);
                }
            };

            // Connect
            await client.ConnectAsync(new DiscordActivity("twitch.decatron.net", ActivityType.Watching));
            _logger.LogInformation("Discord bot conectado exitosamente");

            // Wait for guilds
            await Task.Delay(3000, stoppingToken);

            // Register commands via Discord API
            await RegisterCommandsViaApi(client);

            // Keep alive
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (TaskCanceledException)
        {
            _logger.LogInformation("Discord bot deteniendo...");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en Discord bot");
        }
        finally
        {
            client.InteractionCreated -= OnInteractionCreated;
            await client.DisconnectAsync();
            _logger.LogInformation("Discord bot desconectado");
        }
    }

    private async Task OnInteractionCreated(DiscordClient sender, InteractionCreateEventArgs e)
    {
        if (e.Interaction.Type == InteractionType.ApplicationCommand)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var name = e.Interaction.Data.Name;
                    var options = e.Interaction.Data.Options;

                    // Get option values
                    string? canal = null;
                    string? twitch = null;
                    DiscordUser? discordUser = null;

                    if (options != null)
                    {
                        foreach (var opt in options)
                        {
                            if (opt.Name == "canal") canal = opt.Value?.ToString();
                            else if (opt.Name == "twitch") twitch = opt.Value?.ToString();
                            else if (opt.Name == "discord" && opt.Value != null)
                            {
                                if (ulong.TryParse(opt.Value.ToString(), out var userId))
                                {
                                    try { discordUser = await sender.GetUserAsync(userId); } catch { }
                                }
                            }
                        }
                    }

                    // Defer immediately
                    await e.Interaction.CreateResponseAsync(InteractionResponseType.DeferredChannelMessageWithSource);

                    // Route to handler
                    var webhook = new DiscordWebhookBuilder();
                    DiscordEmbedBuilder? embed = null;

                    switch (name)
                    {
                        case "live":
                            embed = await _commandHandler!.HandleLive(e.Interaction, canal);
                            break;
                        case "timer":
                            embed = await _commandHandler!.HandleTimer(e.Interaction, canal);
                            break;
                        case "stats":
                            embed = await _commandHandler!.HandleStats(e.Interaction, canal);
                            break;
                        case "followage":
                            embed = await _commandHandler!.HandleFollowage(e.Interaction, discordUser, twitch, canal);
                            break;
                        case "song":
                            embed = await _commandHandler!.HandleSong(e.Interaction, canal);
                            break;
                        case "level":
                            {
                                // Parse optional user parameter
                                DiscordUser? levelTarget = null;
                                if (options != null)
                                {
                                    var userOpt = options.FirstOrDefault(o => o.Name == "user");
                                    if (userOpt?.Value != null && ulong.TryParse(userOpt.Value.ToString(), out var uid))
                                    {
                                        try { levelTarget = await sender.GetUserAsync(uid); } catch { }
                                    }
                                }
                                // HandleLevel returns null — it sends the image directly via webhook
                                await _commandHandler!.HandleLevel(e.Interaction, levelTarget);
                                return; // Already responded
                            }
                        case "top":
                            {
                                string? topType = null;
                                int? topPage = null;
                                if (options != null)
                                {
                                    var tipoOpt = options.FirstOrDefault(o => o.Name == "tipo");
                                    if (tipoOpt?.Value != null) topType = tipoOpt.Value.ToString();
                                    var pageOpt = options.FirstOrDefault(o => o.Name == "pagina");
                                    if (pageOpt?.Value != null && int.TryParse(pageOpt.Value.ToString(), out var p)) topPage = p;
                                }
                                embed = await _commandHandler!.HandleTop(e.Interaction, topType, topPage);
                                break;
                            }
                        case "xp":
                            {
                                // /xp has subcommands: give, remove, reset, set, boost
                                var subCommand = options?.FirstOrDefault();
                                if (subCommand == null) { webhook.WithContent("Usa un subcomando: give, remove, reset, set, boost"); break; }

                                var subName = subCommand.Name;
                                var subOpts = subCommand.Options?.ToList();

                                // Parse common params
                                DiscordUser? xpTargetUser = null;
                                long xpAmount = 0;

                                if (subOpts != null)
                                {
                                    var userOpt = subOpts.FirstOrDefault(o => o.Name == "user");
                                    if (userOpt?.Value != null && ulong.TryParse(userOpt.Value.ToString(), out var uid))
                                    {
                                        try { xpTargetUser = await sender.GetUserAsync(uid); } catch { }
                                    }
                                    var amtOpt = subOpts.FirstOrDefault(o => o.Name == "amount");
                                    if (amtOpt?.Value != null) long.TryParse(amtOpt.Value.ToString(), out xpAmount);
                                }

                                embed = subName switch
                                {
                                    "give" => await _commandHandler!.HandleXpGive(e.Interaction, xpTargetUser, (int)xpAmount),
                                    "remove" => await _commandHandler!.HandleXpRemove(e.Interaction, xpTargetUser, (int)xpAmount),
                                    "reset" => await _commandHandler!.HandleXpReset(e.Interaction, xpTargetUser),
                                    "set" => await _commandHandler!.HandleXpSet(e.Interaction, xpTargetUser, xpAmount),
                                    "boost" => await _commandHandler!.HandleXpBoost(e.Interaction,
                                        subOpts?.FirstOrDefault(o => o.Name == "multiplier")?.Value?.ToString(),
                                        subOpts?.FirstOrDefault(o => o.Name == "duration")?.Value?.ToString()),
                                    _ => new DiscordEmbedBuilder().WithTitle("Subcomando desconocido").WithColor(new DiscordColor("#ef4444"))
                                };
                                break;
                            }
                        case "achievements":
                            embed = await _commandHandler!.HandleAchievements(e.Interaction);
                            break;
                        case "shop":
                            {
                                string? buyItem = null;
                                if (options != null)
                                {
                                    var buyOpt = options.FirstOrDefault(o => o.Name == "buy");
                                    if (buyOpt?.Value != null) buyItem = buyOpt.Value.ToString();
                                }
                                embed = await _commandHandler!.HandleShop(e.Interaction, buyItem);
                                break;
                            }
                        default:
                            webhook.WithContent($"Comando desconocido: {name}");
                            break;
                    }

                    if (embed != null)
                        webhook.AddEmbed(embed);
                    else if (string.IsNullOrEmpty(webhook.Content))
                        webhook.WithContent("Error procesando el comando.");

                    await e.Interaction.EditOriginalResponseAsync(webhook);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error handling interaction {Command}", e.Interaction.Data.Name);
                    try
                    {
                        await e.Interaction.EditOriginalResponseAsync(new DiscordWebhookBuilder()
                            .WithContent("Error al procesar el comando."));
                    }
                    catch { }
                }
            });
        }
        else if (e.Interaction.Type == InteractionType.AutoComplete)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await _commandHandler!.HandleAutocomplete(e.Interaction);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error in autocomplete");
                }
            });
        }
    }

    private async Task RegisterCommandsViaApi(DiscordClient client)
    {
        using var http = new HttpClient();
        http.DefaultRequestHeaders.Add("Authorization", $"Bot {_settings.BotToken}");

        // Clean global commands
        try
        {
            await http.PutAsync(
                $"https://discord.com/api/v10/applications/{_settings.AppId}/commands",
                new StringContent("[]", Encoding.UTF8, "application/json"));
            _logger.LogInformation("Global commands limpiados");
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Error limpiando global commands"); }

        // Register per-guild
        foreach (var guild in client.Guilds.Values)
        {
            try
            {
                var response = await http.PutAsync(
                    $"https://discord.com/api/v10/applications/{_settings.AppId}/guilds/{guild.Id}/commands",
                    new StringContent(CommandsJson, Encoding.UTF8, "application/json"));

                if (response.IsSuccessStatusCode)
                    _logger.LogInformation("Slash commands registrados en {Guild} ({Id})", guild.Name, guild.Id);
                else
                    _logger.LogWarning("Error registrando en {Guild}: {Status}", guild.Name, response.StatusCode);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Error registrando en {Guild}", guild.Name); }
        }
    }

    private async Task RegisterCommandsForGuild(ulong guildId, string guildName)
    {
        using var http = new HttpClient();
        http.DefaultRequestHeaders.Add("Authorization", $"Bot {_settings.BotToken}");

        var response = await http.PutAsync(
            $"https://discord.com/api/v10/applications/{_settings.AppId}/guilds/{guildId}/commands",
            new StringContent(CommandsJson, Encoding.UTF8, "application/json"));

        if (response.IsSuccessStatusCode)
            _logger.LogInformation("Slash commands registrados en {Guild} ({Id})", guildName, guildId);
        else
            _logger.LogWarning("Error registrando en {Guild}: {Status}", guildName, response.StatusCode);
    }
}
