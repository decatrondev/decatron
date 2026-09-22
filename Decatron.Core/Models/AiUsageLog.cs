using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Una llamada a un LLM, de cualquier módulo. Es la única fuente de "cuánto gasta el bot en IA".
    /// Plan: .dev/plans/AI_OPENROUTER_UNIFICACION_PLAN.md
    /// </summary>
    [Table("ai_usage_logs")]
    public class AiUsageLog
    {
        [Key]
        public long Id { get; set; }

        /// <summary>twitch-chat, web-chat, translation, lol-coach…</summary>
        [Required, MaxLength(40)]
        public string Module { get; set; } = string.Empty;

        /// <summary>openrouter, gemini</summary>
        [Required, MaxLength(20)]
        public string Provider { get; set; } = string.Empty;

        /// <summary>Id exacto del modelo tal como se pidió (ej. qwen/qwen3.8-flash).</summary>
        [Required, MaxLength(120)]
        public string Model { get; set; } = string.Empty;

        /// <summary>Streamer al que se le atribuye el gasto (0 si no aplica).</summary>
        public long UserId { get; set; }

        [MaxLength(100)]
        public string? ChannelName { get; set; }

        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }

        /// <summary>Costo estimado con la tabla de precios vigente al momento de la llamada.</summary>
        [Column(TypeName = "numeric(12,6)")]
        public decimal EstimatedCostUsd { get; set; }

        public int ResponseTimeMs { get; set; }
        public bool Success { get; set; } = true;

        [MaxLength(300)]
        public string? ErrorMessage { get; set; }

        public DateTime UsedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Créditos descontados al canal por esta llamada (null = anterior al cobro por créditos o sin canal).</summary>
        public long? CreditsCharged { get; set; }
    }

    /// <summary>A quién y a qué módulo se le atribuye una llamada de IA.</summary>
    public sealed record AiCallContext(string Module, long UserId = 0, string? ChannelName = null)
    {
        public static readonly AiCallContext Unknown = new("unknown");
    }
}
