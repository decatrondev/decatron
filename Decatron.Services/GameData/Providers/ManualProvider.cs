using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;

namespace Decatron.Services.GameData.Providers
{
    /// <summary>
    /// Proveedor "a mano": el rango vive en linked_game_accounts.manual_rank y lo
    /// fija el streamer desde el panel o con !setrango / !rankup / !rankdown; las
    /// partidas de la sesion las lleva !win / !loss (GameSessionService). Es el
    /// fallback universal: Rocket League y Warzone (sin API), y cualquier juego cuya
    /// API todavia no tenga key (TFT/Valorant hasta que Riot apruebe).
    /// </summary>
    public class ManualProvider : IGameDataProvider
    {
        public string Game => "*";
        public string Provider => GameProviders.Manual;
        public bool IsAvailable => true;

        public ProviderCapabilities Capabilities { get; } = new()
        {
            HasRank = true, HasExactPoints = false, HasRecentMatches = false, HasKda = false,
            HasLiveGame = false, IsManualOnly = true, RequiresVerification = false, RequiresRegion = false,
        };

        public Task<(ResolvedAccount? account, string? error)> ResolveAsync(string name, string? tag, string? region, CancellationToken ct = default)
            => Task.FromResult<(ResolvedAccount?, string?)>((new ResolvedAccount { ExternalId = "", ExternalName = name.Trim(), ExternalTag = tag, Region = region }, null));

        public Task<RankInfo?> GetRankAsync(LinkedGameAccount account, string? queue = null, CancellationToken ct = default)
            => Task.FromResult(FromManual(account));

        public Task<IReadOnlyList<MatchSummary>> GetRecentMatchesAsync(LinkedGameAccount account, int count, DateTime? since, string? queue = null, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<MatchSummary>>(Array.Empty<MatchSummary>());

        public Task<LiveGameInfo?> GetLiveGameAsync(LinkedGameAccount account, CancellationToken ct = default)
            => Task.FromResult<LiveGameInfo?>(null);

        /// <summary>Convierte manual_rank a RankInfo; UNRANKED si no hay nada fijado.</summary>
        public static RankInfo? FromManual(LinkedGameAccount account)
        {
            ManualRank? manual = null;
            if (!string.IsNullOrWhiteSpace(account.ManualRankJson))
            {
                try { manual = JsonSerializer.Deserialize<ManualRank>(account.ManualRankJson, new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
                catch { /* json roto = sin rango manual */ }
            }
            if (manual == null) return null;

            return new RankInfo
            {
                Tier = string.IsNullOrWhiteSpace(manual.Tier) ? "UNRANKED" : manual.Tier.ToUpperInvariant(),
                Division = manual.Division,
                Points = manual.Points,
                PointsLabel = "",
                Emblem = $"/games/{account.Game}/ranks/{(string.IsNullOrWhiteSpace(manual.Tier) ? "unranked" : manual.Tier.ToLowerInvariant())}.png",
                IsExact = false,
                Source = "manual",
            };
        }
    }
}
