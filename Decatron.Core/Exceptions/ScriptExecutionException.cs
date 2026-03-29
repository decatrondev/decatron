using System;

namespace Decatron.Scripting.Exceptions
{
    public class ScriptExecutionException : Exception
    {
        public int LineNumber { get; }
        public string VariableName { get; }

        public ScriptExecutionException(string message) : base(message)
        {
        }

        public ScriptExecutionException(string message, int lineNumber)
            : base($"Error ejecutando línea {lineNumber}: {message}")
        {
            LineNumber = lineNumber;
        }

        public ScriptExecutionException(string message, string variableName)
            : base($"Error con variable '{variableName}': {message}")
        {
            VariableName = variableName;
        }

        public ScriptExecutionException(string message, Exception innerException)
            : base(message, innerException)
        {
        }
    }
}