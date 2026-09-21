using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_editions")]
public class TournamentEdition
{
    [Column("id")]
    public long Id { get; set; }

    [Column("channel_owner_id")]
    public long ChannelOwnerId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    [Column("slug")]
    public string Slug { get; set; } = "";

    [Column("short_label")]
    public string? ShortLabel { get; set; }

    // "solo_q_climb" | "aram_teams" | "clash_5v5"
    [Column("mode")]
    public string Mode { get; set; } = "solo_q_climb";

    // "single_elimination" | "double_elimination" | "round_robin" | "swiss" | null
    [Column("bracket_format")]
    public string? BracketFormat { get; set; }

    // "draft" | "registration_open" | "check_in" | "in_progress" | "finished" | "archived"
    [Column("status")]
    public string Status { get; set; } = "draft";

    [Column("game")]
    public string Game { get; set; } = "lol";

    [Column("region")]
    public string Region { get; set; } = "euw1";

    [Column("starts_at")]
    public DateTime? StartsAt { get; set; }

    [Column("ends_at")]
    public DateTime? EndsAt { get; set; }

    [Column("check_in_opens_at")]
    public DateTime? CheckInOpensAt { get; set; }

    [Column("check_in_closes_at")]
    public DateTime? CheckInClosesAt { get; set; }

    [Column("team_size")]
    public short? TeamSize { get; set; }

    [Column("best_of")]
    public short? BestOf { get; set; }

    [Column("logo_url")]
    public string? LogoUrl { get; set; }

    [Column("primary_color")]
    public string? PrimaryColor { get; set; }

    [Column("secondary_color")]
    public string? SecondaryColor { get; set; }

    [Column("prize_pool_total")]
    public decimal? PrizePoolTotal { get; set; }

    [Column("meta_title")]
    public string? MetaTitle { get; set; }

    [Column("meta_description")]
    public string? MetaDescription { get; set; }

    // Nombre propio de cada tenant para las dos mecanicas de castigo/suerte — nunca
    // se hardcodea un nombre de producto de terceros en el codigo, ver
    // Add_Tournament_Custom_Mechanic_Names.sql
    [Column("shell_item_name")]
    public string ShellItemName { get; set; } = "Ficha de Castigo";

    [Column("aegis_mechanic_name")]
    public string AegisMechanicName { get; set; } = "Factor Suerte";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
