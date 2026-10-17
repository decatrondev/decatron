using Microsoft.Extensions.Configuration;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Quién puede registrarse como comprador. <c>Platform:SignupMode</c>: «open» (cualquiera con Turnstile) o «approval» (solo correos aprobados por el dueño).
/// Cualquier otro valor, o ninguno, es «approval»: ante la duda el registro se cierra, no se abre. El ajuste se recarga en caliente.
/// </summary>
public static class SignupGate
{
    public const string ConfigKey = "Platform:SignupMode";

    public static bool RequiresApproval(IConfiguration config)
        => !string.Equals(config[ConfigKey]?.Trim(), "open", StringComparison.OrdinalIgnoreCase);

    public static string Mode(IConfiguration config) => RequiresApproval(config) ? "approval" : "open";
}
