using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_riot_configs")]
public class TournamentRiotConfig
{
    [Column("id")]
    public long Id { get; set; }

    [Column("channel_owner_id")]
    public long ChannelOwnerId { get; set; }

    // Cifrada a nivel EF Core con EncryptedStringConverter (mismo mecanismo que los
    // tokens OAuth existentes) — ver .dev/torneos/03-riot-api-integracion.md #1
    [Column("api_key")]
    public string ApiKey { get; set; } = "";

    // "development" | "production" — determina el rate limit asumido por el poller
    [Column("key_type")]
    public string KeyType { get; set; } = "development";

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("last_validated_at")]
    public DateTime? LastValidatedAt { get; set; }

    [Column("last_error_at")]
    public DateTime? LastErrorAt { get; set; }

    [Column("last_error_message")]
    public string? LastErrorMessage { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
