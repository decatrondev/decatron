namespace Decatron.Core.Settings
{
    /// <summary>
    /// Interruptor de la Rueda de la Suerte.
    ///
    /// <para>Con <see cref="Enabled"/> en false las tablas <c>wheel_*</c> existen
    /// pero la feature no se expone: ni panel, ni comandos de chat, ni overlay. Es
    /// lo que permite tener la migración aplicada en producción mientras las fases
    /// siguientes se siguen construyendo.</para>
    /// </summary>
    public class WheelOfLuckSettings
    {
        public const string SectionName = "WheelOfLuck";

        public bool Enabled { get; set; }
    }
}
