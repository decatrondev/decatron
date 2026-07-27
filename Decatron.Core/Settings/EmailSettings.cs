namespace Decatron.Core.Settings
{
    public class EmailSettings
    {
        public string ResendApiKey { get; set; } = string.Empty;
        public string FromAddress { get; set; } = "DecatronAPI <support@decatron.net>";
        public string AdminEmail { get; set; } = "support@decatron.net";
    }
}
