namespace Decatron.Core.Settings
{
    public class EmailSettings
    {
        public string ResendApiKey { get; set; } = string.Empty;
        public string FromAddress { get; set; } = "DecatronAPI <support@decatron.net>";
        public string AdminEmail { get; set; } = "support@decatron.net";
        /// <summary>Servidor propio (Mailcow). La contraseña va en appsettings.Secrets.json, nunca en la base.</summary>
        public SmtpSettings Smtp { get; set; } = new();
    }

    public class SmtpSettings
    {
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; } = 587;
        public string User { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public bool Configured => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(User) && !string.IsNullOrWhiteSpace(Password);
    }
}
