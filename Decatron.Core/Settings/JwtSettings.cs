namespace Decatron.Core.Settings
{
    public class JwtSettings
    {
        public string SecretKey { get; set; }
        public int ExpiryMinutes { get; set; }
        public int RefreshTokenExpiryDays { get; set; }
    }
}