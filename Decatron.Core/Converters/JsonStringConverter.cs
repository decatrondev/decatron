using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Decatron.Core.Converters
{
    /// <summary>
    /// Converter para manejar objetos JSON que se almacenan como strings en la base de datos
    /// </summary>
    public class JsonStringConverter : JsonConverter<string>
    {
        public override string Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            // Si viene como string, devolverlo directamente
            if (reader.TokenType == JsonTokenType.String)
            {
                return reader.GetString() ?? "{}";
            }

            // Si viene como objeto JSON, serializarlo a string
            using var document = JsonDocument.ParseValue(ref reader);
            return document.RootElement.GetRawText();
        }

        public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options)
        {
            // Al escribir, parsear el string como JSON para que se envíe como objeto
            if (string.IsNullOrWhiteSpace(value))
            {
                writer.WriteStartObject();
                writer.WriteEndObject();
                return;
            }

            try
            {
                using var document = JsonDocument.Parse(value);
                document.RootElement.WriteTo(writer);
            }
            catch
            {
                // Si no es JSON válido, escribir objeto vacío
                writer.WriteStartObject();
                writer.WriteEndObject();
            }
        }
    }
}
