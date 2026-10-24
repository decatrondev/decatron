using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services;
using Decatron.Services.Accounts;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text.Json;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Flujos reales del giveaway contra la base (decatron_schema, tenant 9101; DECATRON_APP_CONN): sorteo de varios ganadores en los dos
/// modos, reroll con respaldo y sin él, exclusión de quien falló, ganadores que no pueden salir, cerrar la participación y
/// re-sortear tras completarse. El chat y el overlay son dobles: aquí se valida el ESTADO. Sin la variable, se omiten.
/// </summary>
public class GiveawayFlowTests
{
    private const long Tenant = 9101;
    private const string Channel = "zz-giveaway-test";
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");

    private sealed class NoopProxy : IClientProxy { public Task SendCoreAsync(string method, object?[] args, CancellationToken ct = default) => Task.CompletedTask; }
    private sealed class FakeClients : IHubClients
    {
        private static readonly NoopProxy P = new();
        public IClientProxy All => P;
        public IClientProxy AllExcept(IReadOnlyList<string> c) => P;
        public IClientProxy Client(string c) => P;
        public IClientProxy Clients(IReadOnlyList<string> c) => P;
        public IClientProxy Group(string g) => P;
        public IClientProxy GroupExcept(string g, IReadOnlyList<string> c) => P;
        public IClientProxy Groups(IReadOnlyList<string> g) => P;
        public IClientProxy User(string u) => P;
        public IClientProxy Users(IReadOnlyList<string> u) => P;
    }
    private sealed class FakeGroups : IGroupManager
    {
        public Task AddToGroupAsync(string c, string g, CancellationToken ct = default) => Task.CompletedTask;
        public Task RemoveFromGroupAsync(string c, string g, CancellationToken ct = default) => Task.CompletedTask;
    }
    private sealed class FakeHub : IHubContext<OverlayHub>
    {
        public IHubClients Clients { get; } = new FakeClients();
        public IGroupManager Groups { get; } = new FakeGroups();
    }
    private sealed class FakeSender : IMessageSender
    {
        public Task SendMessageAsync(string channel, string message) => Task.CompletedTask;
        public void SendMessage(string channel, string message) { }
    }

    private static DecatronDbContext NewContext() =>
        new(new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(TenantNpgsql.Create(App!, Tenant)).Options);

    private static GiveawayService NewService(DecatronDbContext ctx)
    {
        var hub = new FakeHub();
        var accounts = new AccountChannelResolver(new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(), NullLogger<AccountChannelResolver>.Instance);
        var overlay = new GiveawayOverlayService(ctx, accounts, hub, NullLogger<GiveawayOverlayService>.Instance);
        return new GiveawayService(ctx, NullLogger<GiveawayService>.Instance, new OverlayNotificationService(hub, NullLogger<OverlayNotificationService>.Instance),
            new FakeSender(), accounts, overlay);
    }

    private static void Clean()
    {
        using var ctx = NewContext();
        ctx.Database.ExecuteSqlRaw($"DELETE FROM giveaway_sessions WHERE channel_id = '{Channel}'; DELETE FROM giveaway_winner_cooldowns WHERE channel_id = '{Channel}'; DELETE FROM giveaway_configs WHERE channel_id = '{Channel}';");
    }

    /// <summary>Crea la config y arranca un giveaway con N participantes de prueba. Devuelve el id de la sesión.</summary>
    private static async Task<int> StartAsync(int winners, int backups, int participants, string settingsJson = "{}")
    {
        Clean();
        using var ctx = NewContext();
        var svc = NewService(ctx);
        var saved = await svc.SaveConfig(Channel, new GiveawayConfig
        {
            Name = "Prueba", PrizeName = "Premio de prueba", DurationType = "manual", NumberOfWinners = winners,
            HasBackupWinners = backups > 0, NumberOfBackupWinners = backups, EntryCommand = "!sorteo", AllowAutoEntry = false,
            Requirements = "{}", Weights = "{}", Settings = settingsJson, WinnerResponseTimeout = 15, AnnounceOnStart = false,
            StartMessage = "", WinnerMessage = "{winner} ganó {prize}", NoResponseMessage = "", ReminderMessage = "",
        });
        var session = await svc.StartGiveaway(Channel, saved);
        await svc.GenerateTestParticipants(Channel, participants, 0, 0, 0, 0, Enumerable.Range(1, participants).Select(i => $"user{i}").ToList());
        return session.Id;
    }

    private static async Task<List<(int Pos, string Name, bool Backup, bool Responded, bool Timeout, bool Dq)>> WinnersAsync(int sessionId)
    {
        using var ctx = NewContext();
        var rows = await (from w in ctx.GiveawayWinners.AsNoTracking()
                          join p in ctx.GiveawayParticipants.AsNoTracking() on w.ParticipantId equals p.Id
                          where w.SessionId == sessionId
                          select new { w.Position, p.Username, w.IsBackup, w.HasResponded, w.TimeoutProcessed, w.WasDisqualified }).ToListAsync();
        return rows.Select(r => (r.Position, r.Username, r.IsBackup, r.HasResponded, r.TimeoutProcessed, r.WasDisqualified)).ToList();
    }

