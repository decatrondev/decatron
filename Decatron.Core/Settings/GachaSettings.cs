namespace Decatron.Core.Settings
{
    /// <summary>
    /// Configuración para la integración con GachaVerse
    /// </summary>
    public class GachaSettings
    {
        /// <summary>
        /// URL de la aplicación web de GachaVerse
        /// </summary>
        public string WebUrl { get; set; } = "http://localhost:3000";

        /// <summary>
        /// Nombre del bot que se unirá al canal del usuario
        /// </summary>
        public string BotUsername { get; set; } = "decatronstreambot";
    }
}
