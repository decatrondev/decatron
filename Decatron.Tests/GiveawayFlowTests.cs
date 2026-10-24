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
    private static async Task<int> StartAsync(int winners, int backups, int participants, string settingsJson = "{}", string requirements = "{}")
    {
        Clean();
        using var ctx = NewContext();
        var svc = NewService(ctx);
        var saved = await svc.SaveConfig(Channel, new GiveawayConfig
        {
            Name = "Prueba", PrizeName = "Premio de prueba", DurationType = "manual", NumberOfWinners = winners,
            HasBackupWinners = backups > 0, NumberOfBackupWinners = backups, EntryCommand = "!sorteo", AllowAutoEntry = false,
            Requirements = requirements, Weights = "{}", Settings = settingsJson, WinnerResponseTimeout = 15, AnnounceOnStart = false,
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
        var (name, fromBackup) = (await InSvc(s => s.RerollFromChatAsync(Channel, null))).Single();
        Assert.True(fromBackup);
        Assert.Equal(backupName, name);

        var rows = await WinnersAsync(id);
        Assert.True(rows.Single(r => r.Name == first.Name).Dq);                       // el que falló queda descartado
        var promoted = rows.Single(r => r.Name == backupName);
        Assert.False(promoted.Backup);
        Assert.Equal(first.Pos, promoted.Pos);                                        // en el mismo lugar

        // Ya no hay respaldo: el siguiente reroll sortea a otra persona que no haya ganado ni fallado
        await MarkAsync(id, backupName, responded: false);
        var (name2, fromBackup2) = (await InSvc(s => s.RerollFromChatAsync(Channel, null))).Single();
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

        var (name, _) = (await InSvc(s => s.RerollFromChatAsync(Channel, null))).Single();
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

    [Fact]
    public async Task Reroll_reemplaza_a_todos_los_que_vencieron_y_deja_los_X_ganadores_configurados()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 3, backups: 0, participants: 10);
        var first = await InSvc(s => s.ChooseAsync(Channel, null));
        Assert.Equal(3, first.Count);
        foreach (var n in first) await MarkAsync(id, n, responded: false); // los tres vencieron sin responder

        var replaced = await InSvc(s => s.RerollFromChatAsync(Channel, null));
        Assert.Equal(3, replaced.Count);                                    // salen los 3 configurados, no solo uno
        var names = replaced.Select(r => r.Username).ToList();
        Assert.Equal(3, names.Distinct().Count());
        Assert.Empty(names.Intersect(first));                               // ninguno de los que fallaron

        var rows = await WinnersAsync(id);
        Assert.Equal(3, rows.Count(r => !r.Dq && !r.Backup));              // 3 vigentes
        Assert.Equal(3, rows.Count(r => r.Dq));                            // los 3 que fallaron, descartados
        Assert.Equal(new[] { 1, 2, 3 }, rows.Where(r => !r.Dq).Select(r => r.Pos).OrderBy(x => x));

        // El overlay marca a los 3 como «nuevos» (la ruleta se repite para la ronda) y la ronda reinició el reloj del sorteo
        using var ctx = NewContext();
        var accounts = new AccountChannelResolver(new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(), NullLogger<AccountChannelResolver>.Instance);
        var overlay = new GiveawayOverlayService(ctx, accounts, new FakeHub(), NullLogger<GiveawayOverlayService>.Instance);
        var snap = await overlay.BuildSnapshotAsync(Channel);
        Assert.Equal(3, snap.Winners.Count);
        Assert.All(snap.Winners, w => Assert.True(w.Fresh));
        Assert.Equal("winner", snap.Phase);

        // Con overlay conectado, los nuevos quedan con SelectedAt = inicio de la ronda + revelado: la ruleta se vuelve a ver
        await ctx.Database.ExecuteSqlRawAsync($"UPDATE giveaway_winners SET selected_at = (now() at time zone 'utc') + interval '8 seconds' WHERE session_id = {id} AND NOT was_disqualified; UPDATE giveaway_sessions SET ended_at = (now() at time zone 'utc') WHERE id = {id}");
        var drawing = await overlay.BuildSnapshotAsync(Channel);
        Assert.Equal("drawing", drawing.Phase);
        Assert.InRange(drawing.RevealSeconds, 7, 8);
        Assert.NotEmpty(drawing.Candidates);
    }

    [Fact]
    public async Task Reroll_sin_nadie_vencido_solo_reemplaza_al_primero_pendiente_y_los_ya_confirmados_no_son_nuevos()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 3, backups: 0, participants: 10);
        var first = await InSvc(s => s.ChooseAsync(Channel, null));
        await MarkAsync(id, first[0], responded: true);                     // el 1 confirmó; el 2 y el 3 siguen con plazo abierto

        var replaced = await InSvc(s => s.RerollFromChatAsync(Channel, null));
        Assert.Single(replaced);                                            // ninguno venció: solo el primero pendiente
        var rows = await WinnersAsync(id);
        Assert.True(rows.Single(r => r.Name == first[1]).Dq);
        Assert.False(rows.Single(r => r.Name == first[2]).Dq);
        Assert.False(rows.Single(r => r.Name == first[0]).Dq);
    }

    [Fact]
    public async Task Reroll_con_el_nombre_de_un_confirmado_lo_reemplaza_y_el_anulado_no_vuelve_a_salir()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 2, backups: 0, participants: 8);
        var chosen = await InSvc(s => s.ChooseAsync(Channel, null));
        await MarkAsync(id, chosen[0], responded: true);
        await MarkAsync(id, chosen[1], responded: true);

        // sin nombre no hay nada que reemplazar
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => InSvc(s => s.RerollFromChatAsync(Channel, null)));
        Assert.Equal("all_responded", ex.Message);

        // con el nombre de un confirmado se re-sortea a esa persona
        var replaced = await InSvc(s => s.RerollFromChatAsync(Channel, chosen[0]));
        Assert.Single(replaced);
        Assert.NotEqual(chosen[0], replaced[0].Username);
        var rows = await WinnersAsync(id);
        Assert.True(rows.Single(r => r.Name == chosen[0]).Dq);
        Assert.False(rows.Single(r => r.Name == chosen[1]).Dq);
        Assert.Equal(2, rows.Count(r => !r.Dq && !r.Backup));              // siguen siendo los 2 lugares
    }

    [Fact]
    public async Task Si_el_streamer_no_permite_reemplazar_confirmados_reroll_de_un_confirmado_se_niega()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 5, settingsJson: "{\"draw\":{\"replaceConfirmed\":false}}");
        var winner = (await InSvc(s => s.ChooseAsync(Channel, null))).Single();
        await MarkAsync(id, winner, responded: true);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => InSvc(s => s.RerollFromChatAsync(Channel, winner)));
        Assert.Equal("confirmed_locked", ex.Message);
        Assert.False((await WinnersAsync(id)).Single().Dq);
    }

    [Fact]
    public async Task Dejar_abierto_no_completa_solo_choose_suma_un_extra_y_finish_termina()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 2, backups: 0, participants: 8, settingsJson: "{\"draw\":{\"onComplete\":\"keep_open\"}}");
        var chosen = await InSvc(s => s.ChooseAsync(Channel, null));
        Assert.Equal(2, chosen.Count);
        await MarkAsync(id, chosen[0], responded: true);
        await MarkAsync(id, chosen[1], responded: true);

        // choose otra vez: un ganador extra en el lugar 3
        var extra = await InSvc(s => s.ChooseAsync(Channel, null));
        Assert.Single(extra);
        Assert.DoesNotContain(extra[0], chosen);
        Assert.Contains(await WinnersAsync(id), r => r.Pos == 3 && r.Name == extra[0]);

        using (var ctx = NewContext())
            Assert.Equal("selecting_winners", (await ctx.GiveawaySessions.AsNoTracking().FirstAsync(x => x.Id == id)).Status);

        Assert.True(await InSvc(s => s.FinishAsync(Channel)));
        using (var ctx = NewContext())
        {
            var done = await ctx.GiveawaySessions.AsNoTracking().FirstAsync(x => x.Id == id);
            Assert.Equal("completed", done.Status);
            Assert.True(done.EntriesClosed);
        }
        // ya terminado: no hay nada más que terminar
        Assert.False(await InSvc(s => s.FinishAsync(Channel)));
    }

    [Fact]
    public async Task Terminando_automaticamente_choose_con_todos_los_lugares_llenos_no_suma_extra()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 4);
        var winner = (await InSvc(s => s.ChooseAsync(Channel, null))).Single();
        await MarkAsync(id, winner, responded: true);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => InSvc(s => s.ChooseAsync(Channel, null)));
        Assert.Equal("places_full", ex.Message);
    }

    [Fact]
    public async Task La_lista_de_participantes_muestra_estado_y_probabilidad_y_solo_deja_sacar_a_quien_no_es_ganador()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 5);

        // Abierto: todos participan y las probabilidades suman 1
        var before = JsonSerializer.SerializeToElement(await InSvc(s => s.GetParticipantsDetailAsync(Channel)));
        var list = before.GetProperty("participants").EnumerateArray().ToList();
        Assert.Equal(5, list.Count);
        Assert.All(list, p => Assert.Equal("participating", p.GetProperty("status").GetString()));
        Assert.Equal(1.0, list.Sum(p => p.GetProperty("probability").GetDouble()), 3);

        // Se saca a uno que no ganó
        Assert.Equal("removed", await InSvc(s => s.RemoveParticipantAsync(Channel, "user5")));
        Assert.Equal("not_in", await InSvc(s => s.RemoveParticipantAsync(Channel, "user5")));

        // Tras sortear: el ganador figura pendiente, no suma probabilidad y no se puede sacar
        var winner = (await InSvc(s => s.ChooseAsync(Channel, "user1"))).Single();
        Assert.Equal("user1", winner);
        var after = JsonSerializer.SerializeToElement(await InSvc(s => s.GetParticipantsDetailAsync(Channel)));
        var w = after.GetProperty("participants").EnumerateArray().Single(p => p.GetProperty("username").GetString() == "user1");
        Assert.Equal("pending", w.GetProperty("status").GetString());
        Assert.Equal(1, w.GetProperty("place").GetInt32());
        Assert.False(w.GetProperty("canWin").GetBoolean());
        Assert.Equal(4, after.GetProperty("total").GetInt32());
        Assert.Equal("winner_locked", await InSvc(s => s.RemoveParticipantAsync(Channel, "user1")));
    }

    [Fact]
    public async Task La_lista_de_participantes_sigue_ahi_cuando_el_giveaway_ya_se_completo_hace_rato()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 2, backups: 0, participants: 6);
        var chosen = await InSvc(s => s.ChooseAsync(Channel, null));
        await MarkAsync(id, chosen[0], responded: false);
        await MarkAsync(id, chosen[1], responded: false);
        using (var ctx = NewContext())
        {
            var session = await ctx.GiveawaySessions.FirstAsync(x => x.Id == id);
            session.Status = "completed"; session.EndedAt = DateTime.UtcNow.AddMinutes(-10);
            await ctx.SaveChangesAsync();
        }
        var detail = JsonSerializer.SerializeToElement(await InSvc(s => s.GetParticipantsDetailAsync(Channel)));
        Assert.Equal("completed", detail.GetProperty("status").GetString());
        var list = detail.GetProperty("participants").EnumerateArray().ToList();
        Assert.Equal(6, list.Count);
        Assert.Equal(2, list.Count(p => p.GetProperty("status").GetString() == "expired"));
        // y se puede re-sortear desde ahí
        Assert.Equal(2, (await InSvc(s => s.RerollFromChatAsync(Channel, null))).Count);
    }

    [Fact]
    public async Task La_ruleta_solo_lleva_a_quien_sigue_participando_y_en_el_mismo_orden_en_cada_foto()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 2, backups: 0, participants: 12);
        var chosen = await InSvc(s => s.ChooseAsync(Channel, null));
        // Simula el overlay conectado: el revelado dura 30 s a partir de ahora
        using (var ctx = NewContext())
        {
            var session = await ctx.GiveawaySessions.FirstAsync(x => x.Id == id);
            // 6 h hacia adelante: la base de pruebas puede devolver las horas en la zona local (Lima, -5 h) y aun así el revelado sigue en curso
            var nowRaw = DateTime.UtcNow.AddHours(6);
            session.EndedAt = nowRaw;
            foreach (var w in ctx.GiveawayWinners.Where(w => w.SessionId == id)) w.SelectedAt = nowRaw.AddSeconds(30);
            await ctx.SaveChangesAsync();
        }

        async Task<System.Text.Json.JsonElement> Frame()
        {
            using var ctx = NewContext();
            var hub = new FakeHub();
            var accounts = new AccountChannelResolver(new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(), NullLogger<AccountChannelResolver>.Instance);
            var overlay = new GiveawayOverlayService(ctx, accounts, hub, NullLogger<GiveawayOverlayService>.Instance);
            return JsonSerializer.SerializeToElement(await overlay.BuildSnapshotAsync(Channel));
        }

        var one = await Frame();
        var two = await Frame();
        Assert.True("drawing" == one.GetProperty("Phase").GetString(), one.ToString().Substring(0, Math.Min(900, one.ToString().Length)));
        var a = one.GetProperty("Candidates").EnumerateArray().Select(e => e.GetString()!).ToList();
        var b = two.GetProperty("Candidates").EnumerateArray().Select(e => e.GetString()!).ToList();
        Assert.Equal(a, b);                                   // mismo orden en cada foto: la ruleta no salta
        Assert.Equal(10, a.Count);                            // 12 participantes menos los 2 ganadores
        Assert.DoesNotContain(a, n => chosen.Contains(n));    // nadie que ya ganó
        Assert.Equal(a.Count, a.Distinct().Count());
    }

    [Fact]
    public async Task Tras_finish_el_overlay_se_oculta_aunque_quede_un_ganador_sin_responder()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 2, backups: 0, participants: 6);
        await InSvc(s => s.ChooseAsync(Channel, null));                 // los 2 quedan pendientes
        Assert.True(await InSvc(s => s.FinishAsync(Channel)));
        using (var ctx = NewContext())
        {
            // El resultado ya estuvo a la vista todo su tiempo (UpdatedAt muy atrás)
            var session = await ctx.GiveawaySessions.FirstAsync(x => x.Id == id);
            session.UpdatedAt = DateTime.UtcNow.AddHours(-12);
            session.EndedAt = DateTime.UtcNow.AddHours(-12);
            foreach (var w in ctx.GiveawayWinners.Where(w => w.SessionId == id)) w.SelectedAt = DateTime.UtcNow.AddHours(-12);
            await ctx.SaveChangesAsync();
        }
        using var c2 = NewContext();
        var hub = new FakeHub();
        var accounts = new AccountChannelResolver(new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(), NullLogger<AccountChannelResolver>.Instance);
        var snap = await new GiveawayOverlayService(c2, accounts, hub, NullLogger<GiveawayOverlayService>.Instance).BuildSnapshotAsync(Channel);
        Assert.Equal("idle", snap.Phase);
    }

    private static Dictionary<string, object> KickMeta(bool sub = false) => new() { ["isSubscriber"] = sub, ["isFollower"] = false, ["isModerator"] = false, ["isVip"] = false };

    [Fact]
    public async Task Kick_apagado_rechaza_y_encendido_deja_entrar_con_su_plataforma_propia()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        var id = await StartAsync(winners: 1, backups: 0, participants: 0);

        var off = await InSvc(s => s.AddParticipant(Channel, "777", "kickuser", "KickUser", KickMeta(), null, "kick"));
        Assert.False(off.Joined);
        Assert.Equal("platform_disabled", off.Reason);

        id = await StartAsync(winners: 1, backups: 0, participants: 0, settingsJson: "{\"platforms\":{\"twitch\":true,\"kick\":true}}");
        var on = await InSvc(s => s.AddParticipant(Channel, "777", "kickuser", "KickUser", KickMeta(), null, "kick"));
        Assert.True(on.Joined);
        // el mismo id numérico en Twitch es OTRA persona: entra también
        var twitch = await InSvc(s => s.AddParticipant(Channel, "777", "twitchuser", "TwitchUser", KickMeta(), null, "twitch"));
        Assert.True(twitch.Joined);
        // y repetir en Kick no duplica
        var again = await InSvc(s => s.AddParticipant(Channel, "777", "kickuser", "KickUser", KickMeta(), null, "kick"));
        Assert.Equal("already_entered", again.Reason);
        using var ctx = NewContext();
        Assert.Equal(2, await ctx.GiveawayParticipants.CountAsync(p => p.SessionId == id && (p.Username == "kickuser" || p.Username == "twitchuser")));
    }

    [Fact]
    public async Task Kick_con_seguidor_obligatorio_omite_o_rechaza_segun_lo_que_elija_el_streamer()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        const string mustFollow = "{\"mustFollow\":true}";

        // por defecto lo que Kick no puede comprobar se omite: entra
        await StartAsync(1, 0, 0, "{\"platforms\":{\"twitch\":true,\"kick\":true}}", mustFollow);
        var allow = await InSvc(s => s.AddParticipant(Channel, "888", "kickfan", "KickFan", KickMeta(), null, "kick"));
        Assert.True(allow.Joined);
        // en Twitch sí se exige (no es seguidor)
        var tw = await InSvc(s => s.AddParticipant(Channel, "889", "twfan", "TwFan", KickMeta(), null, "twitch"));
        Assert.Equal("not_follower", tw.Reason);

        // con «rechazar lo que no se pueda comprobar», Kick queda fuera
        await StartAsync(1, 0, 0, "{\"platforms\":{\"twitch\":true,\"kick\":true,\"unverifiable\":\"reject\"}}", mustFollow);
        var reject = await InSvc(s => s.AddParticipant(Channel, "888", "kickfan", "KickFan", KickMeta(), null, "kick"));
        Assert.Equal("unverifiable_follower", reject.Reason);
    }
}
