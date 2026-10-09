using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Design;

/// <summary>
/// Una versión de los valores de diseño del sitio (editor de /admin/estilo). Guarda solo lo que se
/// cambió respecto a los valores de fábrica del código: JSON {colors:{dark,light}, shape:{…}}.
/// Estados: draft (a lo sumo uno), published (a lo sumo uno) y archived (historial).
/// </summary>
[Table("design_versions")]
public class DesignVersion
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("status"), MaxLength(12)]
    public string Status { get; set; } = "draft";

    [Column("values_json", TypeName = "jsonb")]
    public string ValuesJson { get; set; } = "{}";

    [Column("note"), MaxLength(200)]
    public string Note { get; set; } = "";

    [Column("author_login"), MaxLength(100)]
    public string AuthorLogin { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("published_at")]
    public DateTime? PublishedAt { get; set; }
}
