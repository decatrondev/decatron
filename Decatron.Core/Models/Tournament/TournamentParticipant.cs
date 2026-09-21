using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_participants")]
public class TournamentParticipant
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("tournament_division_id")]
    public long? TournamentDivisionId { get; set; }

    [Column("account_id")]
    public long? AccountId { get; set; }

    // Se usa cuando el participante se registro desde el bot de Discord y todavia
    // no vinculo/hizo login web — ver .dev/torneos/05-inscripciones-checkin-verificacion.md #2
    [Column("discord_user_id")]
    public string? DiscordUserId { get; set; }

    [Column("display_name")]
    public string DisplayName { get; set; } = "";

    [Column("riot_id")]
    public string? RiotId { get; set; }

    [Column("riot_tag_line")]
    public string? RiotTagLine { get; set; }

    [Column("riot_puuid")]
    public string? RiotPuuid { get; set; }

    // "top" | "jungle" | "mid" | "adc" | "support"
    [Column("primary_role")]
    public string? PrimaryRole { get; set; }

    [Column("nationality")]
    public string? Nationality { get; set; }

    [Column("twitch_channel")]
    public string? TwitchChannel { get; set; }

    [Column("kick_channel")]
    public string? KickChannel { get; set; }

    [Column("twitter_handle")]
    public string? TwitterHandle { get; set; }

    [Column("team_id")]
    public long? TeamId { get; set; }

    [Column("is_captain")]
    public bool IsCaptain { get; set; }

    // Cuenta como roster pero no como titular a la hora de validar "equipo completo"
    // (Clash 5v5: 5 titulares + suplentes, ver TournamentTeamService).
    [Column("is_substitute")]
    public bool IsSubstitute { get; set; }

    [Column("eligibility_flags")]
    public string[] EligibilityFlags { get; set; } = Array.Empty<string>();

    // "pending_approval" | "approved" | "rejected" | "checked_in" | "active" | "eliminated" | "withdrawn"
    [Column("status")]
    public string Status { get; set; } = "pending_approval";

    // "web" | "discord_bot"
    [Column("registered_via")]
    public string RegisteredVia { get; set; } = "web";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    // Que cuenta de UserRiotAccount (vinculada y verificada en Settings, a nivel
    // plataforma — ver UserRiotAccount) eligio el participante para ESTA edicion.
    // Reemplaza el viejo flujo de verificar Riot por-torneo (15-08-2026): ahora se
    // vincula una sola vez en Settings y se reutiliza en cualquier torneo. RiotId/
    // RiotTagLine/RiotPuuid arriba quedan como copia desnormalizada de esa cuenta al
    // momento de elegirla, para no tocar el resto del modulo (sync de Riot,
    // standings, ranking publico) que ya lee esos campos directo del participante.
    [Column("linked_riot_account_id")]
    public long? LinkedRiotAccountId { get; set; }

    // Se completa si, al elegir esta cuenta, el participante tenia otra cuenta
    // vinculada y verificada de mayor elo en la misma region — no bloquea la
    // inscripcion, pero queda visible para que el organizador lo revise (decision
    // de producto 15-08-2026: "elige el participante, con aviso").
    [Column("smurf_flag_note")]
    public string? SmurfFlagNote { get; set; }
}
