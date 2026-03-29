using System.Collections.Generic;
using Decatron.Scripting.Exceptions;

namespace Decatron.Scripting.Models
{
    public class ScriptExecutionContext
    {
        public string ChannelName { get; set; }
        public string CommandName { get; set; }
        public string ExecutingUser { get; set; }
        public Dictionary<string, ScriptVariable> Variables { get; set; } = new Dictionary<string, ScriptVariable>();
        public Dictionary<string, string> BuiltinVariables { get; set; } = new Dictionary<string, string>();

        // Variables builtin del sistema
        public string User => BuiltinVariables.GetValueOrDefault("user", "");
        public string Channel => BuiltinVariables.GetValueOrDefault("channel", "");
        public string Game => BuiltinVariables.GetValueOrDefault("game", "");
        public string Uptime => BuiltinVariables.GetValueOrDefault("uptime", "");
        public string RandomUser => BuiltinVariables.GetValueOrDefault("ruser", "");
        public string ToUser => BuiltinVariables.GetValueOrDefault("touser", "");

        public void SetVariable(string name, object value, ScriptVariable.VariableType type = ScriptVariable.VariableType.String)
        {
            Variables[name] = new ScriptVariable
            {
                Name = name,
                Value = value,
                Type = type
            };
        }

        public ScriptVariable GetVariable(string name)
        {
            // Primero buscar en variables de script
            if (Variables.ContainsKey(name))
                return Variables[name];

            // Luego buscar en variables builtin
            if (BuiltinVariables.ContainsKey(name))
            {
                return new ScriptVariable
                {
                    Name = name,
                    Value = BuiltinVariables[name],
                    Type = ScriptVariable.VariableType.String
                };
            }

            throw new ScriptExecutionException($"Variable no encontrada: {name}");
        }

        public bool HasVariable(string name)
        {
            return Variables.ContainsKey(name) || BuiltinVariables.ContainsKey(name);
        }
    }
}