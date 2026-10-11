using System.Security.Cryptography;
using System.Text;

namespace Decatron.Services.DiscordServer;

public static class PlanOp
{
    public const string Create = "create";       // se creará
    public const string Adopt = "adopt";         // ya existe con ese nombre: solo se enlaza, no se toca
    public const string Convert = "convert";     // cambia el tipo de un canal (texto → anuncios)
    public const string Update = "update";       // ajusta un ajuste del servidor
    public const string Skip = "skip";           // ya está como debe
    public const string Blocked = "blocked";     // no se puede ahora (falta un permiso o activar Comunidad)
    public const string Warn = "warn";           // aviso
    public const string Manual = "manual";       // paso manual
    public static bool IsAction(string op) => op is Create or Adopt or Convert or Update;
}

public class PlanItem
{
    public int Seq { get; set; }
    public string Phase { get; set; } = "";
    public string Kind { get; set; } = "";        // bot | guild | role | category | channel | message | automod | manual
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string Op { get; set; } = PlanOp.Skip;
    /// <summary>Texto corto (español) para registros y pruebas.</summary>
    public string Detail { get; set; } = "";
    /// <summary>Código estable del motivo y sus datos: la vista de admin lo traduce (es/en) en discordserver.json → detail.&lt;code&gt;.</summary>
    public string Code { get; set; } = "";
    public string[] Args { get; set; } = Array.Empty<string>();
    public string? ExistingId { get; set; }
    /// <summary>Clave del vínculo con Discord (role:…, category:…, channel:…, message:…, automod:…).</summary>
    public string ObjectKey { get; set; } = "";
}

public class PlanOptions
{
    /// <summary>Ajustar nivel de verificación, filtro de contenido, notificaciones, canal AFK y de sistema (cambia ajustes existentes).</summary>
    public bool ApplyGuildSettings { get; set; }
    /// <summary>Activar Comunidad (necesita que el bot sea Administrador) para poder crear foros, escenarios y anuncios.</summary>
    public bool EnableCommunity { get; set; }
    public bool PostSeedMessages { get; set; } = true;
    public bool ApplyAutomod { get; set; }
}

public class ServerPlan
{
    public string GuildId { get; set; } = "";
    public string GuildName { get; set; } = "";
    public string TemplateKey { get; set; } = "";
    public string TemplateVersion { get; set; } = "";
    public List<PlanItem> Items { get; set; } = new();
    public Dictionary<string, int> Counts => Items.GroupBy(i => i.Op).ToDictionary(g => g.Key, g => g.Count());
    public bool HasActions => Items.Any(i => PlanOp.IsAction(i.Op));

    /// <summary>Huella de lo que se va a hacer: «aplicar» solo corre si coincide con la de la vista previa.</summary>
    public string Hash()
    {
        var sb = new StringBuilder();
        foreach (var i in Items.Where(i => PlanOp.IsAction(i.Op) || i.Op == PlanOp.Blocked)) sb.Append(i.Kind).Append('|').Append(i.Key).Append('|').Append(i.Op).Append('\n');
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString())))[..16];
    }
}

/// <summary>Estado actual del servidor, con los vínculos de cargas anteriores que todavía existen.</summary>
public class ServerSnapshot
{
    public GuildInfo Guild { get; set; } = null!;
    public List<RoleInfo> Roles { get; set; } = new();
    public List<ChannelInfo> Channels { get; set; } = new();
    public BotInfo Bot { get; set; } = null!;
    public List<AutoModRuleInfo> AutoModRules { get; set; } = new();
    /// <summary>Vínculos guardados (role:…, channel:…, message:…): para roles y canales solo los que siguen existiendo.</summary>
    public Dictionary<string, string> Bindings { get; set; } = new();

    public ulong BotPermissions()
    {
        ulong v = 0;
        foreach (var r in Roles.Where(r => r.Id == Guild.Id || Bot.RoleIds.Contains(r.Id))) v |= r.Permissions;
        return v;
    }
    public bool BotIsAdmin => (BotPermissions() & DiscordPermissionBits.Administrator) != 0;
    public bool BotHas(ulong bit) => BotIsAdmin || (BotPermissions() & bit) != 0;
    public int BotTopPosition => Roles.Where(r => Bot.RoleIds.Contains(r.Id)).Select(r => r.Position).DefaultIfEmpty(0).Max();
}
