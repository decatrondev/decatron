using System.Threading.Tasks;
using Decatron.Core.Models;

namespace Decatron.Core.Services.Moderation
{
    /// <summary>
    /// Mensaje de chat tal como lo ve la moderación
    /// </summary>
    public class ModerationMessage
    {
        public string Channel { get; set; } = "";
        public string Username { get; set; } = "";
        /// <summary>Id de Twitch de quien escribe (para la edad de la cuenta)</summary>
        public string? ChatterUserId { get; set; }
        public string Text { get; set; } = "";
        /// <summary>El texto sin los emotes de Twitch (si se conocen); si no, igual a Text</summary>
        public string? TextWithoutEmotes { get; set; }
        /// <summary>Cantidad de emotes de Twitch del mensaje (los de 7TV/BTTV/FFZ no se conocen)</summary>
        public int EmoteCount { get; set; }
        public string? MessageId { get; set; }
        public bool IsBroadcaster { get; set; }
        public bool IsLeadModerator { get; set; }
        public bool IsModerator { get; set; }
        public bool IsVip { get; set; }
        public bool IsSubscriber { get; set; }
    }

    /// <summary>
    /// Lo que detectó un filtro
    /// </summary>
    public class FilterHit
    {
        public string FilterKey { get; set; } = "";
        /// <summary>leve | medio | severo</summary>
        public string Severity { get; set; } = "leve";
        /// <summary>Qué se detectó (la palabra, el dominio...). Va a $(word) y al log.</summary>
        public string Detail { get; set; } = "";
        /// <summary>Motivo que se manda a Twitch en el timeout/ban</summary>
        public string Reason { get; set; } = "";
        /// <summary>Id propio del filtro (ej. la palabra prohibida), para OnSanctionedAsync</summary>
        public long? RefId { get; set; }
        /// <summary>Acción mínima de este filtro: un link no puede quedar en el chat con una simple advertencia</summary>
        public string MinimumAction { get; set; } = "warning";
        /// <summary>Mensaje del chat si el streamer no puso uno propio; null = los mensajes por acción</summary>
        public string? DefaultMessage { get; set; }
    }

    /// <summary>
    /// Resultado de moderar un mensaje: qué filtro saltó y qué hacer
    /// </summary>
    public class ModerationVerdict
    {
        public FilterHit Hit { get; set; } = new();
        /// <summary>warning | delete | timeout_* | ban</summary>
        public string Action { get; set; } = "warning";
        public int StrikeLevel { get; set; }
        /// <summary>Mensaje propio del filtro; null = los mensajes por acción de ModerationConfig</summary>
        public string? FilterMessage { get; set; }
        public ModerationConfig Config { get; set; } = new();

        /// <summary>El mensaje sale del chat (el comando que traía no se ejecuta)</summary>
        public bool RemovesMessage => Action != "warning";
    }

    /// <summary>
    /// Un filtro de la cadena de moderación. La inmunidad, los strikes y la acción los
    /// resuelve ModerationService: el filtro solo dice si el mensaje lo viola.
    /// </summary>
    public interface IModerationFilter
    {
        /// <summary>Clave en moderation_filters.filter_key</summary>
        string Key { get; }

        Task<FilterHit?> CheckAsync(ModerationMessage message, ModerationFilter config);

        /// <summary>Se llama cuando el hit de este filtro terminó en sanción</summary>
        Task OnSanctionedAsync(FilterHit hit) => Task.CompletedTask;
    }
}
