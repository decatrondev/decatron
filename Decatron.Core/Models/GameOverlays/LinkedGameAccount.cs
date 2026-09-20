using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Cuenta de juego vinculada a nivel PERSONA (account_id), no por canal ni por
/// torneo. Reemplaza a user_riot_accounts (migrada el 18-09-2026 conservando los
/// ids, asi TournamentParticipant.LinkedRiotAccountId sigue apuntando bien).
///
/// Una misma cuenta de Riot (mismo PUUID) puede tener una fila por juego (lol,
/// tft, valorant) — la verificacion se comparte por external_id, ver
/// GameAccountService. Para juegos sin API (rocket_league, warzone) el
/// proveedor es "manual" y el rango vive en manual_rank.
/// </summary>
[Table("linked_game_accounts")]
public class LinkedGameAccount
{
    [Column("id")]
    public long Id { get; set; }

    // AccountId efectivo (Users.AccountId ?? Users.Id) — mismo criterio que
    // TournamentMeController y el viejo UserRiotAccount.
    [Column("account_id")]
    public long AccountId { get; set; }

    [Column("game")]
    public string Game { get; set; } = "";

    [Column("provider")]
    public string Provider { get; set; } = "";

    // Nombre visible en el panel/overlay ("Main", "Smurf EUW"). Si esta vacio se
    // muestra external_name.
    [Column("display_name")]
    public string DisplayName { get; set; } = "";

    // Riot ID / nick FACEIT / nombre Epic / nombre en Marvel Rivals.
    [Column("external_name")]
    public string ExternalName { get; set; } = "";

    // Tag de Riot (sin '#'); null en otros proveedores.
    [Column("external_tag")]
    public string? ExternalTag { get; set; }

    // PUUID / player_id FACEIT / accountId Epic / uid MR. Vacio en manual.
    [Column("external_id")]
    public string ExternalId { get; set; } = "";

    // Region de plataforma de Riot (la2, na1, euw1...). Null en otros proveedores.
    [Column("region")]
    public string? Region { get; set; }

    // Verificacion de propiedad — metodo del icono de invocador para Riot (ver
    // .dev/torneos/03-riot-api-integracion.md #2). Otros proveedores no verifican
    // por ahora (datos publicos). RSO reemplazara esto cuando Riot lo apruebe.
    [Column("verification_challenge_icon_id")]
    public int? VerificationChallengeIconId { get; set; }

    [Column("verification_started_at")]
    public DateTime? VerificationStartedAt { get; set; }

    [Column("verified_at")]
    public DateTime? VerifiedAt { get; set; }

    // JSON { "tier": "Champion", "division": "II", "points": 0 } — rango fijado a
    // mano (modo manual) o override cuando el proveedor no da rango exacto.
    [Column("manual_rank", TypeName = "jsonb")]
    public string? ManualRankJson { get; set; }

    [Column("manual_updated_at")]
    public DateTime? ManualUpdatedAt { get; set; }

    // Orden en la rotacion del overlay.
    [Column("sort_order")]
    public int SortOrder { get; set; }

    // Incluida en rotacion / disponible. Al bajar de tier las que sobran quedan
    // en false, nunca se borran.
    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [NotMapped]
    public bool IsVerified => VerifiedAt != null;

    [NotMapped]
    public string FullExternalName => string.IsNullOrEmpty(ExternalTag) ? ExternalName : $"{ExternalName}#{ExternalTag}";
}
