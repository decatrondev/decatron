using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Functions;
using Microsoft.Extensions.Logging;

namespace Decatron.Core.Resolvers
{
    /// <summary>
    /// Resuelve todas las variables del sistema en un texto
    /// Variables soportadas:
    /// - $(user), $(touser), $(ruser)
    /// - $(channel), $(game), $(title), $(uptime), $(viewers)
    /// - $(count), $(uses)
    /// - $(roll), $(roll:1-6), $(time), $(date), $(flip), $(8ball), $(choice:A,B,C), $(percent)
    /// - $(followage), $(followage:username), $(accountage), $(accountage:username)
    /// </summary>
    public class VariableResolver
    {
        private readonly CounterFunction _counterFunction;
        private readonly UsesFunction _usesFunction;
        private readonly GameFunction _gameFunction;
        private readonly UptimeFunction _uptimeFunction;
        private readonly UserFunction _userFunction;
        private readonly UtilityVariables _utilityVariables;
        private readonly TwitchInfoVariables _twitchInfoVariables;
        private readonly ILogger<VariableResolver> _logger;

        public VariableResolver(
            CounterFunction counterFunction,
            UsesFunction usesFunction,
            GameFunction gameFunction,
            UptimeFunction uptimeFunction,
            UserFunction userFunction,
            UtilityVariables utilityVariables,
            TwitchInfoVariables twitchInfoVariables,
            ILogger<VariableResolver> logger)
        {
            _counterFunction = counterFunction;
            _usesFunction = usesFunction;
            _gameFunction = gameFunction;
            _uptimeFunction = uptimeFunction;
            _userFunction = userFunction;
            _utilityVariables = utilityVariables;
            _twitchInfoVariables = twitchInfoVariables;
            _logger = logger;
        }

        /// <summary>
        /// Resuelve todas las variables del sistema en el texto
        /// </summary>
        public async Task<string> ResolveAsync(string text, VariableContext context)
        {
            if (string.IsNullOrEmpty(text))
                return text;

            try
            {
                var result = text;

                // Variables de Usuario
                result = ResolveUserVariables(result, context);

                // Variables de Canal (síncronas)
                result = ResolveChannelVariables(result, context);

                // Variables de Utilidad (síncronas)
                result = ResolveUtilityVariables(result);

                // Variables asíncronas
                result = await ResolveAsyncVariables(result, context);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolviendo variables");
                return text;
            }
        }

        private string ResolveUserVariables(string text, VariableContext context)
        {
            // $(user) - Usuario que ejecutó el comando
            text = text.Replace("$(user)", context.UserName ?? "desconocido");

            // $(touser) - Usuario mencionado (parseado de args)
            var toUser = context.ToUser ?? context.UserName ?? "desconocido";
            text = text.Replace("$(touser)", toUser);

            // $(ruser) se resuelve de forma asíncrona más adelante

            return text;
        }

        private string ResolveChannelVariables(string text, VariableContext context)
        {
            // $(channel) - Nombre del canal
            text = text.Replace("$(channel)", context.ChannelName ?? "desconocido");

            return text;
        }

        private string ResolveUtilityVariables(string text)
        {
            // $(roll) o $(roll:1-6)
            text = Regex.Replace(text, @"\$\(roll(?::(\d+-\d+))?\)", match =>
            {
                var range = match.Groups[1].Success ? match.Groups[1].Value : null;
                return _utilityVariables.Roll(range);
            });

            // $(time) o $(time:HH:mm:ss)
            text = Regex.Replace(text, @"\$\(time(?::([^)]+))?\)", match =>
            {
                var format = match.Groups[1].Success ? match.Groups[1].Value : null;
                return _utilityVariables.Time(format);
            });

            // $(date) o $(date:dd/MM/yyyy)
            text = Regex.Replace(text, @"\$\(date(?::([^)]+))?\)", match =>
            {
                var format = match.Groups[1].Success ? match.Groups[1].Value : null;
                return _utilityVariables.Date(format);
            });

            // $(flip)
            text = text.Replace("$(flip)", _utilityVariables.Flip());

            // $(8ball)
            text = text.Replace("$(8ball)", _utilityVariables.EightBall());

            // $(percent)
            text = text.Replace("$(percent)", _utilityVariables.Percent());

            // $(choice:A,B,C)
            text = Regex.Replace(text, @"\$\(choice:([^)]+)\)", match =>
            {
                var options = match.Groups[1].Value;
                return _utilityVariables.Choice(options);
            });

            return text;
        }

        private async Task<string> ResolveAsyncVariables(string text, VariableContext context)
        {
            // $(count) con operaciones opcionales
            if (text.Contains("$(count)"))
            {
                var countResult = await _counterFunction.Execute(
                    context.ChannelName,
                    context.CommandName,
                    context.UserName,
                    context.Args ?? Array.Empty<string>());
                text = text.Replace("$(count)", countResult);
            }

            // $(uses) - Contador simple
            if (text.Contains("$(uses)"))
            {
                var usesResult = await _usesFunction.Execute(context.ChannelName, context.CommandName);
                text = text.Replace("$(uses)", usesResult);
            }

            // $(game) - Juego actual
            if (text.Contains("$(game)"))
            {
                var gameResult = await _gameFunction.Execute(context.ChannelName);
                text = text.Replace("$(game)", gameResult);
            }

            // $(uptime) - Tiempo en vivo
            if (text.Contains("$(uptime)"))
            {
                var uptimeResult = await _uptimeFunction.Execute(context.ChannelName);
                text = text.Replace("$(uptime)", uptimeResult);
            }

            // $(ruser) - Usuario aleatorio del chat
            if (text.Contains("$(ruser)"))
            {
                var ruserResult = await _userFunction.GetRandomUser(context.ChannelName);
                text = text.Replace("$(ruser)", ruserResult);
            }

            // $(followage) o $(followage:username)
            text = await ResolveFollowageAsync(text, context);

            // $(accountage) o $(accountage:username)
            text = await ResolveAccountageAsync(text, context);

            return text;
        }

