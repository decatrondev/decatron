using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

/// <summary>
/// Grupo de Fortnite: cuando no entran todos los equipos en un lobby se reparten
/// en grupos y los mejores pasan a la final (is_final).
/// </summary>
[Table("tournament_fortnite_groups")]
public class TournamentFortniteGroup
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    [Column("sort_order")]
    public short SortOrder { get; set; }

    [Column("is_final")]
    public bool IsFinal { get; set; }

    // Cuantos equipos de este grupo pasan a la final. Null en la final.
    [Column("qualify_count")]
    public short? QualifyCount { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("tournament_fortnite_group_teams")]
public class TournamentFortniteGroupTeam
{
    [Column("id")]
    public long Id { get; set; }

    [Column("group_id")]
    public long GroupId { get; set; }

    [Column("team_id")]
    public long TeamId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
