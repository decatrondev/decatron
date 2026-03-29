namespace Decatron.Core.Settings
{
    public class TwitchSettings
    {
        public string ClientId { get; set; }
        public string ClientSecret { get; set; }
        public string BotToken { get; set; }
        public string BotUsername { get; set; }
        public string ChannelId { get; set; }
        public string RedirectUri { get; set; }
        public string Scopes { get; set; }

        // Frontend URL Configuration
        public string FrontendUrl { get; set; } = "http://localhost:5173";

        // EventSub Configuration
        public string WebhookSecret { get; set; }
        public string EventSubWebhookSecret { get; set; }
        public string EventSubWebhookUrl { get; set; }
        public int EventSubWebhookPort { get; set; } = 7264;
    }
}