using System.Text.Json;

namespace Decatron.Core.Helpers;

public enum PlatformEventType
{
    Follow,
    Subscription,
    SubscriptionRenewal,
    GiftedSubs,
    Kicks,
    StreamStatus
}

/// <summary>
/// Evento de plataforma en formato común. Hoy lo produce Kick; Twitch y las demás plataformas
/// podrán usar el mismo formato más adelante. Los consumidores (alertas, timer...) no deben
/// depender de la forma de cada plataforma.
/// </summary>
/// <param name="Id">Id único del aviso (en Kick, el de la entrega). Sirve para descartar repetidos.</param>
/// <param name="BroadcasterId">Id del canal que recibe el evento (en Kick, <c>broadcaster.user_id</c>).</param>
/// <param name="Amount">Subs: 1; subs regaladas: cantidad de receptores; Kicks: cantidad de Kicks; resto: 0.</param>
/// <param name="Months">Duración en meses de la sub (nueva o renovada). 0 si no aplica.</param>
public sealed record PlatformEvent(
    string Id,
    string Platform,
    PlatformEventType Type,
    string BroadcasterId,
    string? UserId,
    string? UserName,
    bool IsAnonymous,
    int Amount,
    int Months,
    string? Message,
    bool? IsLive,
    string? Title,
    DateTime? OccurredAtUtc);

/// <summary>
/// Traduce los payloads de webhook de Kick a <see cref="PlatformEvent"/>. Reglas puras: sin red,
/// sin base de datos. Kick manda los ids como número JSON y no siempre como texto, por eso todo
/// se lee con <see cref="Str"/>.
/// </summary>
public static class KickEventTranslator
{
    public const string Platform = "kick";

    public const string EventFollowed = "channel.followed";
    public const string EventSubNew = "channel.subscription.new";
    public const string EventSubRenewal = "channel.subscription.renewal";
    public const string EventSubGifts = "channel.subscription.gifts";
    public const string EventKicksGifted = "kicks.gifted";
    public const string EventLivestreamStatus = "livestream.status.updated";

    /// <summary>Eventos que el bot pide a Kick además del chat y los canjes (esos ya existían).</summary>
    public static readonly string[] AlertEvents =
    {
        EventFollowed, EventSubNew, EventSubRenewal, EventSubGifts, EventKicksGifted, EventLivestreamStatus
    };

    public static bool IsAlertEvent(string? eventType) =>
        eventType != null && Array.IndexOf(AlertEvents, eventType) >= 0;

    /// <summary>
    /// Devuelve el evento común, o null si el tipo no es de los que se traducen o el payload no
    /// trae lo mínimo (canal). Nunca lanza.
    /// </summary>
    /// <param name="messageId">Cabecera <c>Kick-Event-Message-Id</c>; si falta se arma un id estable con el contenido.</param>
    public static PlatformEvent? Translate(string? eventType, JsonElement payload, string? messageId)
    {
        try
        {
            if (!IsAlertEvent(eventType) || payload.ValueKind != JsonValueKind.Object) return null;

            var broadcasterId = Str(Obj(payload, "broadcaster"), "user_id");
            if (string.IsNullOrEmpty(broadcasterId)) return null;

            var id = string.IsNullOrWhiteSpace(messageId)
                ? $"{eventType}:{broadcasterId}:{payload.GetRawText().GetHashCode():x}"
                : messageId!;

            switch (eventType)
            {
                case EventFollowed:
                {
                    var (uid, name, anon) = User(Obj(payload, "follower"));
                    return Make(id, PlatformEventType.Follow, broadcasterId, uid, name, anon, 0, 0, null, null, null,
                        Date(payload, "created_at"));
                }
                case EventSubNew:
                case EventSubRenewal:
                {
                    var (uid, name, anon) = User(Obj(payload, "subscriber"));
                    var type = eventType == EventSubNew ? PlatformEventType.Subscription : PlatformEventType.SubscriptionRenewal;
                    return Make(id, type, broadcasterId, uid, name, anon, 1, Int(payload, "duration"), null, null, null,
                        Date(payload, "created_at"));
                }
                case EventSubGifts:
                {
                    var (uid, name, anon) = User(Obj(payload, "gifter"));
                    var giftees = payload.TryGetProperty("giftees", out var g) && g.ValueKind == JsonValueKind.Array
                        ? g.GetArrayLength() : 0;
                    return Make(id, PlatformEventType.GiftedSubs, broadcasterId, uid, name, anon, giftees, 0, null, null, null,
                        Date(payload, "created_at"));
                }
                case EventKicksGifted:
                {
                    var (uid, name, anon) = User(Obj(payload, "sender"));
                    var gift = Obj(payload, "gift");
                    var amount = Int(gift, "amount");
                    if (amount <= 0) return null;
                    var msg = Str(gift, "message");
                    return Make(id, PlatformEventType.Kicks, broadcasterId, uid, name, anon, amount, 0,
                        string.IsNullOrWhiteSpace(msg) ? null : msg, null, null, Date(payload, "created_at"));
                }
                case EventLivestreamStatus:
                {
                    if (!payload.TryGetProperty("is_live", out var live) ||
                        (live.ValueKind != JsonValueKind.True && live.ValueKind != JsonValueKind.False))
                        return null;
                    var isLive = live.GetBoolean();
                    return Make(id, PlatformEventType.StreamStatus, broadcasterId, null, null, false, 0, 0, null, isLive,
                        Str(payload, "title"), Date(payload, isLive ? "started_at" : "ended_at"));
                }
            }
        }
        catch
        {
            // Un payload raro nunca debe romper el webhook.
        }
        return null;
    }

    private static PlatformEvent Make(string id, PlatformEventType type, string broadcasterId, string? userId, string? userName,
        bool anonymous, int amount, int months, string? message, bool? isLive, string? title, DateTime? at) =>
        new(id, Platform, type, broadcasterId, userId, userName, anonymous, amount, months, message, isLive, title, at);

    /// <summary>
    /// Usuario de un evento. Es anónimo si Kick lo marca (<c>is_anonymous</c>) o si no trae ni id ni nombre
    /// (en las subs regaladas anónimas esos campos vienen en null).
    /// </summary>
    private static (string? Id, string? Name, bool Anonymous) User(JsonElement user)
    {
        if (user.ValueKind != JsonValueKind.Object) return (null, null, true);
        var id = Str(user, "user_id");
        var name = Str(user, "username");
        var flagged = user.TryGetProperty("is_anonymous", out var a) && a.ValueKind == JsonValueKind.True;
        var anonymous = flagged || (string.IsNullOrEmpty(id) && string.IsNullOrEmpty(name));
        return (anonymous ? null : id, anonymous ? null : name, anonymous);
    }

    private static JsonElement Obj(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) ? v : default;

    /// <summary>Lee texto o número como texto (Kick manda ids como número). Null si falta o es null.</summary>
    private static string? Str(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            _ => v.ToString()
        };
    }

    private static int Int(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return 0;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n)) return n;
        if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var s)) return s;
        return 0;
    }

    private static DateTime? Date(JsonElement e, string name)
    {
        var s = Str(e, name);
        return s != null && DateTimeOffset.TryParse(s, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AssumeUniversal, out var d) ? d.UtcDateTime : null;
    }
}
