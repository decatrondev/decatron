namespace Decatron.Discord.Models;

public class DiscordSettings
{
    public string BotToken { get; set; } = string.Empty;
    public string AppId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}
