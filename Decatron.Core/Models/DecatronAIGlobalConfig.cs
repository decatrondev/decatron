using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("decatron_ai_global_config")]
    public class DecatronAIGlobalConfig
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("enabled")]
        public bool Enabled { get; set; } = false;

        // Provider principal: "gemini", "openrouter"
        [Column("ai_provider")]
        [MaxLength(50)]
        public string AIProvider { get; set; } = "gemini";

        // Habilitar fallback al otro provider si el principal falla
        [Column("fallback_enabled")]
        public bool FallbackEnabled { get; set; } = false;

        // Modelo de Gemini
        [Column("model")]
        [Required]
        [MaxLength(100)]
        public string Model { get; set; } = "gemini-2.0-flash-lite";

        // Modelo de OpenRouter
        [Column("openrouter_model")]
        [MaxLength(100)]
        public string OpenRouterModel { get; set; } = "x-ai/grok-4.1-fast:free";

        [Column("max_tokens")]
        public int MaxTokens { get; set; } = 60;

        [Column("system_prompt")]
        [Required]
        public string SystemPrompt { get; set; } = "Eres Decatron IA, un asistente de chat para Twitch creado por AnthonyDeca. REGLAS ESTRICTAS: 1) Responde SOLO en 1-2 oraciones cortas. 2) NUNCA generes código, HTML, CSS, JavaScript, scripts ni fragmentos técnicos. 3) Si piden código o crear webs, rechaza amablemente diciendo que solo puedes chatear. 4) Mantén conversaciones casuales, responde preguntas simples, cuenta chistes o datos curiosos. 5) Sé amigable y breve, esto es un chat de Twitch.";

        [Column("response_prefix")]
        [Required]
        [MaxLength(100)]
        public string ResponsePrefix { get; set; } = "🤖 Decatron IA:";

        [Column("global_cooldown_seconds")]
        public int GlobalCooldownSeconds { get; set; } = 30;

        [Column("min_channel_cooldown_seconds")]
        public int MinChannelCooldownSeconds { get; set; } = 120;

        [Column("default_channel_cooldown_seconds")]
        public int DefaultChannelCooldownSeconds { get; set; } = 300;

        [Column("max_prompt_length")]
        public int MaxPromptLength { get; set; } = 200;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
