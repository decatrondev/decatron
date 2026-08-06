using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Datos con los que se emite el comprobante de una compra.
    ///
    /// <para>Vive en su propia tabla porque el bot no la necesita para nada: quien usa
    /// Decatron gratis nunca tiene una fila acá. Se completa una sola vez, cuando alguien
    /// quiere comprar algo que lleva comprobante.</para>
    /// </summary>
    [Table("billing_profiles")]
    public class BillingProfile
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>
        /// ISO-3166 alpha-2. "PE" es venta interna; cualquier otro país convierte la
        /// operación en exportación de servicios: factura y sin IGV.
        /// </summary>
        [Column("country")]
        [MaxLength(2)]
        public string Country { get; set; } = "PE";

        /// <summary>Catálogo 06, con los nombres que espera DecatronAPI.</summary>
        [Column("doc_type")]
        [MaxLength(30)]
        public string DocType { get; set; } = string.Empty;

        [Column("doc_number")]
        [MaxLength(20)]
        public string DocNumber { get; set; } = string.Empty;

        /// <summary>Nombre de la persona o razón social de la empresa.</summary>
        [Column("legal_name")]
        [MaxLength(200)]
        public string LegalName { get; set; } = string.Empty;

        [Column("address")]
        [MaxLength(300)]
        public string? Address { get; set; }

        [Column("email")]
        [MaxLength(255)]
        public string? Email { get; set; }

        /// <summary>"sunat" si la razón social vino de la consulta de RUC, "manual" si la escribió el usuario.</summary>
        [Column("name_source")]
        [MaxLength(10)]
        public string NameSource { get; set; } = "manual";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Un comprador de fuera del Perú: su compra es exportación de servicios.</summary>
        [NotMapped]
        public bool EsExtranjero => !string.Equals(Country, "PE", StringComparison.OrdinalIgnoreCase);

        /// <summary>Solo quien tiene RUC puede pedir factura; el resto recibe boleta.</summary>
        [NotMapped]
        public bool PuedeFactura => string.Equals(DocType, "RUC", StringComparison.OrdinalIgnoreCase);
    }
}