    /// <summary>Lo que haría el servicio de fondo (y el ganador al escribir): marca respuesta o vencimiento de un ganador.</summary>
    private static async Task MarkAsync(int sessionId, string username, bool responded)
    {
        using var ctx = NewContext();
        var w = await (from x in ctx.GiveawayWinners join p in ctx.GiveawayParticipants on x.ParticipantId equals p.Id
                       where x.SessionId == sessionId && p.Username == username && !x.IsBackup && !x.WasDisqualified select x).FirstAsync();
        if (responded) { w.HasResponded = true; w.RespondedAt = DateTime.UtcNow; } else w.TimeoutProcessed = true;
        await ctx.SaveChangesAsync();
    }

    private static async Task<T> InSvc<T>(Func<GiveawayService, Task<T>> f)
    {
        using var ctx = NewContext();
        return await f(NewService(ctx));
    }

    [Fact]
    public async Task Todos_de_golpe_elige_los_3_lugares_y_un_respaldo_y_deja_la_participacion_abierta()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 3, backups: 1, participants: 8);
        var names = await InSvc(s => s.ChooseAsync(Channel, null));
        Assert.Equal(3, names.Count);

        var rows = await WinnersAsync(id);
        Assert.Equal(new[] { 1, 2, 3 }, rows.Where(r => !r.Backup).Select(r => r.Pos).OrderBy(x => x));
        Assert.Single(rows, r => r.Backup);
        Assert.Equal(4, rows.Select(r => r.Name).Distinct().Count()); // nadie repetido

        using var ctx = NewContext();
        var session = await ctx.GiveawaySessions.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal("selecting_winners", session.Status);
        Assert.False(session.EntriesClosed); // por defecto sigue abierta
        Assert.NotNull(await InSvc(s => s.GetEntryRules(Channel)));

        // Un segundo choose no inventa ganadores: todos los lugares están ocupados
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => InSvc(s => s.ChooseAsync(Channel, null)));
        Assert.Equal("places_full", ex.Message);
    }

    [Fact]
    public async Task Reroll_sube_primero_al_respaldo_y_despues_sortea_sin_repetir_a_quien_fallo()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 2, backups: 1, participants: 8);
        await InSvc(s => s.ChooseAsync(Channel, null));
        var first = (await WinnersAsync(id)).Where(r => !r.Backup).OrderBy(r => r.Pos).First();
        var backupName = (await WinnersAsync(id)).Single(r => r.Backup).Name;

        // El ganador 1 no responde (lo marca el servicio de fondo) y el moderador escribe reroll
        await MarkAsync(id, first.Name, responded: false);
        var (name, fromBackup) = await InSvc(s => s.RerollFromChatAsync(Channel, null));
        Assert.True(fromBackup);
        Assert.Equal(backupName, name);

        var rows = await WinnersAsync(id);
        Assert.True(rows.Single(r => r.Name == first.Name).Dq);                       // el que falló queda descartado
        var promoted = rows.Single(r => r.Name == backupName);
        Assert.False(promoted.Backup);
        Assert.Equal(first.Pos, promoted.Pos);                                        // en el mismo lugar

        // Ya no hay respaldo: el siguiente reroll sortea a otra persona que no haya ganado ni fallado
        await MarkAsync(id, backupName, responded: false);
        var (name2, fromBackup2) = await InSvc(s => s.RerollFromChatAsync(Channel, null));
        Assert.False(fromBackup2);
        var seen = new[] { first.Name, backupName };
        Assert.DoesNotContain(name2, seen);
        Assert.DoesNotContain(name2, (await WinnersAsync(id)).Where(r => r.Dq).Select(r => r.Name));
    }

    [Fact]
    public async Task Uno_por_uno_elige_un_ganador_por_choose_y_se_llena_en_orden()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 3, backups: 1, participants: 8, settingsJson: "{\"draw\":{\"mode\":\"one_by_one\"}}");

        var a = (await InSvc(s => s.ChooseAsync(Channel, null))).Single();
        var rows = await WinnersAsync(id);
        Assert.Single(rows);                      // un ganador, sin respaldos de antemano
        Assert.False(rows[0].Backup);

        await MarkAsync(id, a, responded: true);
        var b = (await InSvc(s => s.ChooseAsync(Channel, null))).Single();
        Assert.NotEqual(a, b);
        await MarkAsync(id, b, responded: true);
        var c = (await InSvc(s => s.ChooseAsync(Channel, null))).Single();
        Assert.Equal(3, new[] { a, b, c }.Distinct().Count());
        Assert.Equal(new[] { 1, 2, 3 }, (await WinnersAsync(id)).Select(r => r.Pos).OrderBy(x => x));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => InSvc(s => s.ChooseAsync(Channel, null)));
        Assert.Equal("places_full", ex.Message);
    }

    [Fact]
    public async Task Choose_con_nombre_elige_a_esa_persona_y_rechaza_a_quien_ya_es_ganador()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 2, backups: 0, participants: 6, settingsJson: "{\"draw\":{\"mode\":\"one_by_one\"}}");
        var picked = (await InSvc(s => s.ChooseAsync(Channel, "user4"))).Single();
        Assert.Equal("user4", picked);

        var dup = await Assert.ThrowsAsync<InvalidOperationException>(() => InSvc(s => s.ChooseAsync(Channel, "user4")));
        Assert.Equal("already_winner", dup.Message);
        var missing = await Assert.ThrowsAsync<InvalidOperationException>(() => InSvc(s => s.ChooseAsync(Channel, "nadie")));
        Assert.Equal("pick_not_found", missing.Message);

        // La auditoría deja claro que fue una elección a mano, no azar
        using var ctx = NewContext();
        Assert.Contains("manual-winner", (await ctx.GiveawaySessions.AsNoTracking().FirstAsync(s => s.Id == id)).DrawAudit);
    }

    [Fact]
    public async Task Un_ganador_no_puede_salir_pero_los_demas_si_y_close_cierra_la_participacion()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 5);
        var winner = (await InSvc(s => s.ChooseAsync(Channel, null))).Single();

        using (var ctx = NewContext())
        {
            var all = await ctx.GiveawayParticipants.AsNoTracking().Where(p => p.SessionId == id).ToListAsync();
            var win = all.Single(p => p.Username == winner);
            var other = all.First(p => p.Username != winner);
            Assert.Equal("winner_locked", await InSvc(s => s.LeaveAsync(Channel, win.UserId, win.Platform)));
            Assert.Equal("left", await InSvc(s => s.LeaveAsync(Channel, other.UserId, other.Platform)));
            Assert.Equal("not_in", await InSvc(s => s.LeaveAsync(Channel, other.UserId, other.Platform)));
        }

        Assert.True(await InSvc(s => s.SetEntriesClosedAsync(Channel, true)));
        Assert.Null(await InSvc(s => s.GetEntryRules(Channel)));                       // el comando de entrada deja de atenderse
        Assert.False((await InSvc(s => s.GetCommandStatusAsync(Channel))).EntriesOpen);
        Assert.True(await InSvc(s => s.SetEntriesClosedAsync(Channel, false)));
        Assert.NotNull(await InSvc(s => s.GetEntryRules(Channel)));
    }

    [Fact]
    public async Task Con_participacion_cerrada_al_sortear_no_entra_nadie_mas()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 4, settingsJson: "{\"draw\":{\"keepEntriesOpen\":false}}");
        await InSvc(s => s.ChooseAsync(Channel, null));
        using var ctx = NewContext();
        Assert.True((await ctx.GiveawaySessions.AsNoTracking().FirstAsync(s => s.Id == id)).EntriesClosed);
        Assert.Null(await InSvc(s => s.GetEntryRules(Channel)));
    }

    [Fact]
    public async Task Reroll_funciona_tras_completarse_el_giveaway_y_lo_devuelve_a_esperar_respuestas()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 5);
        var winner = (await InSvc(s => s.ChooseAsync(Channel, null))).Single();
        await MarkAsync(id, winner, responded: false);

        // Sin re-sorteo automático el servicio de fondo lo marca completado al vencer el plazo
        using (var ctx = NewContext())
        {
            var session = await ctx.GiveawaySessions.FirstAsync(s => s.Id == id);
            session.Status = "completed";
            await ctx.SaveChangesAsync();
        }

        var (name, _) = await InSvc(s => s.RerollFromChatAsync(Channel, null));
        Assert.NotEqual(winner, name);
        using var check = NewContext();
        Assert.Equal("selecting_winners", (await check.GiveawaySessions.AsNoTracking().FirstAsync(s => s.Id == id)).Status);
    }

    [Fact]
    public async Task Sin_nadie_pendiente_reroll_lo_dice_y_no_toca_nada()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 4);
        var winner = (await InSvc(s => s.ChooseAsync(Channel, null))).Single();
        await MarkAsync(id, winner, responded: true);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => InSvc(s => s.RerollFromChatAsync(Channel, null)));
        Assert.Equal("all_responded", ex.Message);
        Assert.Single(await WinnersAsync(id));
    }

    [Fact]
    public async Task Sin_participantes_el_primer_sorteo_cancela_y_un_segundo_giveaway_si_se_puede_crear()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 1);
        using (var ctx = NewContext()) { await ctx.Database.ExecuteSqlRawAsync($"DELETE FROM giveaway_participants WHERE session_id = {id}"); }
        await InSvc(s => s.ChooseAsync(Channel, null));
        using (var ctx = NewContext()) Assert.Equal("cancelled", (await ctx.GiveawaySessions.AsNoTracking().FirstAsync(s => s.Id == id)).Status);

        // Cancelado no bloquea: se puede iniciar otro enseguida
        var again = await InSvc(async s => await s.StartFromChatAsync(Channel, "Otro premio", 90, false));
        Assert.Equal("active", again.Status);
        Assert.Equal(90, (again.EndsAt!.Value - again.StartedAt!.Value).TotalSeconds, 1);
        Clean();
    }
}
