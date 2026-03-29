using System;

namespace Decatron.Scripting.Exceptions
{
    public class ScriptParseException : Exception
    {
        public int LineNumber { get; }
        public string ScriptLine { get; }

        public ScriptParseException(string message, int lineNumber, string scriptLine)
            : base($"Error en línea {lineNumber}: {message}")
        {
            LineNumber = lineNumber;
            ScriptLine = scriptLine;
        }

        public ScriptParseException(string message, int lineNumber, string scriptLine, Exception innerException)
            : base($"Error en línea {lineNumber}: {message}", innerException)
        {
            LineNumber = lineNumber;
            ScriptLine = scriptLine;
        }
    }
}