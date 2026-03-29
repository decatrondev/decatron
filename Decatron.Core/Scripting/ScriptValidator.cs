using System.Collections.Generic;
using System.Linq;
using Decatron.Scripting.Exceptions;

namespace Decatron.Scripting.Core
{
    public class ScriptValidator
    {
        private readonly HashSet<string> _allowedKeywords = new HashSet<string>
        {
            "set", "when", "then", "else", "end", "send"
        };
        
        private readonly HashSet<string> _allowedFunctions = new HashSet<string>
        {
            "roll", "pick", "count"
        };
        
        private readonly HashSet<string> _allowedOperators = new HashSet<string>
        {
            "==", "!=", ">", "<", ">=", "<=", "+", "-"
        };
        
        private readonly HashSet<string> _allowedVariables = new HashSet<string>
        {
            "user", "channel", "game", "uptime", "ruser", "touser"
        };

        public void ValidateScript(string script)
        {

            if (string.IsNullOrWhiteSpace(script))
                throw new ScriptParseException("El script no puede estar vacío", 0, "");

            var lines = script.Split('\n');

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i].Trim();

                if (string.IsNullOrEmpty(line)) continue;

                ValidateLine(line, i + 1);
            }

        }

        private void ValidateLine(string line, int lineNumber)
        {
            var words = SplitLineIntoTokens(line);
            
            if (words.Length == 0) return;

            var firstWord = words[0].ToLower();

            // Validar palabra clave inicial
            if (!_allowedKeywords.Contains(firstWord))
            {
                throw new ScriptParseException($"Palabra clave no permitida: '{firstWord}'", lineNumber, line);
            }

            // Validaciones específicas por tipo de línea
            switch (firstWord)
            {
                case "set":
                    ValidateSetStatement(words, lineNumber, line);
                    break;
                case "when":
                    ValidateWhenStatement(words, lineNumber, line);
                    break;
                case "send":
                    ValidateSendStatement(words, lineNumber, line);
                    break;
                case "then":
                case "else":
                case "end":
                    // Estas palabras clave son válidas solas
                    break;
            }
        }

        private void ValidateSetStatement(string[] words, int lineNumber, string line)
        {
            if (words.Length < 4 || words[2] != "=")
            {
                throw new ScriptParseException("Sintaxis incorrecta. Uso: set variable = valor", lineNumber, line);
            }

            var variableName = words[1];
            if (!IsValidVariableName(variableName))
            {
                throw new ScriptParseException($"Nombre de variable inválido: '{variableName}'", lineNumber, line);
            }
        }

        private void ValidateWhenStatement(string[] words, int lineNumber, string line)
        {
            if (words.Length < 4 || !words.Contains("then"))
            {
                throw new ScriptParseException("Sintaxis incorrecta. Uso: when condicion then", lineNumber, line);
            }

            // Validar que contenga operadores válidos
            bool hasValidOperator = _allowedOperators.Any(op => line.Contains(op));
            if (!hasValidOperator)
            {
                throw new ScriptParseException("Condición debe contener un operador válido (==, >, <, etc.)", lineNumber, line);
            }
        }

        private void ValidateSendStatement(string[] words, int lineNumber, string line)
        {
            if (words.Length < 2)
            {
                throw new ScriptParseException("Sintaxis incorrecta. Uso: send \"mensaje\"", lineNumber, line);
            }
        }

        private bool IsValidVariableName(string name)
        {
            if (string.IsNullOrEmpty(name)) return false;
            if (!char.IsLetter(name[0])) return false;
            
            return name.All(c => char.IsLetterOrDigit(c) || c == '_');
        }

        private string[] SplitLineIntoTokens(string line)
        {
            // Tokenizer simple que respeta strings entre comillas
            var tokens = new List<string>();
            var currentToken = "";
            bool inQuotes = false;
            
            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                
                if (c == '"')
                {
                    inQuotes = !inQuotes;
                    currentToken += c;
                }
                else if (char.IsWhiteSpace(c) && !inQuotes)
                {
                    if (!string.IsNullOrEmpty(currentToken))
                    {
                        tokens.Add(currentToken);
                        currentToken = "";
                    }
                }
                else
                {
                    currentToken += c;
                }
            }
            
            if (!string.IsNullOrEmpty(currentToken))
                tokens.Add(currentToken);
                
            return tokens.ToArray();
        }
    }
}