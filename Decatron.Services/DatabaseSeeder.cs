using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services;

public class DatabaseSeeder
{
    private readonly DecatronDbContext _context;
    private readonly ILogger<DatabaseSeeder> _logger;

    public DatabaseSeeder(DecatronDbContext context, ILogger<DatabaseSeeder> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SeedGameCacheAndAliasesAsync()
    {
        try
        {
            _logger.LogInformation("🌱 Iniciando seed de game_cache y game_aliases...");

            // Verificar si ya hay datos
            var aliasCount = await _context.GameAliases.CountAsync();
            if (aliasCount > 0)
            {
                _logger.LogInformation("✅ Ya existen {Count} aliases en la base de datos. Seed omitido.", aliasCount);
                return;
            }

            // Seed game_cache con juegos populares
            var games = new List<GameCache>
            {
                new() { GameId = "21779", Name = "League of Legends", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/21779-52x72.jpg", PopularityRank = 1 },
                new() { GameId = "516575", Name = "VALORANT", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/516575-52x72.jpg", PopularityRank = 2 },
                new() { GameId = "32982", Name = "Grand Theft Auto V", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/32982-52x72.jpg", PopularityRank = 3 },
                new() { GameId = "27471", Name = "Minecraft", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/27471-52x72.jpg", PopularityRank = 4 },
                new() { GameId = "32399", Name = "Counter-Strike", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/32399-52x72.jpg", PopularityRank = 5 },
                new() { GameId = "33214", Name = "Fortnite", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/33214-52x72.jpg", PopularityRank = 6 },
                new() { GameId = "29595", Name = "Dota 2", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/29595-52x72.jpg", PopularityRank = 7 },
                new() { GameId = "512710", Name = "Call of Duty: Warzone", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/512710-52x72.jpg", PopularityRank = 8 },
                new() { GameId = "491931", Name = "Escape From Tarkov", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/491931-52x72.jpg", PopularityRank = 9 },
                new() { GameId = "138585", Name = "Hearthstone", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/138585-52x72.jpg", PopularityRank = 10 },
                new() { GameId = "493057", Name = "PUBG: BATTLEGROUNDS", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/493057-52x72.jpg", PopularityRank = 11 },                
                new() { GameId = "518203", Name = "Sports", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/518203-52x72.jpg", PopularityRank = 13 },
                new() { GameId = "509658", Name = "Just Chatting", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/509658-52x72.jpg", PopularityRank = 14 },
                new() { GameId = "263490", Name = "Rust", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/263490-52x72.jpg", PopularityRank = 15 },
                new() { GameId = "488552", Name = "Overwatch 2", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/488552-52x72.jpg", PopularityRank = 16 },
                new() { GameId = "460630", Name = "Tom Clancy's Rainbow Six Siege", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/460630-52x72.jpg", PopularityRank = 17 },
                new() { GameId = "511224", Name = "Apex Legends", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/511224-52x72.jpg", PopularityRank = 18 },
                new() { GameId = "491487", Name = "Dead by Daylight", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/491487-52x72.jpg", PopularityRank = 19 },
                new() { GameId = "512980", Name = "Fall Guys", BoxArtUrl = "https://static-cdn.jtvnw.net/ttv-boxart/512980-52x72.jpg", PopularityRank = 20 }
            };

            foreach (var game in games)
            {
                var exists = await _context.GameCache.AnyAsync(g => g.GameId == game.GameId);
                if (!exists)
                {
                    await _context.GameCache.AddAsync(game);
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("✅ {Count} juegos agregados a game_cache", games.Count);

            // Seed game_aliases
            var aliases = new List<GameAlias>
            {
                // League of Legends
                new() { Alias = "lol", GameId = "21779", GameName = "League of Legends", AliasType = "system" },
                new() { Alias = "league", GameId = "21779", GameName = "League of Legends", AliasType = "system" },
                new() { Alias = "league of legends", GameId = "21779", GameName = "League of Legends", AliasType = "system" },

                // VALORANT
                new() { Alias = "val", GameId = "516575", GameName = "VALORANT", AliasType = "system" },
                new() { Alias = "valorant", GameId = "516575", GameName = "VALORANT", AliasType = "system" },

                // GTA V
                new() { Alias = "gta", GameId = "32982", GameName = "Grand Theft Auto V", AliasType = "system" },
                new() { Alias = "gta5", GameId = "32982", GameName = "Grand Theft Auto V", AliasType = "system" },
                new() { Alias = "gtav", GameId = "32982", GameName = "Grand Theft Auto V", AliasType = "system" },

                // Minecraft
                new() { Alias = "mc", GameId = "27471", GameName = "Minecraft", AliasType = "system" },
                new() { Alias = "minecraft", GameId = "27471", GameName = "Minecraft", AliasType = "system" },

                // Counter-Strike
                new() { Alias = "cs", GameId = "32399", GameName = "Counter-Strike", AliasType = "system" },
                new() { Alias = "cs2", GameId = "32399", GameName = "Counter-Strike", AliasType = "system" },
                new() { Alias = "csgo", GameId = "32399", GameName = "Counter-Strike", AliasType = "system" },

                // Fortnite
                new() { Alias = "fn", GameId = "33214", GameName = "Fortnite", AliasType = "system" },
                new() { Alias = "fortnite", GameId = "33214", GameName = "Fortnite", AliasType = "system" },

                // Dota 2
                new() { Alias = "dota", GameId = "29595", GameName = "Dota 2", AliasType = "system" },
                new() { Alias = "dota2", GameId = "29595", GameName = "Dota 2", AliasType = "system" },

                // Call of Duty
                new() { Alias = "cod", GameId = "512710", GameName = "Call of Duty: Warzone", AliasType = "system" },
                new() { Alias = "warzone", GameId = "512710", GameName = "Call of Duty: Warzone", AliasType = "system" },
                new() { Alias = "wz", GameId = "512710", GameName = "Call of Duty: Warzone", AliasType = "system" },

                // Escape From Tarkov
                new() { Alias = "eft", GameId = "491931", GameName = "Escape From Tarkov", AliasType = "system" },
                new() { Alias = "tarkov", GameId = "491931", GameName = "Escape From Tarkov", AliasType = "system" },

                // Hearthstone
                new() { Alias = "hs", GameId = "138585", GameName = "Hearthstone", AliasType = "system" },
                new() { Alias = "hearthstone", GameId = "138585", GameName = "Hearthstone", AliasType = "system" },

                // PUBG
                new() { Alias = "pubg", GameId = "493057", GameName = "PUBG: BATTLEGROUNDS", AliasType = "system" },
                new() { Alias = "battlegrounds", GameId = "493057", GameName = "PUBG: BATTLEGROUNDS", AliasType = "system" },

                // Apex Legends
                new() { Alias = "apex", GameId = "511224", GameName = "Apex Legends", AliasType = "system" },
                new() { Alias = "apex legends", GameId = "511224", GameName = "Apex Legends", AliasType = "system" },

                // Rust
                new() { Alias = "rust", GameId = "263490", GameName = "Rust", AliasType = "system" },

                // Overwatch
                new() { Alias = "ow", GameId = "488552", GameName = "Overwatch 2", AliasType = "system" },
                new() { Alias = "ow2", GameId = "488552", GameName = "Overwatch 2", AliasType = "system" },
                new() { Alias = "overwatch", GameId = "488552", GameName = "Overwatch 2", AliasType = "system" },

                // Rainbow Six Siege
                new() { Alias = "r6", GameId = "460630", GameName = "Tom Clancy's Rainbow Six Siege", AliasType = "system" },
                new() { Alias = "r6s", GameId = "460630", GameName = "Tom Clancy's Rainbow Six Siege", AliasType = "system" },
                new() { Alias = "rainbow six", GameId = "460630", GameName = "Tom Clancy's Rainbow Six Siege", AliasType = "system" },
                new() { Alias = "siege", GameId = "460630", GameName = "Tom Clancy's Rainbow Six Siege", AliasType = "system" },

                // Dead by Daylight
                new() { Alias = "dbd", GameId = "491487", GameName = "Dead by Daylight", AliasType = "system" },
                new() { Alias = "dead by daylight", GameId = "491487", GameName = "Dead by Daylight", AliasType = "system" },

                // Fall Guys
                new() { Alias = "fall guys", GameId = "512980", GameName = "Fall Guys", AliasType = "system" },

                // Just Chatting
                new() { Alias = "chatting", GameId = "509658", GameName = "Just Chatting", AliasType = "system" },
                new() { Alias = "just chatting", GameId = "509658", GameName = "Just Chatting", AliasType = "system" }
            };

            await _context.GameAliases.AddRangeAsync(aliases);
            await _context.SaveChangesAsync();

            _logger.LogInformation("✅ {Count} aliases agregados a game_aliases", aliases.Count);
            _logger.LogInformation("🎉 Seed completado exitosamente");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error ejecutando seed de game_cache y game_aliases");
        }
    }
}
