using System;
using System.Linq;
using Decatron.Scripting.Exceptions;
using Decatron.Scripting.Models;

namespace Decatron.Scripting.Functions
{
    public static class BuiltinFunctions
    {
        private static Random _random => Random.Shared;

        public static object CallFunction(string functionName, object[] arguments, ScriptExecutionContext context)
        {
            switch (functionName.ToLower())
            {
                case "roll":
                    return Roll(arguments);
                case "pick":
                    return Pick(arguments);
                case "count":
                    return Count(arguments, context);
                default:
                    throw new ScriptExecutionException($"Función desconocida: {functionName}");
            }
        }

        private static int Roll(object[] args)
        {
            if (args.Length != 2)
                throw new ScriptExecutionException("roll() requiere exactamente 2 argumentos: roll(min, max)");

            if (!int.TryParse(args[0].ToString(), out int min))
                throw new ScriptExecutionException($"Primer argumento de roll() debe ser un número entero: {args[0]}");

            if (!int.TryParse(args[1].ToString(), out int max))
                throw new ScriptExecutionException($"Segundo argumento de roll() debe ser un número entero: {args[1]}");

            if (min >= max)
                throw new ScriptExecutionException($"En roll({min}, {max}): min debe ser menor que max");

            return _random.Next(min, max + 1); // +1 porque Next es exclusive en el upper bound
        }

        private static string Pick(object[] args)
        {
            if (args.Length != 1)
                throw new ScriptExecutionException("pick() requiere exactamente 1 argumento: pick(\"opcion1, opcion2, opcion3\")");

            var optionsString = args[0].ToString();
            if (string.IsNullOrWhiteSpace(optionsString))
                throw new ScriptExecutionException("pick() requiere una lista de opciones separadas por comas");

            var options = optionsString.Split(',')
                .Select(o => o.Trim())
                .Where(o => !string.IsNullOrEmpty(o))
                .ToArray();

            if (options.Length == 0)
                throw new ScriptExecutionException("pick() no encontró opciones válidas en la lista");

            var randomIndex = _random.Next(options.Length);
            return options[randomIndex];
        }

        private static int Count(object[] args, ScriptExecutionContext context)
        {
            // count() sin argumentos = contador del comando actual
            if (args.Length == 0)
            {
                return IncrementCommandCounter(context.ChannelName, context.CommandName);
            }

            // count("nombre_contador") = contador personalizado
            if (args.Length == 1)
            {
                var counterName = args[0].ToString();
                return IncrementCommandCounter(context.ChannelName, counterName);
            }

            throw new ScriptExecutionException("count() acepta 0 o 1 argumentos: count() o count(\"nombre\")");
        }

        private static int IncrementCommandCounter(string channelName, string counterName)
        {
            // TODO: Implementar persistencia en BD
            // Por ahora usamos un diccionario estático simple
            var key = $"{channelName}:{counterName}";

            if (!_counters.ContainsKey(key))
                _counters[key] = 0;

            _counters[key]++;
            return _counters[key];
        }

        // Diccionario temporal para contadores - en producción esto iría a BD
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, int> _counters
            = new System.Collections.Concurrent.ConcurrentDictionary<string, int>();
    }
}