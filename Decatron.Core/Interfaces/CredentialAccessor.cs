using Microsoft.Extensions.Configuration;

namespace Decatron.Core.Interfaces;

/// <summary>
/// Acceso estático al <see cref="ICredentialProvider"/> para código que no entra por DI (helpers estáticos y clases creadas con <c>new</c>).
/// Se fija una vez al arrancar. Sin proveedor (solo pruebas) lee de la configuración como antes.
/// </summary>
public static class CredentialAccessor
{
    private static ICredentialProvider? _provider;

    public static void Set(ICredentialProvider provider) => _provider = provider;

    /// <summary>ClientId de la app de Twitch del tenant ambiente. Otro tenant sin credenciales lanza <see cref="CredentialsNotConfiguredException"/>.</summary>
    public static string TwitchClientId(IConfiguration? fallback = null)
        => _provider?.GetTwitchApp().ClientId ?? fallback?["TwitchSettings:ClientId"] ?? "";
}
