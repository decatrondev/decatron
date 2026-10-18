using System.Net;

namespace Decatron.Services.Tenancy;

/// <summary>Avisos de seguridad al dueño por correo (2FA desactivado, codigo de recuperacion usado). Sin enlaces de entrada: solo informan y llevan al panel.</summary>
public static class BuyerNotices
{
    public const string MfaOff = "mfa_off", MfaRecovery = "mfa_recovery";

    public static (string subject, string html) Build(string locale, string kind, string projectName, string panelUrl)
    {
        var en = locale == "en";
        var name = WebUtility.HtmlEncode(projectName);
        var link = WebUtility.HtmlEncode(panelUrl);
        string Wrap(string h, string p, string label, string foot) =>
            $"<div style=\"font-family:Arial,sans-serif;max-width:480px;color:#12151c\"><h2 style=\"margin:0 0 12px\">{h}</h2><p>{p}</p>" +
            $"<p><a href=\"{link}\" style=\"display:inline-block;background:#2f5fc6;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold\">{label}</a></p>" +
            $"<p style=\"color:#5b6475;font-size:13px\">{foot}</p></div>";

        if (kind == MfaOff)
            return en
                ? ("Two-step verification was turned off on " + projectName, Wrap("Two-step verification turned off",
                    $"Two-step verification was turned off for the owner of <b>{name}</b>. The panel stays locked until it is turned on again.",
                    "Open the panel", "If this was not you, someone has access to your account: sign in, turn it on again and generate new recovery codes."))
                : ("Se desactivó la verificación en dos pasos de " + projectName, Wrap("Verificación en dos pasos desactivada",
                    $"Se desactivó la verificación en dos pasos del dueño de <b>{name}</b>. El panel queda bloqueado hasta que se active de nuevo.",
                    "Abrir el panel", "Si no fuiste tú, alguien tiene acceso a tu cuenta: entra, vuelve a activarla y genera códigos de recuperación nuevos."));
        return en
            ? ("A recovery code was used on " + projectName, Wrap("Recovery code used",
                $"A two-step recovery code was used for the owner of <b>{name}</b>. Each code works once.",
                "Open the panel", "If this was not you, sign in and generate new recovery codes right away."))
            : ("Se usó un código de recuperación en " + projectName, Wrap("Código de recuperación usado",
                $"Se usó un código de recuperación de dos pasos del dueño de <b>{name}</b>. Cada código sirve una sola vez.",
                "Abrir el panel", "Si no fuiste tú, entra y genera códigos de recuperación nuevos de inmediato."));
    }
}
