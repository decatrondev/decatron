namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Identificadores internos de juego y proveedor del modulo Game Overlays
/// (.dev/plans/GAME_OVERLAYS_PLAN.md). Strings y no enums a proposito: van
/// directo a columnas VARCHAR y a JSON del frontend, y agregar un juego no
/// deberia requerir migracion.
/// </summary>
public static class GameIds
{
    public const string Lol = "lol";
    public const string Tft = "tft";
    public const string Valorant = "valorant";
    public const string MarvelRivals = "marvel_rivals";
    public const string Cs2 = "cs2";
    public const string Fortnite = "fortnite";
    public const string RocketLeague = "rocket_league";
    public const string Warzone = "warzone";

    public static readonly string[] All = { Lol, Tft, Valorant, MarvelRivals, Cs2, Fortnite, RocketLeague, Warzone };

    public static bool IsKnown(string? game) => game != null && System.Array.IndexOf(All, game) >= 0;
}

public static class GameProviders
{
    public const string Riot = "riot";
    public const string MarvelRivalsApi = "marvelrivalsapi";
    public const string Faceit = "faceit";
    public const string FortniteApi = "fortniteapi";
    public const string Manual = "manual";
}
