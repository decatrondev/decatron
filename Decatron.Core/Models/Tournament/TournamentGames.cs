namespace Decatron.Core.Models.Tournament;

/// <summary>
/// Juegos que admite el modulo de torneos y lo propio de cada uno. LoL usa los
/// modos/regiones de siempre; Fortnite juega por puntos en partidas personalizadas
/// del streamer (ver .dev/torneos/15-fortnite.md).
/// </summary>
public static class TournamentGames
{
    public const string Lol = "lol";
    public const string Fortnite = "fortnite";

    public static readonly string[] All = { Lol, Fortnite };

    public static bool IsKnown(string? game) => game != null && System.Array.IndexOf(All, game) >= 0;

    // Fortnite tiene un solo modo: puntos por puesto y eliminaciones en N partidas.
    public const string FortniteMode = "fortnite_points";

    // Regiones de servidor de Fortnite (las del selector del juego).
    public static readonly string[] FortniteRegions = { "nae", "nac", "naw", "eu", "br", "asia", "me", "oce" };

    // Solo, duo, trio o escuadra.
    public const short FortniteMaxTeamSize = 4;
}
