using System.Collections.Generic;

namespace Decatron.Scripting.Models
{
    public abstract class ScriptNode
    {
        public int LineNumber { get; set; }
    }

    public class ScriptProgram : ScriptNode
    {
        public List<ScriptNode> Statements { get; set; } = new List<ScriptNode>();
    }

    public class SetStatement : ScriptNode
    {
        public string VariableName { get; set; }
        public Expression Value { get; set; }
    }

    public class WhenStatement : ScriptNode
    {
        public Expression Condition { get; set; }
        public List<ScriptNode> ThenStatements { get; set; } = new List<ScriptNode>();
        public List<ScriptNode> ElseStatements { get; set; } = new List<ScriptNode>();
    }

    public class SendStatement : ScriptNode
    {
        public Expression Message { get; set; }
    }

    public abstract class Expression : ScriptNode
    {
    }

    public class VariableExpression : Expression
    {
        public string VariableName { get; set; }
    }

    public class LiteralExpression : Expression
    {
        public object Value { get; set; }
        public ScriptVariable.VariableType Type { get; set; }
    }

    public class FunctionCallExpression : Expression
    {
        public string FunctionName { get; set; }
        public List<Expression> Arguments { get; set; } = new List<Expression>();
    }

    public class BinaryExpression : Expression
    {
        public Expression Left { get; set; }
        public string Operator { get; set; } // ==, >, <, >=, <=, +, -, etc.
        public Expression Right { get; set; }
    }
}