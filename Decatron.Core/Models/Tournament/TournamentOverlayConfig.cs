using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_overlay_configs")]
public class TournamentOverlayConfig
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_participant_id")]
    public long TournamentParticipantId { get; set; }

    // Va en la URL del overlay (/overlay/torneo/{token}), sin auth de sesion — el
    // token ES la autenticacion, mismo criterio que el resto de overlays de la
    // plataforma. Regenerable.
    [Column("token")]
    public string Token { get; set; } = "";

    // jsonb crudo: ["lp-actual", "shell-inventory", "castigo-activo", "racha"]
    [Column("enabled_widgets")]
    public string EnabledWidgets { get; set; } = "[\"lp-actual\",\"shell-inventory\",\"racha\"]";

    [Column("theme")]
    public string Theme { get; set; } = "dark";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
