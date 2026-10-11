using System.Collections.Concurrent;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.DiscordServer;

public class ApplyJob
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string GuildId { get; set; } = "";
    public string Status { get; set; } = "running";      // running | done | failed
    public string? Error { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
    public int Total { get; set; }
    public List<ApplyResult> Results { get; } = new();
}

public class DbBindingStore : IBindingStore
{
    private readonly IServiceScopeFactory _scopes;
    public DbBindingStore(IServiceScopeFactory scopes) { _scopes = scopes; }

    public async Task<Dictionary<string, string>> LoadAsync(string guildId, string templateKey)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        return await db.DiscordTemplateBindings.AsNoTracking().Where(b => b.GuildId == guildId && b.TemplateKey == templateKey)
            .ToDictionaryAsync(b => b.ObjectKey, b => b.DiscordId);
    }

    public async Task SaveAsync(string guildId, string templateKey, string objectKey, string discordId)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        var row = await db.DiscordTemplateBindings.FirstOrDefaultAsync(b => b.GuildId == guildId && b.TemplateKey == templateKey && b.ObjectKey == objectKey);
        if (row == null) db.DiscordTemplateBindings.Add(new DiscordTemplateBinding { GuildId = guildId, TemplateKey = templateKey, ObjectKey = objectKey, DiscordId = discordId });
        else row.DiscordId = discordId;
        await db.SaveChangesAsync();
    }
}

/// <summary>Vista previa y carga de la plantilla del servidor de Discord (plan: .dev/plans/DISCORD_SERVIDOR_PLAN.md). Solo para el administrador del sistema.</summary>
public class ServerTemplateService
{
    public const string DefaultTemplate = "decatron-community";

    private readonly IDiscordRest _rest;
    private readonly IBindingStore _store;
    private readonly ILogger<ServerTemplateService> _logger;
    private readonly ConcurrentDictionary<string, ApplyJob> _jobs = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public ServerTemplateService(IDiscordRest rest, IBindingStore store, ILogger<ServerTemplateService> logger)
    {
        _rest = rest; _store = store; _logger = logger;
    }

    public ServerTemplate LoadTemplate(string key = DefaultTemplate) => ServerTemplate.Load(key);

    public async Task<ServerSnapshot> SnapshotAsync(string guildId, ServerTemplate t)
    {
        var guild = await _rest.GetGuildAsync(guildId);
        var roles = await _rest.GetRolesAsync(guildId);
        var channels = await _rest.GetChannelsAsync(guildId);
        var bot = await _rest.GetBotMemberAsync(guildId);
        var automod = await _rest.GetAutoModRulesAsync(guildId);
        var all = await _store.LoadAsync(guildId, t.Template.Key);

        // un vínculo de rol o canal solo vale si ese objeto todavía existe (si lo borraron a mano, se vuelve a crear)
        var roleIds = roles.Select(r => r.Id).ToHashSet(); var chanIds = channels.Select(c => c.Id).ToHashSet();
        var bindings = all.Where(kv =>
            kv.Key.StartsWith("role:") ? roleIds.Contains(kv.Value) :
            kv.Key.StartsWith("category:") || kv.Key.StartsWith("channel:") ? chanIds.Contains(kv.Value) : true)
            .ToDictionary(kv => kv.Key, kv => kv.Value);
        return new ServerSnapshot { Guild = guild, Roles = roles, Channels = channels, Bot = bot, AutoModRules = automod, Bindings = bindings };
    }

    public async Task<(ServerPlan Plan, ServerSnapshot Snapshot, ServerTemplate Template)> PreviewAsync(string guildId, PlanOptions o)
    {
        var t = LoadTemplate();
        var snap = await SnapshotAsync(guildId, t);
        return (ServerTemplatePlanner.Build(t, snap, o), snap, t);
    }

    public ApplyJob? GetJob(string id) => _jobs.TryGetValue(id, out var j) ? j : null;

    /// <summary>
    /// Lanza la carga en segundo plano. Antes vuelve a calcular el plan y solo sigue si su huella coincide con la de la vista previa
    /// y el nombre escrito es el del servidor (para no cargar en el servidor equivocado).
    /// </summary>
    public async Task<ApplyJob> StartApplyAsync(string guildId, PlanOptions o, string expectedHash, string confirmGuildName)
    {
        var t = LoadTemplate();
        var snap = await SnapshotAsync(guildId, t);
        var plan = ServerTemplatePlanner.Build(t, snap, o);
        var job = new ApplyJob { GuildId = guildId, Total = plan.Items.Count(i => PlanOp.IsAction(i.Op)) };

        if (!string.Equals(snap.Guild.Name, confirmGuildName, StringComparison.Ordinal))
        { job.Status = "failed"; job.Error = "name_mismatch"; job.FinishedAt = DateTime.UtcNow; _jobs[job.Id] = job; return job; }
        if (!string.Equals(plan.Hash(), expectedHash, StringComparison.Ordinal))
        { job.Status = "failed"; job.Error = "plan_changed"; job.FinishedAt = DateTime.UtcNow; _jobs[job.Id] = job; return job; }

        var gate = _locks.GetOrAdd(guildId, _ => new SemaphoreSlim(1, 1));
        if (!await gate.WaitAsync(0))
        { job.Status = "failed"; job.Error = "already_running"; job.FinishedAt = DateTime.UtcNow; _jobs[job.Id] = job; return job; }

        _jobs[job.Id] = job;
        _ = Task.Run(async () =>
        {
            try
            {
                await ServerTemplateApplier.ApplyAsync(t, snap, plan, o, _rest, _store, r => { lock (job.Results) job.Results.Add(r); });
                job.Status = "done";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Discord] Error cargando la plantilla en {Guild}", guildId);
                job.Status = "failed"; job.Error = "unexpected";
            }
            finally { job.FinishedAt = DateTime.UtcNow; gate.Release(); }
        });
        return job;
    }
}
