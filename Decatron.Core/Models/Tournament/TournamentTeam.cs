using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_teams")]
public class TournamentTeam
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    [Column("logo_url")]
    public string? LogoUrl { get; set; }

    [Column("seed")]
    public short? Seed { get; set; }

    // Codigo corto para que un jugador se una al equipo desde el form publico —
    // fase 5 seccion 6. Null si el equipo se armo por alta manual del organizador.
    [Column("join_code")]
    public string? JoinCode { get; set; }

    // Se fija (no se puede recalcular) una vez que el bracket ya se genero con este
    // seed — evita que cambiarlo despues descuadre un bracket ya armado.
    [Column("seed_locked")]
    public bool SeedLocked { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
