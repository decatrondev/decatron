namespace Decatron.Core.Interfaces;

/// <summary>Proveedores de terceros con llave propia del tenant (Fase 5.8). La llave vive cifrada en <c>tenant_credentials</c>.</summary>
public static class ByoProviders
{
    /// <summary>IA con API compatible con OpenAI (OpenRouter, OpenAI, Groq, Gemini en modo compatible…). También sirve a la traducción de texto.</summary>
    public const string Ai = "ai";
    /// <summary>Deepgram: voz a texto y voz (Aura).</summary>
    public const string Deepgram = "deepgram";
    /// <summary>Fish Audio: voz con personajes (voces clonadas).</summary>
    public const string FishAudio = "fishaudio";

    public static readonly IReadOnlyList<string> All = new[] { Ai, Deepgram, FishAudio };

    /// <summary>Capacidades del plan que habilitan el proveedor (basta una).</summary>
    public static IReadOnlyList<string> Capabilities(string provider) => provider switch
    {
        Ai => new[] { "byo.ai", "byo.translate" },
        Deepgram => new[] { "byo.stt", "byo.tts" },
        FishAudio => new[] { "byo.tts" },
        _ => Array.Empty<string>(),
    };

    /// <summary>Datos no secretos que admite cada proveedor (van en <c>tenant_provider_config</c>).</summary>
    public static IReadOnlyList<string> ConfigKeys(string provider) => provider switch
    {
        Ai => new[] { "base_url", "model", "fallback_model" },
        FishAudio => new[] { "model", "voices" }, // voices = JSON [{"name":"Toji","referenceId":"…"}]
        _ => Array.Empty<string>(),
    };

    public static bool IsKnown(string provider) => All.Contains(provider);
}

/// <summary>Llave en claro y su configuración. Solo para llamar al proveedor; nunca se registra ni se devuelve a la web.</summary>
public sealed record ByoKey(string ApiKey, IReadOnlyDictionary<string, string> Config);

/// <summary>Estado visible de una llave: últimos caracteres y configuración. Sin secreto.</summary>
public sealed record ByoKeySummary(string Provider, string Hint, IReadOnlyDictionary<string, string> Config, string Status, DateTimeOffset UpdatedAt);

/// <summary>Almacén de llaves propias de los tenants. Cada operación corre con el tenant indicado fijado (RLS).</summary>
public interface ITenantByoStore
{
    Task SaveAsync(long tenantId, string provider, string apiKey, IReadOnlyDictionary<string, string> config, string actor, CancellationToken ct = default);
    Task<ByoKeySummary?> GetSummaryAsync(long tenantId, string provider, CancellationToken ct = default);
    /// <summary>Llave en claro (queda en credential_access_log). Null si no hay.</summary>
    Task<ByoKey?> GetAsync(long tenantId, string provider, string purpose, CancellationToken ct = default);
    Task<bool> DeleteAsync(long tenantId, string provider, string actor, CancellationToken ct = default);
}

public enum ByoCheck { Ok, Rejected, Unreachable, BadConfig }

/// <summary>Prueba una llave con una llamada mínima real al proveedor antes de guardarla.</summary>
public interface IByoKeyValidator
{
    Task<ByoCheck> ValidateAsync(string provider, string apiKey, IReadOnlyDictionary<string, string> config, CancellationToken ct = default);
}

/// <summary>
/// Plataforma, Fase 5.8: ÚNICA puerta a las llaves de IA, voz y traducción. El tenant #1 sigue leyendo <c>appsettings</c> (sin cambios);
/// cualquier otro usa SU llave y, si no la tiene o el plan no la admite, recibe <c>null</c> y la función se apaga. Nunca cae a la llave del #1.
/// </summary>
public interface IByoKeys
{
    /// <summary>Llave del tenant (o ambiente si es null), o null si la función debe quedar apagada.</summary>
    Task<ByoKey?> GetAsync(string provider, long? tenantId = null, CancellationToken ct = default);
    void Invalidate(long tenantId);
}
