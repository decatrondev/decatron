namespace Decatron.Scripting.Models
{
    public class ScriptVariable
    {
        public string Name { get; set; }
        public object Value { get; set; }
        public VariableType Type { get; set; }

        public enum VariableType
        {
            String,
            Integer,
            Double,
            Boolean,
            StringArray
        }

        public T GetValue<T>()
        {
            if (Value is T directValue)
                return directValue;

            // Conversiones automáticas simples
            if (typeof(T) == typeof(string))
                return (T)(object)Value.ToString();

            if (typeof(T) == typeof(int) && int.TryParse(Value.ToString(), out int intResult))
                return (T)(object)intResult;

            if (typeof(T) == typeof(double) && double.TryParse(Value.ToString(), out double doubleResult))
                return (T)(object)doubleResult;

            throw new InvalidCastException($"Cannot convert {Value} to {typeof(T)}");
        }
    }
}