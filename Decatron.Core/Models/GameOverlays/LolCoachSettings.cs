using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Configuración del Coach de LoL de un canal. Una fila por streamer. El nombre y el
/// tono son por canal a propósito: la marca es "Decatron Coach", pero cada streamer
/// lo bautiza como quiera (Juan → "Jarvis"). Plan: .dev/plans/LOL_COACH_PLAN.md
/// </summary>
[Table("lol_coach_settings")]
public class LolCoachSettings
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>Comentarios de IA en selección de campeón y resumen al terminar.</summary>
    [Column("enabled")]
    public bool Enabled { get; set; }

    [Column("coach_name"), MaxLength(40)]
    public string CoachName { get; set; } = "Coach";

    /// <summary>analyst | hype | troll</summary>
    [Column("tone"), MaxLength(20)]
    public string Tone { get; set; } = "analyst";

    /// <summary>Comentar cada pick/ban del rival y del equipo (gasta más llamadas). Si no, solo tu turno y el final.</summary>
    [Column("comment_picks")]
    public bool CommentPicks { get; set; } = true;

    /// <summary>Resumen automático al terminar la partida (si no, solo con !coach).</summary>
    [Column("post_game_summary")]
    public bool PostGameSummary { get; set; } = true;

    /// <summary>Lo que dice el coach sale también en el overlay (widget "Coach dice").</summary>
    [Column("show_on_overlay")]
    public bool ShowOnOverlay { get; set; } = true;

    /// <summary>Champ pool declarado por el streamer, separado por comas. Vacío = se infiere del historial.</summary>
    [Column("champ_pool"), MaxLength(400)]
    public string ChampPool { get; set; } = "";

    /// <summary>Instrucciones extra para el prompt ("odio jugar tanques", "háblame de vos").</summary>
    [Column("notes"), MaxLength(600)]
    public string Notes { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
