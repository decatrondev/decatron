using System;
using System.Collections.Generic;
using System.Linq;
using Decatron.Scripting.Models;
using Decatron.Scripting.Exceptions;

namespace Decatron.Scripting.Core
{
    public class ScriptParser
    {
        private readonly ScriptValidator _validator;

        public ScriptParser()
        {
            _validator = new ScriptValidator();
        }

        public ScriptProgram Parse(string script)
        {
            _validator.ValidateScript(script);
            var program = new ScriptProgram();
            var lines = script.Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToArray();

            int i = 0;
            while (i < lines.Length)
            {
                var line = lines[i];
                var tokens = TokenizeLine(line);

                if (tokens.Length == 0)
                {
                    i++;
                    continue;
                }

                var keyword = tokens[0].ToLower();

                switch (keyword)
                {
                    case "set":
                        var setStmt = ParseSetStatement(tokens, i + 1);
                        program.Statements.Add(setStmt);

                        // Verificar si hay más sets en la misma línea
                        var remainingTokens = tokens.Skip(4); // Saltar "set var = val"
                        while (remainingTokens.Count() >= 4 && remainingTokens.First().ToLower() == "set")
                        {
                            var nextSetTokens = remainingTokens.ToArray();
                            var nextSetStmt = ParseSetStatement(nextSetTokens, i + 1);
                            program.Statements.Add(nextSetStmt);
                            remainingTokens = remainingTokens.Skip(4);
                        }

                        i++;
                        break;

                    case "when":
                        var whenStmt = ParseIndependentWhenStatement(lines, ref i);
                        program.Statements.Add(whenStmt);
                        // i ya fue actualizado por ParseIndependentWhenStatement
                        break;

                    case "send":
                        program.Statements.Add(ParseSendStatement(tokens, i + 1));
                        i++;
                        break;

                    default:
                        throw new ScriptParseException($"Declaración no reconocida: {keyword}", i + 1, line);
                }
            }

            return program;
        }

        private WhenStatement ParseIndependentWhenStatement(string[] lines, ref int index)
        {
            // Este método parsea when...end como bloque completo independiente
            var whenStmt = ParseWhenStatement(lines, ref index);

            // Asegurar que encontramos el end correspondiente
            while (index < lines.Length)
            {
                var line = lines[index].Trim();
                if (string.IsNullOrEmpty(line))
                {
                    index++;
                    continue;
                }

                var tokens = TokenizeLine(line);
                if (tokens.Length > 0 && tokens[0].ToLower() == "end")
                {
                    index++; // Saltar el end
                    break;
                }
                index++;
            }

            return whenStmt;
        }

        private ScriptNode ParseStatement(string[] lines, ref int index)
        {
            if (index >= lines.Length) return null;

            var line = lines[index];
            var tokens = TokenizeLine(line);

            if (tokens.Length == 0) return null;

            var keyword = tokens[0].ToLower();

            switch (keyword)
            {
                case "set":
                    return ParseSetStatement(tokens, index + 1);
                case "when":
                    return ParseWhenStatement(lines, ref index);
                case "send":
                    return ParseSendStatement(tokens, index + 1);
                default:
                    throw new ScriptParseException($"Declaración no reconocida: {keyword}", index + 1, line);
            }
        }

        private SetStatement ParseSetStatement(string[] tokens, int lineNumber)
        {
            if (tokens.Length < 4 || tokens[2] != "=")
                throw new ScriptParseException("Sintaxis incorrecta para set", lineNumber, string.Join(" ", tokens));

            var variableName = tokens[1];

            // Encontrar donde termina este set (próximo "set" o fin de tokens)
            int expressionEnd = tokens.Length;
            for (int i = 3; i < tokens.Length; i++)
            {
                if (tokens[i].ToLower() == "set")
                {
                    expressionEnd = i;
                    break;
                }
            }

            var expressionTokens = tokens.Skip(3).Take(expressionEnd - 3).ToArray();
            var expression = ParseExpression(expressionTokens, lineNumber);

            return new SetStatement
            {
                LineNumber = lineNumber,
                VariableName = variableName,
                Value = expression
            };
        }

