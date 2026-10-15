namespace Decatron.Core.Interfaces;

/// <summary>Credenciales de la app de Twitch con la que opera un tenant (no incluye la cuenta de bot).</summary>
public sealed record TwitchAppCredentials(
    string ClientId, string? ClientSecret, string? RedirectUri, string? WebhookSecret, string? WebhookCallbackUrl, string? Scopes = null);

/// <summary>Un tenant sin credenciales configuradas. Nunca se cae a las del tenant #1: sería actuar con la cuenta de Decatron.</summary>
public sealed class CredentialsNotConfiguredException : InvalidOperationException
{
    public long TenantId { get; }
    public CredentialsNotConfiguredException(long tenantId, string what)
        : base($"El tenant {tenantId} no tiene configurado: {what}.") => TenantId = tenantId;
}

/// <summary>
/// Plataforma, Fase 4 (paso 3): única puerta de entrada a las credenciales de plataforma. El tenant sale de <see cref="TenantAmbient"/>
/// (1 si no hay, igual que el resto del sistema). Hoy solo el tenant #1 (modo <c>legacy</c>: appsettings, como siempre); los demás
/// fallan cerrado hasta que exista el proveedor del almacén (paso 4).
/// </summary>
public interface ICredentialProvider
{
    TwitchAppCredentials GetTwitchApp();
    string? GetTwitchBotUsername();
}
