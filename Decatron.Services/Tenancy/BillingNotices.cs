using System.Globalization;
using System.Net;

namespace Decatron.Services.Tenancy;

/// <summary>Plataforma, Fase 7.4: textos (es/en) de los recordatorios de vencimiento. Llevan al panel; el pago vive ahí (Fase 7.5+).</summary>
public static class BillingNotices
{
    public const string D7 = "d7", D3 = "d3", D1 = "d1", Grace = "grace", AutoFailed = "autofail", AutoOff = "autooff";
    private static readonly TimeZoneInfo Lima = ResolveLima();

    private static TimeZoneInfo ResolveLima()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Lima"); }
        catch { return TimeZoneInfo.CreateCustomTimeZone("UTC-5", TimeSpan.FromHours(-5), "UTC-5", "UTC-5"); }
    }

    private static string Day(DateTime utc, bool en)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Lima)
            .ToString(en ? "MMMM d, yyyy" : "d 'de' MMMM 'de' yyyy", CultureInfo.GetCultureInfo(en ? "en-US" : "es-PE"));

    /// <summary>Umbral que corresponde a los días que faltan: 1, 3 o 7. null = todavía falta mucho.</summary>
    public static string? KindFor(TimeSpan remaining)
    {
        var days = remaining.TotalDays;
        if (days <= 0) return null;
        return days <= 1 ? D1 : days <= 3 ? D3 : days <= 7 ? D7 : null;
    }

    public static (string subject, string html) Build(string locale, string kind, string projectName, string planName, DateTime endsAt, DateTime? graceUntil, string panelUrl)
    {
        var en = locale == "en";
        var name = WebUtility.HtmlEncode(projectName);
        var plan = WebUtility.HtmlEncode(planName);
        var link = WebUtility.HtmlEncode(panelUrl);
        string Wrap(string h, string p, string label, string foot) =>
            $"<div style=\"font-family:Arial,sans-serif;max-width:480px;color:#12151c\"><h2 style=\"margin:0 0 12px\">{h}</h2><p>{p}</p>" +
            $"<p><a href=\"{link}\" style=\"display:inline-block;background:#2f5fc6;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold\">{label}</a></p>" +
            $"<p style=\"color:#5b6475;font-size:13px\">{foot}</p></div>";

        if (kind == Grace)
        {
            var until = Day(graceUntil ?? endsAt, en);
            return en
                ? ("Your plan for " + projectName + " has expired", Wrap("Your plan has expired",
                    $"The <b>{plan}</b> plan of <b>{name}</b> expired on {Day(endsAt, en)}. Everything keeps working until <b>{until}</b>; after that your bot is paused (nothing is deleted) and comes back as soon as you renew.",
                    "Open the panel", "You receive this notice because you own this project."))
                : ("Venció el plan de " + projectName, Wrap("Tu plan venció",
                    $"El plan <b>{plan}</b> de <b>{name}</b> venció el {Day(endsAt, en)}. Todo sigue funcionando hasta el <b>{until}</b>; después tu bot se pausa (no se borra nada) y vuelve apenas renueves.",
                    "Abrir el panel", "Recibes este aviso porque eres el dueño de este proyecto."));
        }
        var n = kind == D1 ? 1 : kind == D3 ? 3 : 7;
        var date = Day(endsAt, en);
        return en
            ? ("Your plan for " + projectName + (n == 1 ? " expires tomorrow" : $" expires in {n} days"), Wrap(n == 1 ? "Your plan expires tomorrow" : $"Your plan expires in {n} days",
                $"The <b>{plan}</b> plan of <b>{name}</b> expires on <b>{date}</b>. Renew it from your panel so your bot does not stop.",
                "Open the panel", "You receive this reminder because you own this project."))
            : ("Tu plan de " + projectName + (n == 1 ? " vence mañana" : $" vence en {n} días"), Wrap(n == 1 ? "Tu plan vence mañana" : $"Tu plan vence en {n} días",
                $"El plan <b>{plan}</b> de <b>{name}</b> vence el <b>{date}</b>. Renuévalo desde tu panel para que tu bot no se detenga.",
                "Abrir el panel", "Recibes este recordatorio porque eres el dueño de este proyecto."));
    }

    /// <summary>Avisos del cobro automático: un intento fallido (se reintenta) o el cobro desactivado tras el último intento.</summary>
    public static (string subject, string html) BuildAuto(string locale, string kind, string projectName, string planName, DateTime endsAt, DateTime next, int attempt, int max, string panelUrl)
    {
        var en = locale == "en";
        var name = WebUtility.HtmlEncode(projectName);
        var plan = WebUtility.HtmlEncode(planName);
        var link = WebUtility.HtmlEncode(panelUrl);
        string Wrap(string h, string p, string label, string foot) =>
            $"<div style=\"font-family:Arial,sans-serif;max-width:480px;color:#12151c\"><h2 style=\"margin:0 0 12px\">{h}</h2><p>{p}</p>" +
            $"<p><a href=\"{link}\" style=\"display:inline-block;background:#2f5fc6;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold\">{label}</a></p>" +
            $"<p style=\"color:#5b6475;font-size:13px\">{foot}</p></div>";

        if (kind == AutoOff)
            return en
                ? ("We turned off automatic billing for " + projectName, Wrap("Automatic billing is off",
                    $"We tried {max} times to charge your saved card to renew the <b>{plan}</b> plan of <b>{name}</b> and the bank declined it. We turned automatic billing off and removed the card. Your plan runs until <b>{Day(endsAt, en)}</b> (then a 5-day grace period); renew from your panel to keep your bot running.",
                    "Open the panel", "You receive this notice because you own this project."))
                : ("Desactivamos el cobro automático de " + projectName, Wrap("El cobro automático está desactivado",
                    $"Intentamos {max} veces cobrar tu tarjeta guardada para renovar el plan <b>{plan}</b> de <b>{name}</b> y el banco la rechazó. Desactivamos el cobro automático y borramos la tarjeta. Tu plan sigue hasta el <b>{Day(endsAt, en)}</b> (luego hay 5 días de gracia); renueva desde tu panel para que tu bot no se detenga.",
                    "Abrir el panel", "Recibes este aviso porque eres el dueño de este proyecto."));
        return en
            ? ("We could not renew your plan for " + projectName, Wrap("We could not renew your plan",
                $"We tried to charge your saved card to renew the <b>{plan}</b> plan of <b>{name}</b> and the bank declined it (attempt {attempt} of {max}). We will try again on <b>{Day(next, en)}</b>. You can also renew now or change your card from your panel.",
                "Open the panel", "You receive this notice because you own this project."))
            : ("No pudimos renovar tu plan de " + projectName, Wrap("No pudimos renovar tu plan",
                $"Intentamos cobrar tu tarjeta guardada para renovar el plan <b>{plan}</b> de <b>{name}</b> y el banco la rechazó (intento {attempt} de {max}). Volveremos a intentarlo el <b>{Day(next, en)}</b>. También puedes renovar ahora o cambiar de tarjeta desde tu panel.",
                "Abrir el panel", "Recibes este aviso porque eres el dueño de este proyecto."));
    }
}
