namespace Decatron.Core.Interfaces;

/// <summary>La cuenta de Twitch con la que escribe el bot de un tenant (token ya listo para usar, sin el prefijo oauth:).</summary>
public sealed record BotAccount(string Username, string TwitchId, string AccessToken);

/// <summary>
/// Plataforma, Fase 4 (paso 6a): cuenta de bot del tenant ambiente. El #1 lee bot_tokens como siempre; otro tenant solo usa SU cuenta de
/// bot (paso 6a.2) y, mientras no la tenga cargada, devuelve null: nunca se escribe con la cuenta del #1 en el chat de otro tenant.
/// </summary>
public interface IBotAccountProvider
{
    Task<BotAccount?> GetAsync(CancellationToken ct = default);
}
