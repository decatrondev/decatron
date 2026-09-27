using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

/// <summary>
/// Como se cuentan los puntos en una edicion de Fortnite (una fila por edicion):
/// puntos por puesto, por eliminacion, orden de desempate, tamaño del lobby y
/// match point opcional. Ver .dev/torneos/15-fortnite.md F2.
/// </summary>
[Table("tournament_fortnite_configs")]
public class TournamentFortniteConfig
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    // jsonb crudo: [{"from":1,"to":1,"points":25}, ...] — se (de)serializa en
    // TournamentFortniteFormatService, igual criterio que TournamentBlueShellRules.
    [Column("placement_points")]
    public string PlacementPoints { get; set; } = "[]";

    [Column("points_per_elimination")]
    public int PointsPerElimination { get; set; } = 1;

    // "wins" | "eliminations" | "avg_placement" | "last_game_placement", en orden.
    [Column("tiebreakers")]
    public string[] Tiebreakers { get; set; } = { "wins", "eliminations", "avg_placement", "last_game_placement" };

    [Column("max_players_per_lobby")]
    public short MaxPlayersPerLobby { get; set; } = 100;

    [Column("fill_solos_randomly")]
    public bool FillSolosRandomly { get; set; } = true;

    [Column("match_point_threshold")]
    public int? MatchPointThreshold { get; set; }

    // Pruebas (F4): "always" = captura obligatoria | "on_conflict" = solo si hay
    // algo raro | "staff_only" = carga el organizador.
    [Column("proof_mode")]
    public string ProofMode { get; set; } = "always";

    // Minutos para reportar desde que termina la partida.
    [Column("report_window_minutes")]
    public int ReportWindowMinutes { get; set; } = 30;

    // true = el equipo que no reporta suma 0 al cerrar la partida.
    [Column("missing_report_zero")]
    public bool MissingReportZero { get; set; } = true;

    // true = las capturas de los resultados aprobados se ven en la pagina publica (F5).
    [Column("public_screenshots")]
    public bool PublicScreenshots { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class FortnitePlacementRange
{
    public int From { get; set; }
    public int To { get; set; }
    public int Points { get; set; }
}
