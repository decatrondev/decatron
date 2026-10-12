using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.LiveTranslation
{
    /// <summary>
    /// Quién puede escuchar la traducción de un canal y con qué límites, para que nadie de mala fe le gaste los créditos al
    /// streamer. Una fila por streamer; sin fila rige el preset recomendado. Plan: .dev/plans/TRADUCCION_ACCESO_PLAN.md.
    /// El nivel de acceso (mode, listas) y el presupuesto se aplican en fases posteriores; en la Fase 1 rigen los límites duros.
    /// </summary>
    [Table("live_translation_access")]
    public class LiveTranslationAccess
    {
        [Key][Column("id")] public long Id { get; set; }
        [Column("user_id")] public long UserId { get; set; }

        /// <summary>everyone | logged_in | followers | subscribers | vip | mods | list (Fase 3)</summary>
        [Column("mode"), MaxLength(20)] public string Mode { get; set; } = "everyone";
        [Column("min_follow_days")] public int MinFollowDays { get; set; } = 7;
        [Column("min_sub_tier")] public int MinSubTier { get; set; } = 1;
        [Column("allow_list")] public string AllowList { get; set; } = "";
        [Column("block_list")] public string BlockList { get; set; } = "";

        /// <summary>Oyentes simultáneos en todo el canal; null = el valor recomendado del plan.</summary>
        [Column("max_listeners_total")] public int? MaxListenersTotal { get; set; }
        /// <summary>Oyentes simultáneos por idioma; null = el mismo tope del canal.</summary>
        [Column("max_listeners_per_language")] public int? MaxListenersPerLanguage { get; set; }
        /// <summary>Idiomas que pueden estar encendidos a la vez (cada idioma con un oyente gasta voz y traducción).</summary>
        [Column("max_active_languages")] public int MaxActiveLanguages { get; set; } = 2;
        [Column("max_connections_per_ip")] public int MaxConnectionsPerIp { get; set; } = 3;
        [Column("max_connections_per_user")] public int MaxConnectionsPerUser { get; set; } = 2;
        [Column("credit_budget_per_session")] public long? CreditBudgetPerSession { get; set; }

        /// <summary>Botón de pánico: nadie nuevo entra y los que escuchan salen.</summary>
        [Column("paused")] public bool Paused { get; set; }

        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
