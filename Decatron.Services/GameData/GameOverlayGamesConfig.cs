using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Lo que el BACKEND necesita leer de game_overlay_configs.games_json. El resto
    /// (elements, background, fonts...) es del frontend y viaja tal cual: por eso se
    /// parsea con JsonElement y solo se tipan estos campos.
    /// </summary>
    public class GameOverlayGameConfig
    {
        public bool Enabled { get; set; }
        public List<long> Accounts { get; set; } = new();
        public RotationConfig Rotation { get; set; } = new();
        /// <summary>"visible_account" | "all_accounts"</summary>
        public string SessionScope { get; set; } = "visible_account";
        /// <summary>Cola por defecto del juego ("solo", "flex"); null = default del proveedor.</summary>
        public string? Queue { get; set; }
        /// <summary>Override por cuenta: linked_account_id -> cola.</summary>
        public Dictionary<string, string> AccountQueues { get; set; } = new();

        public string? QueueFor(long accountId) =>
            AccountQueues.TryGetValue(accountId.ToString(), out var q) && !string.IsNullOrEmpty(q) ? q : Queue;

        public class RotationConfig
        {
            /// <summary>"none" | "interval" | "active_first"</summary>
            public string Mode { get; set; } = "none";
            public int Seconds { get; set; } = 30;
        }
    }

    public static class GameOverlayGamesConfig
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
        {
            NumberHandling = JsonNumberHandling.AllowReadingFromString,
        };

        public static Dictionary<string, GameOverlayGameConfig> Parse(string? gamesJson)
        {
            var result = new Dictionary<string, GameOverlayGameConfig>();
            if (string.IsNullOrWhiteSpace(gamesJson)) return result;
            try
            {
                using var doc = JsonDocument.Parse(gamesJson);
                if (doc.RootElement.ValueKind != JsonValueKind.Object) return result;
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    try
                    {
                        var cfg = prop.Value.Deserialize<GameOverlayGameConfig>(Json);
                        if (cfg != null) result[prop.Name] = cfg;
                    }
                    catch { /* un juego con json roto no tumba a los demas */ }
                }
            }
            catch { /* json roto = sin juegos */ }
            return result;
        }
    }
}
