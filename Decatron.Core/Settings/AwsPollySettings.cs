namespace Decatron.Core.Settings
{
    public class AwsPollySettings
    {
        public string AccessKeyId { get; set; } = string.Empty;
        public string SecretAccessKey { get; set; } = string.Empty;
        public string Region { get; set; } = "us-east-1";
        public string CachePath { get; set; } = "/var/www/html/decatron/tts-cache";
    }
}
