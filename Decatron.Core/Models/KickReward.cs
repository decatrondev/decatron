using System.Text.Json.Serialization;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Recompensa de canal de Kick, tal como la devuelve
    /// GET /public/v1/channels/rewards. A diferencia de los channel points de
    /// Twitch, Kick no expone (todavia) is_enabled/is_paused/is_in_stock ni
    /// color de fondo — solo id, title, cost y description.
    /// </summary>
    public class KickReward
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("title")]
        public string Title { get; set; } = "";

        [JsonPropertyName("cost")]
        public int Cost { get; set; }

        [JsonPropertyName("description")]
        public string Description { get; set; } = "";
    }

    public class KickRewardsResponse
    {
        [JsonPropertyName("data")]
        public List<KickReward>? Data { get; set; }
    }
}
