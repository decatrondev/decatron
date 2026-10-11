using System.Text.Json;

namespace Decatron.Services.DiscordServer;

// Modelo de Resources/discord-templates/*.json (esquema v1). Ver .dev/plans/DISCORD_SERVIDOR_PLAN.md.
// Los nombres del JSON van en camelCase; la lectura ignora mayúsculas, así que no hacen falta atributos.

public class ServerTemplate
{
    public int SchemaVersion { get; set; }
    public TemplateInfo Template { get; set; } = new();
    public GuildDef Guild { get; set; } = new();
    public List<LanguageDef> Languages { get; set; } = new();
    public PermissionsDef Permissions { get; set; } = new();
    public List<RoleDef> Roles { get; set; } = new();
    public List<CategoryDef> Categories { get; set; } = new();
    public ContentDef Content { get; set; } = new();
    public JsonElement Onboarding { get; set; }
    public List<AutomodDef> Automod { get; set; } = new();
    public List<string> ManualSteps { get; set; } = new();

    private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true, ReadCommentHandling = JsonCommentHandling.Skip };

    public static ServerTemplate Parse(string json) =>
        JsonSerializer.Deserialize<ServerTemplate>(json, Options) ?? throw new InvalidOperationException("Plantilla vacía");

    /// <summary>Lee Resources/discord-templates/{key}.json junto al ejecutable (o desde el directorio de trabajo).</summary>
    public static ServerTemplate Load(string key)
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Resources", "discord-templates", key + ".json"),
            Path.Combine(Directory.GetCurrentDirectory(), "Resources", "discord-templates", key + ".json"),
        };
        var path = candidates.FirstOrDefault(File.Exists) ?? throw new FileNotFoundException($"No se encontró la plantilla '{key}'", candidates[0]);
        return Parse(File.ReadAllText(path));
    }
}

public class TemplateInfo { public string Key { get; set; } = ""; public string Name { get; set; } = ""; public string Version { get; set; } = ""; }

public class GuildDef
{
    public string Name { get; set; } = "";
    public string VerificationLevel { get; set; } = "";
    public string ExplicitContentFilter { get; set; } = "";
    public string DefaultMessageNotifications { get; set; } = "";
    public string PreferredLocale { get; set; } = "en-US";
    public CommunityDef Community { get; set; } = new();
    public AfkDef Afk { get; set; } = new();
    public SystemChannelDef SystemChannel { get; set; } = new();
}
public class CommunityDef { public bool Enabled { get; set; } public string RulesChannel { get; set; } = ""; public string UpdatesChannel { get; set; } = ""; public string SafetyAlertsChannel { get; set; } = ""; }
public class AfkDef { public string Channel { get; set; } = ""; public int TimeoutSeconds { get; set; } = 300; }
public class SystemChannelDef { public string Channel { get; set; } = ""; public bool SuppressJoinNotifications { get; set; } public bool SuppressSetupTips { get; set; } }

public class LanguageDef { public string Code { get; set; } = ""; public string NativeName { get; set; } = ""; public bool Enabled { get; set; } public string RoleKey { get; set; } = ""; public string CategoryKey { get; set; } = ""; }

public class PermissionsDef
{
    public List<string> MemberBase { get; set; } = new();
    public List<string> ModTools { get; set; } = new();
    public Dictionary<string, List<string>> RoleGroups { get; set; } = new();
    public Dictionary<string, string> Principals { get; set; } = new();
    public Dictionary<string, PresetDef> Presets { get; set; } = new();
}
public class PresetDef { public AllowDeny? Viewers { get; set; } public AllowDeny? Staff { get; set; } public AllowDeny? Bot { get; set; } public string? Note { get; set; } }
public class AllowDeny { public List<string> Allow { get; set; } = new(); public List<string> Deny { get; set; } = new(); }

public class RoleDef
{
    public string Key { get; set; } = "";
    public string Kind { get; set; } = "role";          // role | separator
    public string Name { get; set; } = "";
    public StyleDef Style { get; set; } = new();
    public string? FallbackColor { get; set; }
    public List<string> Permissions { get; set; } = new();
    public bool Hoist { get; set; }
    public bool Mentionable { get; set; }
    public bool Enabled { get; set; } = true;
    public bool Existing { get; set; }                  // el rol lo crea Discord (el del bot): solo se localiza y se coloca
    public int? XpLevelMin { get; set; }
    public string? Note { get; set; }

    /// <summary>Color sólido (#rrggbb) a usar hoy: el del estilo, o el de respaldo para los roles con degradado pendiente.</summary>
    public int ColorInt()
    {
        var hex = Style.Color ?? FallbackColor;
        if (string.IsNullOrEmpty(hex) || hex.Length != 7 || hex[0] != '#') return 0;
        return Convert.ToInt32(hex[1..], 16);
    }
}
public class StyleDef { public string Type { get; set; } = "none"; public string? Color { get; set; } }

public class CategoryDef
{
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public VisibilityDef Visibility { get; set; } = new();
    public List<ChannelDef> Channels { get; set; } = new();
    public bool Enabled { get; set; } = true;
    public string? Note { get; set; }
}
public class VisibilityDef { public string Mode { get; set; } = "roles"; public List<string> Roles { get; set; } = new(); public List<string> Groups { get; set; } = new(); }

public class ChannelDef
{
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "text";           // text | forum | voice | stage | announcement
    public string Access { get; set; } = "members_write";
    public string? Topic { get; set; }
    public string? Seed { get; set; }                    // clave de content.texts, o "@rules"
    public int? SlowmodeSeconds { get; set; }
    public List<TagDef> Tags { get; set; } = new();
    public string? Guidelines { get; set; }
    public bool RequireTag { get; set; }
    public List<string> VisibilityRoles { get; set; } = new();
    public string? Role { get; set; }                    // rules_channel | updates_channel | afk_channel
}
public class TagDef { public string Name { get; set; } = ""; public bool Moderated { get; set; } }

public class ContentDef
{
    public Dictionary<string, Dictionary<string, string>> Texts { get; set; } = new();
    public Dictionary<string, Dictionary<string, string>> ForumGuidelines { get; set; } = new();
    public List<RuleDef> Rules { get; set; } = new();
}
public class RuleDef { public string Key { get; set; } = ""; public Dictionary<string, string> Title { get; set; } = new(); public Dictionary<string, string> Text { get; set; } = new(); }

public class AutomodDef
{
    public string Key { get; set; } = "";
    public string Type { get; set; } = "";                // spam | mention_spam | keyword_preset | keyword
    public int? Limit { get; set; }
    public List<string> Presets { get; set; } = new();
    public List<string> Patterns { get; set; } = new();
    public List<string> Allow { get; set; } = new();
    public List<string> Actions { get; set; } = new();    // block_message | alert:<canal>
    public List<string> ExemptRoles { get; set; } = new();
    public List<string> ExemptChannels { get; set; } = new();
    public string? Note { get; set; }
}
