namespace Decatron.Services.Desktop
{
    /// <summary>Sección "Desktop" de appsettings.</summary>
    public class DesktopOptions
    {
        public const string Section = "Desktop";

        /// <summary>Un código de vinculación caduca a los N minutos.</summary>
        public int LinkCodeMinutes { get; set; } = 10;

        /// <summary>Versión mínima de la app aceptada; más vieja ⇒ se le pide actualizar.</summary>
        public string MinAppVersion { get; set; } = "0.0.1";
    }
}
