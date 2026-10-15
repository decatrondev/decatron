using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

public sealed record EventSubSyncResult(long TenantId, int Channels, int Created, int Existing, int Errors, DateTimeOffset At);

/// <summary>
/// Plataforma, Fase 4 (paso 7c): crea las suscripciones de EventSub de los canales de UN tenant con el conduit de ese tenant, dentro de su
/// contexto (SU token de app y SU bot). Mismo conjunto de eventos que el #1. Los canales salen de <c>channels</c> (tenant_id); un canal
/// sin bot habilitado o sin TwitchId se omite. Si Twitch rechaza una suscripcion (p. ej. falta channel:bot) se cuenta como error y se sigue.
/// </summary>
public sealed class TenantEventSubSync
{
    private readonly IServiceProvider _sp;
    private readonly IConfiguration _cfg;
    private readonly TenantEventSubHub _hub;
    private readonly ILogger<TenantEventSubSync> _log;
    private readonly System.Collections.Concurrent.ConcurrentDictionary<long, EventSubSyncResult> _last = new();

    public TenantEventSubSync(IServiceProvider sp, IConfiguration cfg, TenantEventSubHub hub, ILogger<TenantEventSubSync> log)
    { _sp = sp; _cfg = cfg; _hub = hub; _log = log; }

    public EventSubSyncResult? LastOf(long tenantId) => _last.TryGetValue(tenantId, out var r) ? r : null;

    private async Task<List<long>> ChannelUserIdsAsync(long tenantId, CancellationToken ct)
    {
        var ids = new List<long>();
        await using var c = TenantNpgsql.Create(_cfg.GetConnectionString("DefaultConnection"), 1); // channels no lleva RLS: el resolutor la lee entera
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT DISTINCT user_id FROM channels WHERE tenant_id=@t AND platform='twitch'", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) ids.Add(r.GetInt64(0));
        return ids;
    }

    public async Task<EventSubSyncResult> SyncAsync(long tenantId, CancellationToken ct = default)
    {
        if (tenantId == 1) throw new ArgumentException("El tenant 1 usa su servicio principal.", nameof(tenantId));
        var state = _hub.StateOf(tenantId);
        if (state is null || state.Status != "connected" || string.IsNullOrEmpty(state.ConduitId))
            throw new InvalidOperationException("eventsub_not_connected");

        var userIds = await ChannelUserIdsAsync(tenantId, ct);
        int created = 0, existing = 0, errors = 0, channels = 0;
        using (TenantAmbient.Push(tenantId))
        {
            using var scope = _sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var svc = scope.ServiceProvider.GetRequiredService<EventSubService>();
            const EventSubTransportMode mode = EventSubTransportMode.Conduit;
            var conduit = state.ConduitId;

            foreach (var userId in userIds)
            {
                ct.ThrowIfCancellationRequested();
                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
                if (user is null || !user.IsActive || string.IsNullOrEmpty(user.TwitchId)) continue;
                var settings = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == user.Id, ct);
                if (settings is null || !settings.BotEnabled) continue;
                channels++;

                var id = user.TwitchId;
                var steps = new List<(string Name, Func<Task<EventSubSubscriptionResult>> Run)>
                {
                    ("chat", () => svc.EnsureSubscriptionAsync(id, mode, conduit)),
                    ("redemption", () => svc.EnsureChannelPointsSubscriptionAsync(id, mode, conduit)),
                    ("follow", () => svc.EnsureFollowsSubscriptionAsync(id, mode, conduit)),
                    ("cheer", () => svc.EnsureCheerSubscriptionAsync(id, mode, conduit)),
                    ("subscribe", () => svc.EnsureSubscriptionsSubscriptionAsync(id, mode, conduit)),
                    ("resub", () => svc.EnsureResubMessagesSubscriptionAsync(id, mode, conduit)),
                    ("gift", () => svc.EnsureGiftSubsSubscriptionAsync(id, mode, conduit)),
                    ("raid", () => svc.EnsureRaidSubscriptionAsync(id, mode, conduit)),
                    ("hype", () => svc.EnsureHypeTrainSubscriptionAsync(id, mode, conduit)),
                    ("hype_progress", () => svc.EnsureHypeTrainStageSubscriptionAsync(id, "progress", mode, conduit)),
                    ("hype_end", () => svc.EnsureHypeTrainStageSubscriptionAsync(id, "end", mode, conduit)),
                    ("online", () => svc.EnsureStreamOnlineSubscriptionAsync(id, mode, conduit)),
                    ("offline", () => svc.EnsureStreamOfflineSubscriptionAsync(id, mode, conduit)),
                    ("update", () => svc.EnsureChannelUpdateSubscriptionAsync(id, mode, conduit)),
                };
                foreach (var (name, run) in steps)
                {
                    try
                    {
                        var res = await run();
                        if (!res.Success) { errors++; _log.LogWarning("eventsub.tenant.sync tenant={Tenant} channel={Channel} step={Step} fail", tenantId, user.Login, name); }
                        else if (res.Message?.Contains("ya existe") == true) existing++;
                        else created++;
                    }
                    catch (Exception ex) { errors++; _log.LogWarning("eventsub.tenant.sync tenant={Tenant} channel={Channel} step={Step} type={Type}", tenantId, user.Login, name, ex.GetType().Name); }
                }
                await Task.Delay(500, ct); // mismo ritmo que el #1
            }
        }
        var result = new EventSubSyncResult(tenantId, channels, created, existing, errors, DateTimeOffset.UtcNow);
        _last[tenantId] = result;
        _log.LogInformation("eventsub.tenant.sync tenant={Tenant} channels={Channels} created={Created} existing={Existing} errors={Errors}", tenantId, channels, created, existing, errors);
        return result;
    }
}
