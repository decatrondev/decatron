using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Override por streamer de un comando específico para la vista pública de comandos.
    /// Solo se guarda una fila cuando el comando difiere del default (oculto y/o con descripción pública custom) —
    /// si no hay override, el comando se considera visible sin descripción pública.
    /// </summary>
    [Table("public_command_overrides")]
    public class PublicCommandOverride
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public User? ChannelUser { get; set; }

        // default, custom, microcommands, scripting
        [Required]
        [Column("category")]
        [MaxLength(20)]
        public string Category { get; set; } = "";

        // Identificador dentro de la categoría: nombre del comando para "default", id numérico (como string) para el resto
        [Required]
        [Column("command_key")]
        [MaxLength(100)]
        public string CommandKey { get; set; } = "";

        [Column("hidden")]
        public bool Hidden { get; set; } = false;

        [Column("public_description")]
        public string? PublicDescription { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
