using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

/// <summary>
/// Une la clave estable de la plantilla del servidor (rol, canal, mensaje…) con el id real que le tocó en Discord,
/// para que cargar de nuevo no duplique aunque alguien renombre algo. SQL: Decatron.Data/Migrations/Add_Discord_Template_Bindings.sql
/// </summary>
[Table("discord_template_bindings")]
public class DiscordTemplateBinding
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("guild_id"), MaxLength(32)]
    public string GuildId { get; set; } = "";

    [Column("template_key"), MaxLength(100)]
    public string TemplateKey { get; set; } = "";

    /// <summary>Ejemplos: role:team.admin · category:cat.start · channel:welcome · message:welcome:es · automod:spam</summary>
    [Column("object_key"), MaxLength(200)]
    public string ObjectKey { get; set; } = "";

    [Column("discord_id"), MaxLength(32)]
    public string DiscordId { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
