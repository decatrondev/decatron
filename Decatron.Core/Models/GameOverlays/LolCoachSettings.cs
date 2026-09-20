using System;
using System.Linq;
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

    /// <summary>El coach habla por audio en el Desktop (Deepgram Aura, cobra créditos TTS del canal).</summary>
    [Column("voice_enabled")]
    public bool VoiceEnabled { get; set; }

    /// <summary>Voz del catálogo de Deepgram. Vacío = la voz por defecto del idioma del canal.</summary>
    [Column("voice_id"), MaxLength(60)]
    public string VoiceId { get; set; } = "";

    /// <summary>Qué momentos van con voz, separados por coma: pick, my_turn, final, postgame.</summary>
    [Column("voice_kinds"), MaxLength(60)]
    public string VoiceKinds { get; set; } = "my_turn,final,postgame";

    /// <summary>Briefing al abrir el cliente (una vez por día): rango, ayer, mejor champ de la semana, racha, objetivo.</summary>
    [Column("briefing")]
    public bool Briefing { get; set; } = true;

    /// <summary>A las 3 derrotas seguidas de la sesión pregunta si sigue. Off por defecto: a muchos les molesta.</summary>
    [Column("tilt_check")]
    public bool TiltCheck { get; set; }

    /// <summary>Comentar el lobby cuando entra alguien (récord juntos, quién está en racha).</summary>
    [Column("lobby_comments")]
    public bool LobbyComments { get; set; } = true;

    /// <summary>Objetivo del día ("subir a Oro I", "3 wins"). Lo fija el streamer con !meta o desde el panel; el coach lo tiene en cuenta.</summary>
    [Column("daily_goal"), MaxLength(200)]
    public string DailyGoal { get; set; } = "";

    [Column("goal_set_at")]
    public DateTime? GoalSetAt { get; set; }

    /// <summary>El objetivo vale el día que se fijó (hasta 18 h después, para streams que cruzan medianoche).</summary>
    public string? CurrentGoal => !string.IsNullOrWhiteSpace(DailyGoal) && GoalSetAt != null && (DateTime.UtcNow - GoalSetAt.Value) < TimeSpan.FromHours(18) ? DailyGoal : null;

    /// <summary>Predicciones del chat (!pred win|loss) con puntos de predicción del canal.</summary>
    [Column("predictions_enabled")]
    public bool PredictionsEnabled { get; set; }

    /// <summary>Puntos con los que arranca cada viewer nuevo en este canal.</summary>
    [Column("prediction_start_points")]
    public int PredictionStartPoints { get; set; } = 1000;

    /// <summary>Minutos de partida hasta que cierra la predicción.</summary>
    [Column("prediction_close_minutes")]
    public int PredictionCloseMinutes { get; set; } = 5;

    public bool SpeaksOn(string kind) => VoiceEnabled && VoiceKinds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Contains(kind);

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
