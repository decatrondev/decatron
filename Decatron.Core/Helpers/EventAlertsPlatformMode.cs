using System.Text.Json;

namespace Decatron.Core.Helpers;

/// <summary>Cómo se configuran las alertas de una cuenta con Twitch y Kick vinculados.</summary>
public enum EventAlertsMode
{
    /// <summary>Una configuración completa por plataforma (la de Kick vive en la fila del canal de Kick).</summary>
    Separate,
    /// <summary>Una sola configuración, la de la fila principal, para las dos plataformas.</summary>
    Unified
}

/// <summary>
/// Reglas puras del modo de configuración de Event Alerts. El modo se guarda en la configuración de la fila principal
/// (<c>global.platformMode</c> = "unified" | "separate"); sin ese valor (o con uno desconocido) es «separate».
/// </summary>
public static class EventAlertsPlatformMode
{
    public const string Key = "platformMode";
    public const string UnifiedValue = "unified";
    public const string SeparateValue = "separate";

    /// <summary>Modo guardado en la configuración de la fila principal. Cualquier dato ausente o inválido da «Separada».</summary>
    public static EventAlertsMode Parse(string? principalConfigJson)
    {
        if (string.IsNullOrWhiteSpace(principalConfigJson)) return EventAlertsMode.Separate;
        try
        {
            using var doc = JsonDocument.Parse(principalConfigJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                doc.RootElement.TryGetProperty("global", out var g) && g.ValueKind == JsonValueKind.Object &&
                g.TryGetProperty(Key, out var m) && m.ValueKind == JsonValueKind.String &&
                string.Equals(m.GetString(), UnifiedValue, StringComparison.OrdinalIgnoreCase))
                return EventAlertsMode.Unified;
        }
        catch (JsonException) { }
        return EventAlertsMode.Separate;
    }

    /// <summary>
    /// Canal cuya configuración se prefiere para un evento. Solo los eventos de Kick en modo «Separada» usan la configuración de
    /// la fila de Kick; el resto (Twitch, o Kick en «Unificada») usa la del canal principal (devuelve null). Si el canal de Kick
    /// es el mismo que el principal (cuenta solo de Kick) tampoco hay nada que elegir.
    /// </summary>
    public static string? PreferredConfigChannel(EventAlertsMode mode, string platform, string? kickRowLogin, string principalChannel)
    {
        if (mode != EventAlertsMode.Separate || platform != "kick") return null;
        if (string.IsNullOrWhiteSpace(kickRowLogin)) return null;
        if (string.Equals(kickRowLogin, principalChannel, StringComparison.OrdinalIgnoreCase)) return null;
        return kickRowLogin;
    }

    /// <summary>
    /// ¿Los Kicks se convierten en bits? Sí cuando se usa la configuración compartida (modo «Unificada», o «Separada» si Kick todavía
    /// no tiene la suya y se usa la principal): sus niveles de bits están en bits. No cuando se usa la propia de Kick: ahí los
    /// niveles ya están en Kicks.
    /// </summary>
    public static bool ConvertKicksToBits(string platform, bool usingOwnKickConfig) => platform == "kick" && !usingOwnKickConfig;

    /// <summary>Fila a la que se cobran los créditos de voz: siempre la principal de la cuenta; si no se conoce, la dueña de la configuración.</summary>
    public static long CreditUserId(long? principalUserId, long configUserId) => principalUserId ?? configUserId;
}