        private WhenStatement ParseWhenStatement(string[] lines, ref int index)
        {
            var line = lines[index];
            var tokens = TokenizeLine(line);
            var lineNumber = index + 1;

            // Encontrar "then"
            var thenIndex = Array.IndexOf(tokens, "then");
            if (thenIndex == -1)
                throw new ScriptParseException("Falta 'then' en declaración when", lineNumber, line);

            // Parsear condición
            var conditionTokens = tokens.Skip(1).Take(thenIndex - 1).ToArray();
            var condition = ParseExpression(conditionTokens, lineNumber);

            var whenStatement = new WhenStatement
            {
                LineNumber = lineNumber,
                Condition = condition
            };

            // Parsear bloques then/else/end
            index++;
            bool inElseBlock = false;
            int nestedLevel = 0; // Para rastrear when anidados

            while (index < lines.Length)
            {
                var currentLine = lines[index].Trim();
                if (string.IsNullOrEmpty(currentLine))
                {
                    index++;
                    continue;
                }

                var currentTokens = TokenizeLine(currentLine);
                var keyword = currentTokens[0].ToLower();

                if (keyword == "when" && inElseBlock)
                {
                    // When anidado en bloque else
                    var nestedWhen = ParseWhenStatement(lines, ref index);
                    whenStatement.ElseStatements.Add(nestedWhen);
                    continue; // ParseWhenStatement ya actualizó el index
                }

                if (keyword == "else" && nestedLevel == 0)
                {
                    inElseBlock = true;
                    index++;
                    continue;
                }

                if (keyword == "end")
                {
                    if (nestedLevel > 0)
                    {
                        nestedLevel--;
                        // Si hay when anidados, este end pertenece a ellos
                    }
                    else
                    {
                        // Este es nuestro end
                        return whenStatement;
                    }
                }

                if (keyword == "when")
                {
                    nestedLevel++;
                }

                // Parsear statement normal
                string[] singleLine = new string[] { currentLine };
                int singleLineIndex = 0;

                var statement = ParseStatement(singleLine, ref singleLineIndex);

                if (statement != null)
                {
                    if (inElseBlock)
                    {
                        whenStatement.ElseStatements.Add(statement);
                    }
                    else
                    {
                        whenStatement.ThenStatements.Add(statement);
                    }
                }

                index++;
            }

            throw new ScriptParseException("Falta 'end' para cerrar bloque when", lineNumber, line);
        }

        private SendStatement ParseSendStatement(string[] tokens, int lineNumber)
        {
            if (tokens.Length < 2)
                throw new ScriptParseException("Sintaxis incorrecta para send", lineNumber, string.Join(" ", tokens));

            var messageTokens = tokens.Skip(1).ToArray();

            var expression = ParseExpression(messageTokens, lineNumber);

            return new SendStatement
            {
                LineNumber = lineNumber,
                Message = expression
            };
        }

        private Expression ParseExpression(string[] tokens, int lineNumber)
        {
            if (tokens.Length == 0)
                throw new ScriptParseException("Expresión vacía", lineNumber, "");

            if (tokens.Length == 1)
            {
                return ParseSingleToken(tokens[0], lineNumber);
            }

            // Buscar operadores binarios (simplificado)
            var operators = new[] { "==", "!=", ">=", "<=", ">", "<", "+", "-" };

            foreach (var op in operators)
            {
                for (int i = 0; i < tokens.Length; i++)
                {
                    if (tokens[i] == op && i > 0 && i < tokens.Length - 1)
                    {
                        var left = ParseExpression(tokens.Take(i).ToArray(), lineNumber);
                        var right = ParseExpression(tokens.Skip(i + 1).ToArray(), lineNumber);

                        return new BinaryExpression
                        {
                            LineNumber = lineNumber,
                            Left = left,
                            Operator = op,
                            Right = right
                        };
                    }
                }
            }

            // Si no encontramos operador, puede ser una función
            return ParseSingleToken(string.Join(" ", tokens), lineNumber);
        }

        private Expression ParseSingleToken(string token, int lineNumber)
        {
            // Variable con $()
            if (token.StartsWith("$(") && token.EndsWith(")"))
            {
                var varName = token.Substring(2, token.Length - 3);
                return new VariableExpression
                {
                    LineNumber = lineNumber,
                    VariableName = varName
                };
            }

            // Función call()
            if (token.Contains("(") && token.EndsWith(")"))
            {
                var parenIndex = token.IndexOf('(');
                var funcName = token.Substring(0, parenIndex);
                var argsString = token.Substring(parenIndex + 1, token.Length - parenIndex - 2);

                var args = new List<Expression>();
                if (!string.IsNullOrEmpty(argsString))
                {
                    var argTokens = argsString.Split(',').Select(s => s.Trim()).ToArray();
                    foreach (var arg in argTokens)
                    {
                        //args.Add(ParseSingleToken(arg, lineNumber));
                        args.Add(ParseExpression(TokenizeLine(arg), lineNumber));

                    }
                }

                return new FunctionCallExpression
                {
                    LineNumber = lineNumber,
                    FunctionName = funcName,
                    Arguments = args
                };
            }

            // String literal
            // String literal
            if (token.StartsWith("\"") && token.EndsWith("\""))
            {
                var content = token.Substring(1, token.Length - 2);

                return new LiteralExpression
                {
                    LineNumber = lineNumber,
                    Value = content,
                    Type = ScriptVariable.VariableType.String
                };
            }

            // Número
            if (int.TryParse(token, out int intValue))
            {
                return new LiteralExpression
                {
                    LineNumber = lineNumber,
                    Value = intValue,
                    Type = ScriptVariable.VariableType.Integer
                };
            }

            if (double.TryParse(token, out double doubleValue))
            {
                return new LiteralExpression
                {
                    LineNumber = lineNumber,
                    Value = doubleValue,
                    Type = ScriptVariable.VariableType.Double
                };
            }

            // Variable simple
            return new VariableExpression
            {
                LineNumber = lineNumber,
                VariableName = token
            };
        }

        private string[] TokenizeLine(string line)
        {

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