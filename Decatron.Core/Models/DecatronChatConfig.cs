using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("decatron_chat_config")]
    public class DecatronChatConfig
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("enabled")]
        public bool Enabled { get; set; } = false;

        // Provider: "gemini", "openrouter"
        [Column("ai_provider")]
        [Required]
        [MaxLength(50)]
        public string AIProvider { get; set; } = "gemini";

        // Habilitar fallback
        [Column("fallback_enabled")]
        public bool FallbackEnabled { get; set; } = false;

        // Modelo de Gemini
        [Column("model")]
        [Required]
        [MaxLength(100)]
        public string Model { get; set; } = "gemini-2.0-flash-exp";

        // Modelo de OpenRouter
        [Column("openrouter_model")]
        [MaxLength(100)]
        public string OpenRouterModel { get; set; } = "x-ai/grok-4.1-fast:free";

        // Límite más alto para código
        [Column("max_tokens")]
        public int MaxTokens { get; set; } = 2000;

        [Column("system_prompt")]
        [Required]
        public string SystemPrompt { get; set; } = "Eres Decatron IA, un asistente de programación avanzado creado por AnthonyDeca. Puedes generar código en cualquier lenguaje, explicar conceptos técnicos, depurar errores, ayudar con arquitectura de software, y mantener conversaciones técnicas extensas. Usa bloques de código markdown con ```lenguaje cuando generes código. Sé claro, preciso y profesional.";

        // Límites de conversaciones
        [Column("max_conversations_per_user")]
        public int MaxConversationsPerUser { get; set; } = 50;

        [Column("max_messages_per_conversation")]
        public int MaxMessagesPerConversation { get; set; } = 100;

        // Contexto: cuántos mensajes previos enviar a la IA
        [Column("context_messages")]
        public int ContextMessages { get; set; } = 10;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
