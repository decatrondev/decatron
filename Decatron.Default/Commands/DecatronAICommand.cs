using Decatron.Core.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Commands
{
    public class DecatronAICommand : ICommand
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<DecatronAICommand> _logger;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!ia";
        public string Description => "Pregunta a Decatron IA (desarrollado por AnthonyDeca)";

        public DecatronAICommand(
            IServiceScopeFactory scopeFactory,
            ILogger<DecatronAICommand> logger,
            ICommandMessagesService messagesService)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _messagesService = messagesService;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;
            var channelLower = channel.ToLower();
            var usernameLower = username.ToLower();

            try
            {
                _logger.LogInformation($"🤖 [DECATRON-IA] Comando !ia por {username} en {channel}");

                // Crear un nuevo scope para cada ejecución
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var aiProviderService = scope.ServiceProvider.GetRequiredService<AIProviderService>();
                var languageService = scope.ServiceProvider.GetRequiredService<ILanguageService>();

                // 1. Obtener configuración global
                var globalConfig = await dbContext.DecatronAIGlobalConfigs.FirstOrDefaultAsync();
                if (globalConfig == null || !globalConfig.Enabled)
                {
                    _logger.LogDebug($"[DECATRON-IA] Sistema deshabilitado globalmente");
                    return; // Silencioso si está deshabilitado
                }

                // 2. Verificar si el canal tiene permiso
                var channelPermission = await dbContext.DecatronAIChannelPermissions
                    .FirstOrDefaultAsync(c => c.ChannelName == channelLower && c.Enabled);

                if (channelPermission == null)
                {
                    _logger.LogDebug($"[DECATRON-IA] Canal {channel} no tiene permiso");
                    return; // Silencioso
                }

                // 3. Obtener config del canal (o usar defaults)
                var channelConfig = await dbContext.DecatronAIChannelConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == channelLower);

                // Obtener idioma del DUEÑO DEL CANAL (no del usuario que ejecuta el comando)
                string? userLanguage = null;
                var channelUserInfo = await dbContext.Users
                    .Where(u => u.Login == channelLower)
                    .Select(u => new { u.Id, u.PreferredLanguage })
                    .FirstOrDefaultAsync();

                if (channelUserInfo != null)
                {
                    userLanguage = channelUserInfo.PreferredLanguage;
                    _logger.LogDebug($"[DECATRON-IA] Canal {channel} tiene idioma: {userLanguage ?? "null"}");
                }
                userLanguage = userLanguage ?? "es"; // Default a español

                // 4. Verificar permisos del usuario
                var userCheckResult = CheckUserPermission(usernameLower, channelLower, channelConfig, channel, context, userLanguage);
                if (!userCheckResult.allowed)
                {
                    if (!string.IsNullOrEmpty(userCheckResult.message))
                    {
                        await messageSender.SendMessageAsync(channel, userCheckResult.message);
                    }
                    return;
                }

                // 5. Verificar cooldown del canal
                var channelCooldown = channelConfig?.ChannelCooldownSeconds ?? globalConfig.DefaultChannelCooldownSeconds;
                var channelCooldownResult = await CheckChannelCooldownAsync(dbContext, channelLower, channelCooldown);
                if (!channelCooldownResult.allowed)
                {
                    var minutes = channelCooldownResult.remainingSeconds / 60;
                    var seconds = channelCooldownResult.remainingSeconds % 60;
                    var timeStr = minutes > 0 ? $"{minutes}m {seconds}s" : $"{seconds}s";
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("ia", "channel_cooldown", userLanguage, username, timeStr));
                    return;
                }

                // 7. Verificar cooldown del usuario (si está configurado)
                if (channelConfig?.UserCooldownSeconds > 0)
                {
                    var userCooldownResult = await CheckUserCooldownAsync(dbContext, channelLower, usernameLower, channelConfig.UserCooldownSeconds.Value);
                    if (!userCooldownResult.allowed)
                    {
                        var minutes = userCooldownResult.remainingSeconds / 60;
                        var seconds = userCooldownResult.remainingSeconds % 60;
                        var timeStr = minutes > 0 ? $"{minutes}m {seconds}s" : $"{seconds}s";
                        await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("ia", "user_cooldown", userLanguage, username, timeStr));
                        return;
                    }
                }

                // 8. Extraer el prompt del mensaje
                var prompt = ExtractPrompt(message);
                if (string.IsNullOrWhiteSpace(prompt))
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("ia", "usage", userLanguage, username));
                    return;
                }

                // 9. Validar longitud del prompt
                if (prompt.Length > globalConfig.MaxPromptLength)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("ia", "prompt_too_long", userLanguage, username, globalConfig.MaxPromptLength));
                    return;
                }

                // 10. Obtener system prompt (personalizado o global)
                var systemPrompt = channelConfig?.CustomSystemPrompt ?? globalConfig.SystemPrompt;
                var responsePrefix = channelConfig?.CustomPrefix ?? globalConfig.ResponsePrefix;

                // 10.1. Agregar instrucción de idioma al system prompt para la IA
                string languageInstruction = userLanguage.ToLower() switch
                {
                    "en" => "\n\nIMPORTANT: Respond in English.",
                    "es" => "\n\nIMPORTANTE: Responde en español.",
                    _ => "\n\nIMPORTANTE: Responde en español." // Default a español
                };
                systemPrompt += languageInstruction;
                _logger.LogInformation($"[DECATRON-IA] Configurando respuesta en idioma: {userLanguage}");

                // 10.5. Detectar si la pregunta requiere información del chat
                var needsChatInfo = NeedsChatContext(prompt);
                if (needsChatInfo)
                {
                    _logger.LogInformation($"🔍 [DECATRON-IA] Pregunta requiere contexto del chat, obteniendo chatters...");
                    var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();
                    var chatters = await twitchApiService.GetChattersAsync(channelLower);

                    if (chatters.Any())
                    {
                        var chattersText = string.Join(", ", chatters);
                        var chatContext = $"\n\nCONTEXTO DEL CHAT:\nUsuarios actualmente conectados en el chat ({chatters.Count}): {chattersText}";
                        systemPrompt += chatContext;
                        _logger.LogInformation($"👥 [DECATRON-IA] Agregados {chatters.Count} chatters al contexto");
                    }
                    else
                    {
                        _logger.LogWarning($"⚠️ [DECATRON-IA] No se pudieron obtener chatters para {channel}");
                    }
                }

                // 11. Llamar al provider de IA (Gemini/OpenRouter con fallback)
                _logger.LogInformation($"🤖 [DECATRON-IA] Enviando prompt: '{prompt}'");
                var aiResponse = await aiProviderService.GenerateResponseAsync(
                    prompt,
                    systemPrompt,
                    globalConfig
                );

                // 12. Guardar en historial (PostgreSQL timestamptz requiere UTC)
                var usage = new DecatronAIUsage
                {
                    ChannelName = channelLower,
                    Username = usernameLower,
                    Prompt = prompt,
                    Response = aiResponse.Text,
                    TokensUsed = aiResponse.TokensUsed,
                    ResponseTimeMs = aiResponse.ResponseTimeMs,
                    Success = aiResponse.Success,
                    ErrorMessage = aiResponse.ErrorMessage,
                    UsedAt = DateTime.UtcNow
                };
                dbContext.DecatronAIUsages.Add(usage);
                await dbContext.SaveChangesAsync();

                // 13. Enviar respuesta
                if (aiResponse.Success && !string.IsNullOrEmpty(aiResponse.Text))
                {
                    var response = $"{responsePrefix} {aiResponse.Text}";

                    // Asegurar que no exceda límite de Twitch
                    if (response.Length > 490)
                    {
                        response = response.Substring(0, 487) + "...";
                    }

                    await messageSender.SendMessageAsync(channel, response);
                    _logger.LogInformation($"✅ [DECATRON-IA] Respuesta enviada a {channel}");
                }
                else
                {
                    // Usar el idioma del canal ya obtenido (userLanguage)
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("ia", "error_processing", userLanguage, username));
                    _logger.LogWarning($"⚠️ [DECATRON-IA] Error ({aiResponse.Provider}): {aiResponse.ErrorMessage}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ [DECATRON-IA] Error en comando !ia");
                // Obtener idioma del canal para mensajes de error
                var errorLang = "es";
                try
                {
                    using var errorScope = _scopeFactory.CreateScope();
                    var errorDbContext = errorScope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                    var channelLang = await errorDbContext.Users
                        .Where(u => u.Login == channelLower)
                        .Select(u => u.PreferredLanguage)
                        .FirstOrDefaultAsync();
                    errorLang = channelLang ?? "es";
                }
                catch { /* Si falla, usar español */ }
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("ia", "error_generic", errorLang, username));
            }
        }

        private (bool allowed, string? message) CheckUserPermission(
            string username, string channel, DecatronAIChannelConfig? config, string displayChannel, CommandContext context, string userLanguage = "es")
        {
            if (config == null)
            {
                // Sin config = todos pueden usar
                _logger.LogDebug($"[DECATRON-IA] Canal {channel} sin config, permitiendo a todos");
                return (true, null);
            }

            _logger.LogDebug($"[DECATRON-IA] Config para {channel}: PermissionLevel={config.PermissionLevel}, WhitelistEnabled={config.WhitelistEnabled}, WhitelistUsers={config.WhitelistUsers}, BlacklistUsers={config.BlacklistUsers}");

            // 1. Verificar blacklist primero (SIEMPRE tiene prioridad)
            var blacklist = ParseJsonArray(config.BlacklistUsers);
            if (blacklist.Contains(username))
            {
                _logger.LogInformation($"[DECATRON-IA] Usuario {username} en BLACKLIST de {channel}");
                return (false, null); // Silencioso para blacklist
            }

            // 2. Si whitelist está habilitada, SOLO usuarios en whitelist pueden usar
            if (config.WhitelistEnabled)
            {
                var whitelist = ParseJsonArray(config.WhitelistUsers);
                _logger.LogDebug($"[DECATRON-IA] Whitelist habilitada. Usuarios: [{string.Join(", ", whitelist)}]");

                if (whitelist.Contains(username))
                {
                    _logger.LogInformation($"[DECATRON-IA] Usuario {username} en WHITELIST de {channel} - PERMITIDO");
                    return (true, null); // En whitelist = permitido (ignora nivel de permiso)
                }

                _logger.LogDebug($"[DECATRON-IA] Usuario {username} NO en whitelist de {channel}");
                return (false, null); // No en whitelist = denegado silencioso
            }

            // 3. Si whitelist NO está habilitada, verificar nivel de permiso
            _logger.LogDebug($"[DECATRON-IA] Whitelist deshabilitada. Verificando nivel: {config.PermissionLevel}");

            if (config.PermissionLevel == "everyone")
            {
                return (true, null);
            }
            else if (config.PermissionLevel == "broadcaster")
            {
                if (username != channel)
                {
                    _logger.LogDebug($"[DECATRON-IA] {username} != {channel}, solo broadcaster permitido");
                    return (false, _messagesService.GetMessage("ia", "permission_denied_broadcaster", userLanguage, username));
                }
            }
            // Verificar nivel de permiso contra badges del usuario
            var permissionHierarchy = new Dictionary<string, int>
            {
                ["everyone"] = 0,
                ["subscriber"] = 1,
                ["vip"] = 2,
                ["moderator"] = 3,
                ["broadcaster"] = 4
            };

            var requiredLevel = permissionHierarchy.GetValueOrDefault(config.PermissionLevel, 0);
            var userLevel = 0;

            if (context.IsSubscriber) userLevel = Math.Max(userLevel, 1);
            if (context.IsVip) userLevel = Math.Max(userLevel, 2);
            if (context.IsModerator) userLevel = Math.Max(userLevel, 3);
            if (username == channel) userLevel = 4; // broadcaster

            if (userLevel < requiredLevel)
            {
                _logger.LogDebug($"[DECATRON-IA] {username} nivel {userLevel} < requerido {requiredLevel} ({config.PermissionLevel})");
                return (false, _messagesService.GetMessage("ia", "permission_denied_level", userLanguage, username));
            }

            return (true, null);
        }

        private async Task<(bool allowed, int remainingSeconds)> CheckChannelCooldownAsync(DecatronDbContext dbContext, string channel, int cooldownSeconds)
        {
            // Si cooldown es 0 o menor, siempre permitir
            if (cooldownSeconds <= 0)
            {
                _logger.LogDebug($"[DECATRON-IA] Channel cooldown deshabilitado (cooldown={cooldownSeconds})");
                return (true, 0);
            }

            var lastUse = await dbContext.DecatronAIUsages
                .Where(u => u.ChannelName == channel && u.Success)
                .OrderByDescending(u => u.UsedAt)
                .FirstOrDefaultAsync();

            if (lastUse == null)
            {
                _logger.LogDebug($"[DECATRON-IA] No hay uso previo en canal {channel}");
                return (true, 0);
            }

            // PostgreSQL timestamptz guarda en UTC, comparar con UTC
            var now = TimerDateTimeHelper.NowForDb();
            var elapsed = (now - lastUse.UsedAt).TotalSeconds;

            // Protección contra valores negativos (por problemas de reloj/datos corruptos)
            if (elapsed < 0)
            {
                _logger.LogWarning($"[DECATRON-IA] Tiempo transcurrido negativo detectado ({elapsed:F1}s). LastUse={lastUse.UsedAt}, Now={now}");
                elapsed = 0;
            }

            var remaining = cooldownSeconds - (int)elapsed;

            _logger.LogDebug($"[DECATRON-IA] Channel cooldown: elapsed={elapsed:F1}s, cooldown={cooldownSeconds}s, remaining={remaining}s");

            // Si ya pasó el cooldown, permitir
            if (remaining <= 0)
            {
                return (true, 0);
            }

            // Asegurar que nunca devolvemos valores negativos
            return (false, Math.Max(0, remaining));
        }

        private async Task<(bool allowed, int remainingSeconds)> CheckUserCooldownAsync(DecatronDbContext dbContext, string channel, string username, int cooldownSeconds)
        {
            // Si cooldown es 0 o menor, siempre permitir
            if (cooldownSeconds <= 0)
                return (true, 0);

            var lastUse = await dbContext.DecatronAIUsages
                .Where(u => u.ChannelName == channel && u.Username == username && u.Success)
                .OrderByDescending(u => u.UsedAt)
                .FirstOrDefaultAsync();

            if (lastUse == null)
                return (true, 0);

            // PostgreSQL timestamptz guarda en UTC, comparar con UTC
            var now = TimerDateTimeHelper.NowForDb();
            var elapsed = (now - lastUse.UsedAt).TotalSeconds;

            // Protección contra valores negativos
            if (elapsed < 0)
                elapsed = 0;

            var remaining = cooldownSeconds - (int)elapsed;

            // Si ya pasó el cooldown, permitir
            if (remaining <= 0)
                return (true, 0);

            return (false, Math.Max(0, remaining));
        }

        private string ExtractPrompt(string message)
        {
            // Remover el comando !ia del mensaje
            var parts = message.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length > 1 ? parts[1].Trim() : "";
        }

        private List<string> ParseJsonArray(string? json)
        {
            if (string.IsNullOrEmpty(json))
                return new List<string>();

            try
            {
                return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }

        private bool NeedsChatContext(string prompt)
        {
            var promptLower = prompt.ToLower();

            // Palabras clave que indican que necesita info del chat
            var keywords = new[]
            {
                "escoge", "elige", "selecciona", "sortea", "sortear",
                "personas del chat", "usuarios del chat", "gente del chat",
                "alguien del chat", "quien del chat", "quién del chat",
                "chatters", "viewers", "espectadores",
                "en el chat", "del chat", "al chat",
                "usuario", "personas", "gente", "alguien", "quien", "quién",
                "random", "aleatorio", "azar",
                "lista de", "cuantos", "cuántos"
            };

            return keywords.Any(keyword => promptLower.Contains(keyword));
        }
    }
}
