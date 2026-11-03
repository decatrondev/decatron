namespace Decatron.Core.Helpers;

/// <summary>Llamada a Event Alerts que corresponde a un evento de Kick.</summary>
/// <param name="Amount">follow: 0; subs/resubs: 0; giftSubs: cantidad de subs; bits: Kicks (se convierten a bits al disparar).</param>
public sealed record KickAlertCall(string EventType, string Username, int Amount, int? Months, string? SubTier, string? UserMessage);

/// <summary>
/// Qué alerta dispara cada evento de Kick (reglas puras). Kick no tiene niveles de sub: todo cuenta como nivel 1.
/// Raid e hype train no existen en Kick; el estado del directo no es una alerta.
/// </summary>
public static class KickAlertMapper
{
    public const string AnonymousName = "Anónimo";
    public const string Tier1 = "1000";

    public static KickAlertCall? Map(PlatformEvent e)
    {
        var name = e.IsAnonymous || string.IsNullOrWhiteSpace(e.UserName) ? AnonymousName : e.UserName!;
        switch (e.Type)
        {
            case PlatformEventType.Follow:
                // Un follow anónimo no tiene nombre que mostrar: no se avisa.
                return e.IsAnonymous ? null : new KickAlertCall("follow", name, 0, null, null, null);
            case PlatformEventType.Subscription:
                return new KickAlertCall("subs", name, 0, null, Tier1, null);
            case PlatformEventType.SubscriptionRenewal:
                return new KickAlertCall("resubs", name, 0, Math.Max(1, e.Months), Tier1, null);
            case PlatformEventType.GiftedSubs:
                return e.Amount <= 0 ? null : new KickAlertCall("giftSubs", name, e.Amount, null, Tier1, null);
            case PlatformEventType.Kicks:
                return e.Amount <= 0 ? null : new KickAlertCall("bits", name, e.Amount, null, null, e.Message);
            default:
                return null;
        }
    }

    /// <summary>Bits que vale una cantidad de Kicks, con el valor de un Kick que fijó el streamer (por defecto 1). Mínimo 1.</summary>
    public static int KicksToBits(int kicks, double bitsPerKick)
    {
        if (kicks <= 0) return 0;
        if (double.IsNaN(bitsPerKick) || double.IsInfinity(bitsPerKick)) bitsPerKick = 1;
        bitsPerKick = Math.Clamp(bitsPerKick, 0.01, 1000);
        var bits = (long)Math.Round(kicks * bitsPerKick, MidpointRounding.AwayFromZero);
        return (int)Math.Clamp(Math.Max(1, bits), 1, int.MaxValue);
    }
}
