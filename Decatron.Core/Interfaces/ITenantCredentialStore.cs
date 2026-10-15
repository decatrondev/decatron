namespace Decatron.Core.Interfaces;

/// <summary>Lo que el dueño carga de la app de Twitch de un tenant. El secreto de webhook lo genera el sistema si no se da.</summary>
public sealed record TwitchAppInput(string ClientId, string ClientSecret, string? RedirectUri, string? Scopes);

/// <summary>Cuenta de Twitch con la que escribe el bot de un tenant, autorizada por OAuth (el dueño del bot).</summary>
public sealed record TwitchBotInput(string Username, string TwitchId, string AccessToken, string? RefreshToken, DateTimeOffset? ExpiresAt);

/// <summary>Estado visible del bot de un tenant. Sin tokens.</summary>
public sealed record TwitchBotSummary(string Username, string TwitchId, DateTimeOffset? LinkedAt);

/// <summary>Estado visible de la app de un tenant. Nunca incluye secretos: solo si existen y sus últimos caracteres.</summary>
public sealed record TwitchAppSummary(
    string ClientId, string? RedirectUri, string? Scopes, string? SecretHint, string Status, DateTimeOffset? LastValidatedAt);

/// <summary>
/// Plataforma, Fase 4 (paso 4): almacén de credenciales de los tenants (tablas tenant_*, secretos en ENC2).
/// Cada operación corre con el tenant indicado fijado en la conexión (RLS), nunca con el ambiente.
/// </summary>
public interface ITenantCredentialStore
{
    /// <summary>Id del tenant activo con ese slug, o null. El #1 se excluye (no se elige por slug).</summary>
    Task<long?> FindActiveTenantIdAsync(string slug, CancellationToken ct = default);
    /// <summary>La app lista para usar (estado <c>ok</c>) o null si el tenant no tiene ninguna.</summary>
    Task<TwitchAppCredentials?> GetTwitchAppAsync(long tenantId, CancellationToken ct = default);
    Task<TwitchAppSummary?> GetTwitchAppSummaryAsync(long tenantId, CancellationToken ct = default);
    /// <summary>Guarda (o reemplaza) la app ya validada. Cifra los secretos y deja constancia en credential_access_log.</summary>
    Task SaveTwitchAppAsync(long tenantId, TwitchAppInput input, string actor, CancellationToken ct = default);
    Task<bool> DeleteTwitchAppAsync(long tenantId, string actor, CancellationToken ct = default);

    /// <summary>Guarda la cuenta de bot del tenant (tokens cifrados) y deja constancia en credential_access_log.</summary>
    Task SaveTwitchBotAsync(long tenantId, TwitchBotInput input, string actor, CancellationToken ct = default);
    Task<TwitchBotSummary?> GetTwitchBotAsync(long tenantId, CancellationToken ct = default);
    Task<bool> DeleteTwitchBotAsync(long tenantId, string actor, CancellationToken ct = default);
}

public enum AppValidationResult { Ok, InvalidCredentials, Unreachable }

/// <summary>Comprueba una app de Twitch contra Twitch antes de guardarla (client_credentials).</summary>
public interface ITwitchAppValidator
{
    Task<AppValidationResult> ValidateAsync(string clientId, string clientSecret, CancellationToken ct = default);
}
