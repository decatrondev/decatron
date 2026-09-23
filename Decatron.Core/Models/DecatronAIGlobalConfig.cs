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
        public string AIProvider { get; set; } = "openrouter";

        // Habilitar fallback al otro provider si el principal falla
        [Column("fallback_enabled")]
        public bool FallbackEnabled { get; set; } = false;

        // Modelo de Gemini
        [Column("model")]
        [Required]
        [MaxLength(100)]
        public string Model { get; set; } = "gemini-3.5-flash-lite";

        // Modelo de OpenRouter
        [Column("openrouter_model")]
        [MaxLength(100)]
        public string OpenRouterModel { get; set; } = "qwen/qwen3.8-flash";

        // Modelo (OpenRouter) para la traducción en vivo. Se cambia desde /admin/ai-costs sin redeploy.
        [MaxLength(120)]
        [Column("translation_model")]
        public string TranslationModel { get; set; } = "qwen/qwen3.8-flash";

        // Modelo (OpenRouter) para el Coach de LoL.
        [MaxLength(120)]
        [Column("coach_model")]
        public string CoachModel { get; set; } = "openai/gpt-6-luna";

        // Modelos de respaldo de OpenRouter, en orden, separados por coma. Van en el parámetro
        // `models` de cada llamada: si el principal da 429, se cae o rechaza, OpenRouter pasa
        // solo al siguiente en la misma petición. Aplica a chat, traducción y coach.
        [MaxLength(400)]
        [Column("fallback_models")]
        public string FallbackModels { get; set; } = "openai/gpt-6-luna,deepseek/deepseek-v4.1-flash,qwen/qwen3.8-flash";

        // Tabla de precios por modelo en USD por 1M tokens: { "modelo": { "in": 0.15, "out": 0.47 } }.
        // Se usa para estimar el costo de cada llamada en ai_usage_logs.
        [Column("model_prices_json")]
        public string ModelPricesJson { get; set; } = DefaultModelPricesJson;

        public const string DefaultModelPricesJson =
            "{\"qwen/qwen3.8-flash\":{\"in\":0.15,\"out\":0.47}," +
            "\"deepseek/deepseek-v4.1-flash\":{\"in\":0.06,\"out\":0.32}," +
            "\"openai/gpt-6-luna\":{\"in\":0.10,\"out\":0.50}," +
            "\"gemini-3.5-flash-lite\":{\"in\":0.30,\"out\":2.50}," +
            "\"gemini-2.5-flash-lite\":{\"in\":0.10,\"out\":0.40}}";

        [Column("max_tokens")]
        public int MaxTokens { get; set; } = 60;

        [Column("system_prompt")]
        [Required]
        public string SystemPrompt { get; set; } = "Eres Decatron IA, un asistente de chat en vivo. REGLAS ESTRICTAS: 1) Responde SOLO en 1-2 oraciones cortas. 2) NUNCA generes código, HTML, CSS, JavaScript, scripts ni fragmentos técnicos. 3) Si piden código o crear webs, rechaza amablemente diciendo que solo puedes chatear. 4) Mantén conversaciones casuales, responde preguntas simples, cuenta chistes o datos curiosos. 5) Sé amigable y breve, esto es un chat en vivo.";

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
