namespace Decatron.Core.Settings
{
    /// <summary>
    /// Ajustes globales de !clip (los de cada canal viven en <c>clip_command_configs</c>).
    /// Con <see cref="Enabled"/> en false el comando no responde y el controlador devuelve 404.
    /// Plan: .dev/plans/CLIP_COMANDO_PLAN.md
    /// </summary>
    public class ClipCommandSettings
    {
        public const string SectionName = "ClipCommand";

        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Si el espacio libre del disco de clips baja de este valor, la descarga se pausa sola y
        /// solo se guarda el enlace. 0 desactiva la válvula.
        /// </summary>
        public int MinFreeDiskGb { get; set; } = 10;

        /// <summary>Twitch da por fallido un clip que no aparece en Get Clips a los 60 s.</summary>
        public int ConfirmTimeoutSeconds { get; set; } = 60;

        /// <summary>Cada cuánto se consulta Get Clips mientras se espera que el clip exista.</summary>
        public int ConfirmPollSeconds { get; set; } = 3;
    }
}