        private async Task<string> ResolveFollowageAsync(string text, VariableContext context)
        {
            // IMPORTANTE: Primero resolver los que tienen parámetros, después los que no
            // para evitar que $(followage) reemplace $(followage:username)

            // $(followage:username) - Con usuario específico
            var followagePattern = @"\$\(followage:([^)]+)\)";
            var matches = Regex.Matches(text, followagePattern);

            foreach (Match match in matches)
            {
                var targetUser = match.Groups[1].Value.Trim();
                _logger.LogDebug($"Resolviendo $(followage:{targetUser})");
                var result = await _twitchInfoVariables.GetFollowAge(context.ChannelName, targetUser);
                text = text.Replace(match.Value, result);
            }

            // $(followage) - Sin parámetro hardcoded
            // Lógica: Si hay argumento en el comando, usa ese. Si no, usa el ejecutor.
            var simpleFollowagePattern = @"\$\(followage\)";
            if (Regex.IsMatch(text, simpleFollowagePattern))
            {
                string targetUser;

                // Si hay argumentos, usar el primer argumento (limpiar @ si existe)
                if (context.Args != null && context.Args.Length > 0 && !string.IsNullOrWhiteSpace(context.Args[0]))
                {
                    targetUser = context.Args[0].Trim().TrimStart('@').ToLower();
                    _logger.LogDebug($"Resolviendo $(followage) con argumento: '{targetUser}'");
                }
                else
                {
                    // Si no hay argumentos, usar el ejecutor del comando
                    targetUser = context.UserName?.Trim().TrimStart('@').ToLower();
                    _logger.LogDebug($"Resolviendo $(followage) sin argumentos, usando ejecutor: '{targetUser}'");
                }

                if (!string.IsNullOrWhiteSpace(targetUser))
                {
                    var result = await _twitchInfoVariables.GetFollowAge(context.ChannelName, targetUser);
                    text = Regex.Replace(text, simpleFollowagePattern, result);
                }
                else
                {
                    _logger.LogWarning("$(followage) resuelto con targetUser vacío");
                    text = Regex.Replace(text, simpleFollowagePattern, "Usuario no especificado");
                }
            }

            return text;
        }

        private async Task<string> ResolveAccountageAsync(string text, VariableContext context)
        {
            // IMPORTANTE: Primero resolver los que tienen parámetros, después los que no

            // $(accountage:username) - Con usuario específico
            var accountagePattern = @"\$\(accountage:([^)]+)\)";
            var matches = Regex.Matches(text, accountagePattern);

            foreach (Match match in matches)
            {
                var targetUser = match.Groups[1].Value.Trim();
                _logger.LogDebug($"Resolviendo $(accountage:{targetUser})");
                var result = await _twitchInfoVariables.GetAccountAge(context.ChannelName, targetUser);
                text = text.Replace(match.Value, result);
            }

            // $(accountage) - Sin parámetro hardcoded
            // Lógica: Si hay argumento en el comando, usa ese. Si no, usa el ejecutor.
            var simpleAccountagePattern = @"\$\(accountage\)";
            if (Regex.IsMatch(text, simpleAccountagePattern))
            {
                string targetUser;

                // Si hay argumentos, usar el primer argumento (limpiar @ si existe)
                if (context.Args != null && context.Args.Length > 0 && !string.IsNullOrWhiteSpace(context.Args[0]))
                {
                    targetUser = context.Args[0].Trim().TrimStart('@').ToLower();
                    _logger.LogDebug($"Resolviendo $(accountage) con argumento: '{targetUser}'");
                }
                else
                {
                    // Si no hay argumentos, usar el ejecutor del comando
                    targetUser = context.UserName?.Trim().TrimStart('@').ToLower();
                    _logger.LogDebug($"Resolviendo $(accountage) sin argumentos, usando ejecutor: '{targetUser}'");
                }

                if (!string.IsNullOrWhiteSpace(targetUser))
                {
                    var result = await _twitchInfoVariables.GetAccountAge(context.ChannelName, targetUser);
                    text = Regex.Replace(text, simpleAccountagePattern, result);
                }
                else
                {
                    _logger.LogWarning("$(accountage) resuelto con targetUser vacío");
                    text = Regex.Replace(text, simpleAccountagePattern, "Usuario no especificado");
                }
            }

            return text;
        }
    }

    /// <summary>
    /// Contexto con información necesaria para resolver variables
    /// </summary>
    public class VariableContext
    {
        public string ChannelName { get; set; }
        public string CommandName { get; set; }
        public string UserName { get; set; }
        public string? ToUser { get; set; }
        public string[]? Args { get; set; }

        public VariableContext(string channelName, string commandName, string userName)
        {
            ChannelName = channelName;
            CommandName = commandName;
            UserName = userName;
        }
    }
}
