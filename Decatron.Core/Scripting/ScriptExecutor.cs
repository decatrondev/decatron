using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Decatron.Scripting.Models;
using Decatron.Scripting.Functions;
using Decatron.Scripting.Exceptions;

namespace Decatron.Scripting.Core
{
    public class ScriptExecutor
    {
        public async Task<ScriptExecutionResult> ExecuteAsync(ScriptProgram program, ScriptExecutionContext context)
        {
            var result = new ScriptExecutionResult
            {
                Success = true,
                Context = context
            };

            try
            {
                // CAMBIO PRINCIPAL: usar el nuevo método de secuencia
                await ExecuteStatementSequence(program.Statements, context, result);
            }
            catch (ScriptExecutionException ex)
            {
                result.Success = false;
                result.ErrorMessage = ex.Message;
                result.ErrorLine = ex.LineNumber;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.ErrorMessage = $"Error inesperado: {ex.Message}";
            }

            return result;
        }

        // NUEVO: Ejecutar secuencia de statements con lógica de cascada
        private async Task ExecuteStatementSequence(List<ScriptNode> statements, ScriptExecutionContext context, ScriptExecutionResult result)
        {
            for (int i = 0; i < statements.Count; i++)
            {
                var statement = statements[i];

                if (statement is WhenStatement whenStmt && HasComparisonOperator(whenStmt.Condition))
                {
                    // Buscar secuencia de when consecutivos con comparaciones
                    var whenSequence = ExtractWhenSequence(statements, i);

                    if (whenSequence.Count > 1)
                    {
                        // Ejecutar como cascada if-else-if
                        await ExecuteWhenCascade(whenSequence, context, result);
                        i += whenSequence.Count - 1; // Saltar los when procesados
                        continue;
                    }
                }

                // Ejecutar statement individual normalmente
                await ExecuteStatement(statement, context, result);
            }
        }

        // NUEVO: Detectar si una expresión tiene operadores de comparación
        private bool HasComparisonOperator(Expression expr)
        {
            if (expr is BinaryExpression binary)
            {
                var comparisonOps = new[] { ">=", "<=", ">", "<", "==", "!=" };
                return comparisonOps.Contains(binary.Operator);
            }
            return false;
        }

        // NUEVO: Extraer secuencia de when consecutivos con comparaciones
        private List<WhenStatement> ExtractWhenSequence(List<ScriptNode> statements, int startIndex)
        {
            var sequence = new List<WhenStatement>();

            for (int i = startIndex; i < statements.Count; i++)
            {
                if (statements[i] is WhenStatement whenStmt && HasComparisonOperator(whenStmt.Condition))
                {
                    sequence.Add(whenStmt);
                }
                else
                {
                    break; // Terminar secuencia en el primer no-when o when sin comparación
                }
            }

            return sequence;
        }

        // NUEVO: Ejecutar cascada de when como if-else-if
        private async Task ExecuteWhenCascade(List<WhenStatement> whenStatements, ScriptExecutionContext context, ScriptExecutionResult result)
        {
            foreach (var whenStmt in whenStatements)
            {
                var conditionResult = await EvaluateExpression(whenStmt.Condition, context);
                bool conditionIsTrue = ConvertToBoolean(conditionResult);


                if (conditionIsTrue)
                {
                    // Ejecutar solo este bloque then y salir
                    foreach (var stmt in whenStmt.ThenStatements)
                    {
                        await ExecuteStatement(stmt, context, result);
                    }
                    return; // CLAVE: salir después del primer match
                }
            }

        }

        // NUEVO: Método auxiliar para convertir a boolean
        private bool ConvertToBoolean(object conditionResult)
        {
            if (conditionResult is bool boolResult)
            {
                return boolResult;
            }
            else if (conditionResult is int intResult)
            {
                return intResult != 0;
            }
            else if (conditionResult is double doubleResult)
            {
                return Math.Abs(doubleResult) > 0.0001;
            }
            else if (conditionResult is string stringResult)
            {
                return !string.IsNullOrEmpty(stringResult);
            }
            return false;
        }

        private async Task ExecuteStatement(ScriptNode statement, ScriptExecutionContext context, ScriptExecutionResult result)
        {
            switch (statement)
            {
                case SetStatement setStmt:
                    await ExecuteSetStatement(setStmt, context);
                    break;

                case WhenStatement whenStmt:
                    await ExecuteWhenStatement(whenStmt, context, result);
                    break;

                case SendStatement sendStmt:
                    await ExecuteSendStatement(sendStmt, context, result);
                    break;

                default:
                    throw new ScriptExecutionException($"Tipo de declaración no soportado: {statement.GetType().Name}", statement.LineNumber);
            }
        }

        private async Task ExecuteSetStatement(SetStatement setStmt, ScriptExecutionContext context)
        {

            var value = await EvaluateExpression(setStmt.Value, context);

            var variableType = DetermineVariableType(value);

            context.SetVariable(setStmt.VariableName, value, variableType);
        }

        private async Task ExecuteWhenStatement(WhenStatement whenStmt, ScriptExecutionContext context, ScriptExecutionResult result)
        {
            var conditionResult = await EvaluateExpression(whenStmt.Condition, context);
            bool conditionIsTrue = ConvertToBoolean(conditionResult);

            // Ejecutar bloque correspondiente
            var statementsToExecute = conditionIsTrue ? whenStmt.ThenStatements : whenStmt.ElseStatements;

            foreach (var statement in statementsToExecute)
            {
                await ExecuteStatement(statement, context, result);
            }
        }

