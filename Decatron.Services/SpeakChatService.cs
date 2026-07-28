using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Decatron.Services
{
    public class SpeakChatService : ISpeakChatService
    {
        private readonly DecatronDbContext _context;
        private readonly ILogger<SpeakChatService> _logger;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ITtsService _ttsService;
        private readonly ITtsCreditService _creditService;

        // Cooldown global por canal: key = channelName
        private static readonly ConcurrentDictionary<string, DateTime> _globalCooldowns = new();
        // Cooldown por usuario: key = "channelName:twitchUserId"
        private static readonly ConcurrentDictionary<string, DateTime> _perUserCooldowns = new();

        // Canjes ya procesados: key = "channelName:rewardId:twitchUserId".
        // Un mismo canje puede llegar dos veces (por el mensaje de chat con
        // channel_points_custom_reward_id y por el evento de redención), así que
        // solo el primero que llega dispara el TTS.
        private static readonly ConcurrentDictionary<string, DateTime> _recentRedemptions = new();
        private static readonly TimeSpan _redemptionDedupeWindow = TimeSpan.FromSeconds(30);

        public SpeakChatService(
            DecatronDbContext context,
            ILogger<SpeakChatService> logger,
            OverlayNotificationService overlayNotificationService,
            ITtsService ttsService,
            ITtsCreditService creditService)
        {
            _context = context;
            _logger = logger;
            _overlayNotificationService = overlayNotificationService;
            _ttsService = ttsService;
            _creditService = creditService;
        }

        public async Task<SpeakChatConfig?> GetConfigAsync(long userId)
        {
            return await _context.SpeakChatConfigs.FirstOrDefaultAsync(c => c.UserId == userId);
        }

        public async Task<SpeakChatConfig?> GetConfigByChannelAsync(string channelName)
        {
            var channelUserId = await ChannelResolver.ResolveUserIdAsync(_context, channelName);
            if (channelUserId != null)
            {
                var config = await _context.SpeakChatConfigs.FirstOrDefaultAsync(c => c.UserId == channelUserId);
                if (config != null) return config;
            }
            return await _context.SpeakChatConfigs
                .FirstOrDefaultAsync(c => c.ChannelName.ToLower() == channelName.ToLower());
        }

        public async Task<SpeakChatConfig> SaveConfigAsync(long userId, string channelName, string configJson)
        {
            var existing = await GetConfigAsync(userId);

            if (existing != null)
            {
                existing.ChannelName = channelName;
                existing.ConfigJson = configJson;
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            else
            {
                existing = new SpeakChatConfig
                {
                    UserId = userId,
                    ChannelName = channelName,
                    ConfigJson = configJson,
                    IsEnabled = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.SpeakChatConfigs.Add(existing);
                await _context.SaveChangesAsync();
            }

            await _overlayNotificationService.SendToChannel(channelName, "SpeakChatConfigChanged", new { });
            return existing;
        }

        public async Task ProcessChatMessageAsync(
            string channelName,
            string username,
            string userId,
            string message,
            bool isBroadcaster,
            bool isModerator,
            bool isVip,
            bool isSubscriber,
            int bitsAmount,
            string? channelPointsRewardId,
            Dictionary<string, object>? metadata,
            bool isLeadModerator = false)
        {
            try
            {
                // El mod líder cuenta como moderador para los permisos. Twitch le da su
                // propia insignia en lugar de la de moderator, así que si no se suma aquí
                // el usuario con MÁS rango es el único al que se le niega el paso.
                isModerator = isModerator || isLeadModerator;

                var config = await GetConfigByChannelAsync(channelName);
                if (config == null || !config.IsEnabled) return;

                JsonElement cfg;
                try { cfg = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson); }
                catch
                {
                    _logger.LogWarning("[SpeakChat] {Channel}: la configuración guardada no es JSON válido", channelName);
                    return;
                }

                // Verificar enabled global
                //
                // Este corte era mudo, y desde el chat se ve idéntico a que esté roto:
                // llegó el comando y no pasó nada. Se dejó una tarde entera buscando en
                // la base de datos algo que una línea de registro responde al momento.
                if (cfg.TryGetProperty("global", out var global) &&
                    global.TryGetProperty("enabled", out var enabledProp) &&
                    !enabledProp.GetBoolean())
                {
                    _logger.LogInformation(
                        "[SpeakChat] {Channel}: llegó un mensaje de {User} pero Speak Chat está DESACTIVADO",
                        channelName, username);
                    return;
                }

                // ===== REGLAS DE ACTIVACIÓN =====
                if (!cfg.TryGetProperty("activation", out var activation))
                {
                    _logger.LogWarning("[SpeakChat] {Channel}: no hay reglas de activación configuradas", channelName);
                    return;
                }

                var activated = false;
                var textToSpeak = message;

                if (activation.TryGetProperty("rules", out var rulesArr) && rulesArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var rule in rulesArr.EnumerateArray())
                    {
                        if (!rule.TryGetProperty("enabled", out var ruleEnabled) || !ruleEnabled.GetBoolean())
                            continue;

                        var ruleType = rule.TryGetProperty("type", out var rt) ? rt.GetString() : null;

                        switch (ruleType)
                        {
                            case "command":
                            {
                                var cmdName = (rule.TryGetProperty("commandName", out var cn) ? cn.GetString() : null)?.Trim();
                                if (string.IsNullOrWhiteSpace(cmdName)) cmdName = "!tts";

                                if (!MatchesCommand(message, cmdName)) break;

                                // El comando es correcto: a partir de aquí, si no suena,
                                // hay un motivo concreto y merece quedar escrito.
                                if (!IsRoleAllowed(rule, isBroadcaster, isModerator, isVip, isSubscriber))
                                {
                                    _logger.LogInformation(
                                        "[SpeakChat] {Channel}: {User} usó {Cmd} pero su rol no está permitido",
                                        channelName, username, cmdName);
                                    break;
                                }

                                textToSpeak = message.Length > cmdName.Length
                                    ? message.Substring(cmdName.Length).Trim()
                                    : string.Empty;

                                if (string.IsNullOrWhiteSpace(textToSpeak))
                                {
                                    _logger.LogInformation(
                                        "[SpeakChat] {Channel}: {User} escribió {Cmd} sin texto detrás",
                                        channelName, username, cmdName);
                                    break;
                                }

                                activated = true;
                                break;
                            }
                            case "bits":
                            {
                                var minBits = rule.TryGetProperty("minBits", out var mb) ? mb.GetInt32() : 1;
                                if (bitsAmount >= minBits && bitsAmount > 0 &&
                                    IsRoleAllowed(rule, isBroadcaster, isModerator, isVip, isSubscriber))
                                    activated = true;
                                break;
                            }
                            case "channelPoints":
                            {
                                var rewardId = rule.TryGetProperty("rewardId", out var rid) ? rid.GetString() : null;
                                if (!string.IsNullOrEmpty(rewardId) && rewardId == channelPointsRewardId &&
                                    IsRoleAllowed(rule, isBroadcaster, isModerator, isVip, isSubscriber))
                                {
                                    // Evita el doble TTS si el evento de redención llega también
                                    if (!TryMarkRedemption(channelName, rewardId, userId)) return;
                                    activated = true;
                                }
                                break;
                            }
                            case "roles":
                            {
                                if (IsRoleAllowed(rule, isBroadcaster, isModerator, isVip, isSubscriber))
                                    activated = true;
                                break;
                            }
                            case "all":
                            {
                                activated = true;
                                break;
                            }
                        }

                        if (activated) break;
                    }
                }

                if (!activated) return;

                await SpeakAsync(cfg, channelName, username, userId, textToSpeak);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error procesando mensaje de chat en {Channel}", channelName);
            }
        }

        public async Task ProcessChannelPointRedemptionAsync(
            string channelName,
            string username,
            string userId,
            string rewardId,
            string? userInput,
            bool isBroadcaster)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userInput))
                {
                    _logger.LogDebug("[SpeakChat] Canje de {Reward} en {Channel} sin texto, se ignora", rewardId, channelName);
                    return;
                }

                var config = await GetConfigByChannelAsync(channelName);
                if (config == null || !config.IsEnabled) return;

                JsonElement cfg;
                try { cfg = JsonSerializer.Deserialize<JsonElement>(config.ConfigJson); }
                catch { return; }

                if (cfg.TryGetProperty("global", out var global) &&
                    global.TryGetProperty("enabled", out var enabledProp) &&
                    !enabledProp.GetBoolean())
                    return;

                if (!cfg.TryGetProperty("activation", out var activation)) return;
                if (!activation.TryGetProperty("rules", out var rulesArr) || rulesArr.ValueKind != JsonValueKind.Array)
                    return;

                var matched = false;
                foreach (var rule in rulesArr.EnumerateArray())
                {
                    if (!rule.TryGetProperty("enabled", out var ruleEnabled) || !ruleEnabled.GetBoolean())
                        continue;
                    if (!rule.TryGetProperty("type", out var rt) || rt.GetString() != "channelPoints")
                        continue;

                    var configuredRewardId = rule.TryGetProperty("rewardId", out var rid) ? rid.GetString() : null;
                    if (string.IsNullOrEmpty(configuredRewardId) || configuredRewardId != rewardId)
                        continue;

                    // En el evento de redención Twitch no manda badges, así que solo
                    // conocemos si el que canjea es el propio streamer.
                    if (!IsRoleAllowed(rule, isBroadcaster, false, false, false))
                    {
                        _logger.LogDebug("[SpeakChat] Canje de {User} en {Channel} bloqueado por roles de la regla", username, channelName);
                        continue;
                    }

                    matched = true;
                    break;
                }

                if (!matched) return;

                // Evita el doble TTS si el mensaje de chat del canje ya lo disparó
                if (!TryMarkRedemption(channelName, rewardId, userId)) return;

                _logger.LogInformation("[SpeakChat] Canje activó TTS en {Channel}: {User} → '{Text}'", channelName, username, userInput);
                await SpeakAsync(cfg, channelName, username, userId, userInput);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error procesando canje en {Channel}", channelName);
            }
        }

        /// <summary>
        /// Filtros + generación de voz + envío al overlay. Compartido por el flujo de
        /// chat y el de canjes de puntos.
        /// </summary>
        private async Task SpeakAsync(JsonElement cfg, string channelName, string username, string userId, string textToSpeak)
        {
            try
            {
                // ===== FILTROS =====
                cfg.TryGetProperty("filters", out var filters);

                // Cooldown global
                var globalCooldownSecs = filters.ValueKind != JsonValueKind.Undefined &&
                    filters.TryGetProperty("globalCooldownSeconds", out var gcs) ? gcs.GetInt32() : 0;
                if (globalCooldownSecs > 0)
                {
                    var key = channelName;
                    if (_globalCooldowns.TryGetValue(key, out var lastGlobal) &&
                        (DateTime.UtcNow - lastGlobal).TotalSeconds < globalCooldownSecs)
                    {
                        _logger.LogInformation(
                            "[SpeakChat] {Channel}: descartado por enfriamiento global ({Secs}s)",
                            channelName, globalCooldownSecs);
                        return;
                    }
                    _globalCooldowns[key] = DateTime.UtcNow;
                }

                // Cooldown por usuario
                var perUserCooldownSecs = filters.ValueKind != JsonValueKind.Undefined &&
                    filters.TryGetProperty("perUserCooldownSeconds", out var pucs) ? pucs.GetInt32() : 0;
                if (perUserCooldownSecs > 0)
                {
                    var key = $"{channelName}:{userId}";
                    if (_perUserCooldowns.TryGetValue(key, out var lastUser) &&
                        (DateTime.UtcNow - lastUser).TotalSeconds < perUserCooldownSecs)
                    {
                        _logger.LogInformation(
                            "[SpeakChat] {Channel}: {User} en enfriamiento ({Secs}s entre mensajes)",
                            channelName, username, perUserCooldownSecs);
                        return;
                    }
                    _perUserCooldowns[key] = DateTime.UtcNow;
                }

                // Max chars
                var maxChars = filters.ValueKind != JsonValueKind.Undefined &&
                    filters.TryGetProperty("maxChars", out var mc) ? mc.GetInt32() : 200;
                if (textToSpeak.Length > maxChars)
                    textToSpeak = textToSpeak.Substring(0, maxChars);

                // Palabras bloqueadas
                if (filters.ValueKind != JsonValueKind.Undefined &&
                    filters.TryGetProperty("blockedWords", out var bw) && bw.ValueKind == JsonValueKind.Array)
                {
                    foreach (var word in bw.EnumerateArray())
                    {
                        var w = word.GetString();
                        if (!string.IsNullOrEmpty(w) &&
                            textToSpeak.Contains(w, StringComparison.OrdinalIgnoreCase))
                        {
                            _logger.LogInformation(
                                "[SpeakChat] {Channel}: mensaje de {User} descartado por palabra bloqueada",
                                channelName, username);
                            return;
                        }
                    }
                }

                // Usuarios bloqueados
                if (filters.ValueKind != JsonValueKind.Undefined &&
                    filters.TryGetProperty("blockedUsers", out var bu) && bu.ValueKind == JsonValueKind.Array)
                {
                    foreach (var blockedUser in bu.EnumerateArray())
                    {
                        var u = blockedUser.GetString();
                        if (!string.IsNullOrEmpty(u) &&
                            u.Equals(username, StringComparison.OrdinalIgnoreCase))
                        {
                            _logger.LogInformation(
                                "[SpeakChat] {Channel}: {User} está en la lista de bloqueados",
                                channelName, username);
                            return;
                        }
                    }
                }

                if (string.IsNullOrWhiteSpace(textToSpeak)) return;

                // ===== VOZ Y TTS =====
                cfg.TryGetProperty("voice", out var voice);

                // "piper" es la voz estándar del servidor y el valor por defecto; "polly"
                // gasta créditos premium. Las configuraciones viejas traen "browser", que
                // ya no existe: se leen como piper.
                var rawEngine = voice.ValueKind != JsonValueKind.Undefined &&
                    voice.TryGetProperty("engine", out var eng) ? eng.GetString() ?? "piper" : "piper";
                var engine = rawEngine == "polly" ? "polly" : "piper";

                // Cada catálogo de voces se guarda por separado para que cambiar de motor
                // no arruine la elección del otro. `voice` es el campo antiguo, que se
                // sigue leyendo como respaldo.
                var legacyVoice = voice.ValueKind != JsonValueKind.Undefined &&
                    voice.TryGetProperty("voice", out var vid) ? vid.GetString() : null;
                var pollyVoice = voice.ValueKind != JsonValueKind.Undefined &&
                    voice.TryGetProperty("pollyVoice", out var pv) ? pv.GetString() : null;
                var standardVoice = voice.ValueKind != JsonValueKind.Undefined &&
                    voice.TryGetProperty("standardVoice", out var sv) ? sv.GetString() : null;

                var voiceId = engine == "polly"
                    ? (!string.IsNullOrEmpty(pollyVoice) ? pollyVoice : legacyVoice ?? "Lupe")
                    : (standardVoice ?? "");
                var languageCode = voice.ValueKind != JsonValueKind.Undefined &&
                    voice.TryGetProperty("languageCode", out var lc) ? lc.GetString() ?? "es-US" : "es-US";
                var volume = voice.ValueKind != JsonValueKind.Undefined &&
                    voice.TryGetProperty("volume", out var vol) ? vol.GetInt32() : 80;

                string? audioUrl = null;

                _logger.LogInformation("[SpeakChat] Engine configurado: '{Engine}', voice: '{Voice}', lang: '{Lang}', text: '{Text}'", engine, voiceId, languageCode, textToSpeak);

                var channelUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.Login.ToLower() == channelName.ToLower());

                if (channelUser == null)
                {
                    _logger.LogWarning("[SpeakChat] channelUser no encontrado para canal '{Channel}', sin voz", channelName);
                }
                else
                {
                    // Motor de Polly: standard por defecto, neural cuando se configure (fase 2).
                    // Piper lo ignora, ahí solo hay una calidad por voz.
                    var pollyEngine = voice.ValueKind != JsonValueKind.Undefined &&
                        voice.TryGetProperty("pollyEngine", out var pe) ? pe.GetString() ?? "standard" : "standard";

                    audioUrl = await _creditService.GenerateWithCreditsAsync(
                        channelUser.Id, textToSpeak, voiceId, pollyEngine,
                        languageCode, "speak_chat", channelName, engine);
                }

                // Sin audio el overlay solo enseña la burbuja: ya no hay a qué caer
                var ttsEngine = audioUrl != null ? engine : "none";

                // Leer config overlay
                cfg.TryGetProperty("overlay", out var overlayConfig);

                await _overlayNotificationService.SendToChannel(channelName, "SpeakChatMessage", new
                {
                    username,
                    message = textToSpeak,
                    audioUrl,
                    volume,
                    ttsEngine,
                    voice = voiceId,
                    languageCode,
                    overlay = overlayConfig.ValueKind != JsonValueKind.Undefined
                        ? JsonSerializer.Deserialize<object>(overlayConfig.GetRawText())
                        : new { showBubble = true, position = "bottom-left", fontSize = 16, duration = 5000 },
                    timestamp = DateTime.UtcNow
                });

                // Hasta aquí todo puede haber salido bien —permisos, cobro, síntesis— y
                // aun así no oírse nada, porque el overlay no está puesto en OBS. Sin
                // esta línea no había forma de distinguir "no se generó" de "no había
                // nadie escuchando", y las dos se ven igual desde el chat.
                var listeners = Hubs.OverlayHub.CountOverlays(channelName, "speak_chat");
                if (listeners == 0)
                {
                    _logger.LogWarning(
                        "[SpeakChat] Audio generado para {Channel} pero NO hay overlay de Speak Chat conectado — no se va a oír. Overlays presentes: {Detalle}",
                        channelName, Hubs.OverlayHub.DescribeOverlays(channelName));
                }
                else
                {
                    _logger.LogInformation(
                        "[SpeakChat] Enviado a {Channel} ({Listeners} overlay(s) escuchando)",
                        channelName, listeners);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SpeakChat] Error generando TTS en {Channel}", channelName);
            }
        }

        /// <summary>
        /// Marca un canje como procesado. Devuelve false si ese mismo canje ya se
        /// procesó dentro de la ventana de deduplicación.
        /// </summary>
        private static bool TryMarkRedemption(string channelName, string rewardId, string userId)
        {
            var now = DateTime.UtcNow;

            // Limpieza perezosa de entradas viejas
            foreach (var kv in _recentRedemptions)
            {
                if (now - kv.Value > _redemptionDedupeWindow)
                    _recentRedemptions.TryRemove(kv.Key, out _);
            }

            var key = $"{channelName.ToLower()}:{rewardId}:{userId}";
            if (_recentRedemptions.TryGetValue(key, out var last) && now - last < _redemptionDedupeWindow)
                return false;

            _recentRedemptions[key] = now;
            return true;
        }

        /// <summary>
        /// Si el mensaje empieza por el comando **completo**: o es exactamente el comando,
        /// o va seguido de un espacio.
        ///
        /// Antes bastaba con que el mensaje empezara por esas letras, y con un comando
        /// corto como "!s" eso atrapaba media conversación: "!spotify", "!sorteo" y
        /// "!salud a todos" disparaban el TTS. Y encima se comía la primera letra, porque
        /// el texto se recorta por la longitud del comando: "!salud a todos" se leía como
        /// "alud a todos". Cada uno de esos falsos positivos se cobraba en créditos.
        /// </summary>
        private static bool MatchesCommand(string message, string cmdName)
        {
            if (string.IsNullOrWhiteSpace(message)) return false;
            if (!message.StartsWith(cmdName, StringComparison.OrdinalIgnoreCase)) return false;

            // Exactamente el comando, sin texto detrás.
            if (message.Length == cmdName.Length) return true;

            // Con texto detrás, tiene que haber un separador: "!s hola" sí, "!shola" no.
            return char.IsWhiteSpace(message[cmdName.Length]);
        }

        private static bool IsRoleAllowed(JsonElement rule, bool isBroadcaster, bool isModerator, bool isVip, bool isSubscriber)
        {
            if (!rule.TryGetProperty("roles", out var roles)) return true; // sin restricción = todos

            bool Check(string key, bool value) =>
                roles.TryGetProperty(key, out var prop) && prop.GetBoolean() && value;

            if (roles.TryGetProperty("everyone", out var ev) && ev.GetBoolean()) return true;
            if (Check("broadcaster", isBroadcaster)) return true;
            if (Check("moderator", isModerator)) return true;
            if (Check("vip", isVip)) return true;
            if (Check("subscriber", isSubscriber)) return true;

            return false;
        }

    }
}
