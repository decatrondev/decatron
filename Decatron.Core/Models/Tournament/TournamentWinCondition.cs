using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

/// <summary>
/// Condicion de victoria configurable para torneos ARAM N vs N (modo aram_teams):
/// en vez de jugar hasta destruir el nexo, el ganador de un cruce del bracket se
/// declara apenas se cumple ALGUNA de las condiciones activas de la edicion (ej.
/// "primera torre" O "2 kills", lo que pase primero). Se evalua contra el timeline
/// de Riot API de la partida jugada. Catalogo de N filas por edicion — mismo patron
/// que TournamentShellTrigger — combinables via OR, gana quien cumpla la primera
/// cronologicamente. Pedido del usuario 24-08-2026 (single -> multi el mismo dia).
/// </summary>
[Table("tournament_win_conditions")]
public class TournamentWinCondition
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    // Nombre libre para identificar la condicion en la lista del panel admin (ej.
    // "Primera torre gana"). No se usa para evaluar nada, solo display.
    [Column("name")]
    public string Name { get; set; } = "";

    // "first_blood" | "team_kills" | "player_kills" | "player_kill_streak" | "multikill" |
    // "first_tower" | "team_towers" | "first_inhibitor" | "cs_threshold" | "gold_threshold" |
    // "level_threshold" | "time_lead" | "gold_lead" | "champion_damage_threshold"
    [Column("condition_type")]
    public string ConditionType { get; set; } = "first_tower";

    // El numero libre que define el organizador (cantidad de kills/subditos/oro/nivel/
    // minutos/tier de multikill segun condition_type). No aplica a first_blood/
    // first_tower/first_inhibitor (siempre "el primero", se ignora aunque tenga valor).
    [Column("threshold_value")]
    public decimal ThresholdValue { get; set; } = 1;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
