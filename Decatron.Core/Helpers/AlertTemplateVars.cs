namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Sustitución de variables en las plantillas de alertas.
    ///
    /// Existe porque cada feature tenía su propia lista de reemplazos y no coincidían:
    /// el panel ofrece plantillas con <c>{userName}</c> (N mayúscula) y su vista previa lo
    /// sustituye, pero el backend de alertas de eventos solo reemplazaba <c>{username}</c>
    /// en minúsculas. Resultado: el TTS leía el marcador literal, llaves incluidas, y como
    /// el texto salía idéntico siempre acababa servido desde caché para siempre.
    ///
    /// Se acepta cualquier variante que el panel pueda insertar. Es más barato aceptar de
    /// más que dejar a alguien preguntándose por qué su alerta dice "llave userName llave".
    /// </summary>
    public static class AlertTemplateVars
    {
        /// <param name="username">Nombre a mostrar (el que dona, sigue, se suscribe…).</param>
        /// <param name="amountText">Cantidad ya formateada: "100", "$5.00", "3"…</param>
        public static string Replace(
            string template,
            string? username,
            string? amountText,
            string? tier = null,
            string? months = null,
            string? level = null,
            string? userMessage = null)
        {
            if (string.IsNullOrEmpty(template)) return template ?? "";

            var name = username ?? "";
            var amount = amountText ?? "";
            var monthsText = months ?? amount;
            var levelText = level ?? amount;

            return template
                // Nombre — todas las variantes que puede insertar el panel
                .Replace("{userName}", name)
                .Replace("{username}", name)
                .Replace("{user}", name)
                .Replace("{name}", name)
                .Replace("{donor}", name)
                .Replace("{donorName}", name)
                // Cantidad
                .Replace("{amount}", amount)
                .Replace("{formattedAmount}", amount)
                .Replace("{bits}", amount)
                .Replace("{viewers}", amount)
                .Replace("{subs}", amount)
                // Específicas
                .Replace("{months}", monthsText)
                .Replace("{level}", levelText)
                .Replace("{tier}", tier ?? "")
                .Replace("{message}", userMessage ?? "");
        }
    }
}