        private async Task ExecuteSendStatement(SendStatement sendStmt, ScriptExecutionContext context, ScriptExecutionResult result)
        {
            var message = await EvaluateExpression(sendStmt.Message, context);
            var messageString = message?.ToString() ?? "";

            // Procesar variables $(variable) en el mensaje
            messageString = ProcessVariableSubstitutions(messageString, context);

            result.OutputMessages.Add(messageString);
        }

        private async Task<object> EvaluateExpression(Expression expr, ScriptExecutionContext context)
        {
            switch (expr)
            {
                case LiteralExpression literal:
                    return literal.Value;

                case VariableExpression variable:
                    return context.GetVariable(variable.VariableName).Value;

                case FunctionCallExpression funcCall:
                    return await EvaluateFunctionCall(funcCall, context);

                case BinaryExpression binary:
                    return await EvaluateBinaryExpression(binary, context);

                default:
                    throw new ScriptExecutionException($"Tipo de expresión no soportado: {expr.GetType().Name}", expr.LineNumber);
            }
        }

        private async Task<object> EvaluateFunctionCall(FunctionCallExpression funcCall, ScriptExecutionContext context)
        {
            var arguments = new object[funcCall.Arguments.Count];

            for (int i = 0; i < funcCall.Arguments.Count; i++)
            {
                arguments[i] = await EvaluateExpression(funcCall.Arguments[i], context);
            }

            return BuiltinFunctions.CallFunction(funcCall.FunctionName, arguments, context);
        }

        private async Task<object> EvaluateBinaryExpression(BinaryExpression binary, ScriptExecutionContext context)
        {
            var left = await EvaluateExpression(binary.Left, context);
            var right = await EvaluateExpression(binary.Right, context);

            switch (binary.Operator)
            {
                case "==":
                    return AreEqual(left, right);
                case "!=":
                    return !AreEqual(left, right);
                case ">":
                    return CompareNumeric(left, right) > 0;
                case "<":
                    return CompareNumeric(left, right) < 0;
                case ">=":
                    return CompareNumeric(left, right) >= 0;
                case "<=":
                    return CompareNumeric(left, right) <= 0;
                case "+":
                    return AddValues(left, right);
                case "-":
                    return SubtractValues(left, right);
                default:
                    throw new ScriptExecutionException($"Operador no soportado: {binary.Operator}", binary.LineNumber);
            }
        }

        private bool AreEqual(object left, object right)
        {
            if (left == null && right == null) return true;
            if (left == null || right == null) return false;

            // Intentar comparación numérica si ambos son números
            if (IsNumeric(left) && IsNumeric(right))
            {
                return Math.Abs(Convert.ToDouble(left) - Convert.ToDouble(right)) < 0.0001;
            }

            // Comparación de strings
            return left.ToString().Equals(right.ToString(), StringComparison.OrdinalIgnoreCase);
        }

        private int CompareNumeric(object left, object right)
        {
            if (!IsNumeric(left) || !IsNumeric(right))
                throw new ScriptExecutionException("Los operadores de comparación requieren valores numéricos");

            var leftNum = Convert.ToDouble(left);
            var rightNum = Convert.ToDouble(right);

            return leftNum.CompareTo(rightNum);
        }

        private object AddValues(object left, object right)
        {
            // Si ambos son números, suma numérica
            if (IsNumeric(left) && IsNumeric(right))
            {
                if (IsInteger(left) && IsInteger(right))
                {
                    return Convert.ToInt32(left) + Convert.ToInt32(right);
                }
                else
                {
                    return Convert.ToDouble(left) + Convert.ToDouble(right);
                }
            }

            // Si uno es string, concatenación
            return left.ToString() + right.ToString();
        }

        private object SubtractValues(object left, object right)
        {
            if (!IsNumeric(left) || !IsNumeric(right))
                throw new ScriptExecutionException("La resta requiere valores numéricos");

            if (IsInteger(left) && IsInteger(right))
            {
                return Convert.ToInt32(left) - Convert.ToInt32(right);
            }
            else
            {
                return Convert.ToDouble(left) - Convert.ToDouble(right);
            }
        }

        private bool IsNumeric(object value)
        {
            return value is int || value is double || value is float ||
                   int.TryParse(value.ToString(), out _) ||
                   double.TryParse(value.ToString(), out _);
        }

        private bool IsInteger(object value)
        {
            return value is int || int.TryParse(value.ToString(), out _);
        }

        private ScriptVariable.VariableType DetermineVariableType(object value)
        {
            switch (value)
            {
                case int _:
                    return ScriptVariable.VariableType.Integer;
                case double _:
                case float _:
                    return ScriptVariable.VariableType.Double;
                case bool _:
                    return ScriptVariable.VariableType.Boolean;
                case string[] _:
                    return ScriptVariable.VariableType.StringArray;
                default:
                    return ScriptVariable.VariableType.String;
            }
        }

        private string ProcessVariableSubstitutions(string message, ScriptExecutionContext context)
        {
            // Reemplazar $(variable) por valor real
            var result = message;

            foreach (var kvp in context.Variables)
            {
                var placeholder = $"$({kvp.Key})";
                if (result.Contains(placeholder))
                {
                    result = result.Replace(placeholder, kvp.Value.Value?.ToString() ?? "");
                }
            }

            foreach (var kvp in context.BuiltinVariables)
            {
                var placeholder = $"$({kvp.Key})";
                if (result.Contains(placeholder))
                {
                    result = result.Replace(placeholder, kvp.Value ?? "");
                }
            }

            return result;
        }
    }

    // Scripting/Models/ScriptExecutionResult.cs
    public class ScriptExecutionResult
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; }
        public int ErrorLine { get; set; }
        public List<string> OutputMessages { get; set; } = new List<string>();
        public ScriptExecutionContext Context { get; set; }
    }
}