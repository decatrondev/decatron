using System.Text.RegularExpressions;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase A, Equipo: invitaciones de admins, cuota quota.admins, un solo uso, vencimiento, aislamiento entre tenants y qué filtro protege cada controlador. Corre sobre decatron_schema.</summary>
public class TenantTeamTests
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private const long A = 9101, B = 9102;

    private sealed class FakeEntitlements : IEntitlements
    {
        public decimal? Limit = 3;
        public bool Operational = true;
        public Task<bool> IsOperationalAsync(long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(Operational);
        public Task<bool> HasAsync(string f, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(true);
        public Task<(bool Operational, decimal? Limit)> LimitAsync(string k, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult((Operational, Limit));
        public Task<EntitlementResult> TryConsumeAsync(string k, long a = 1, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public Task<EntitlementResult> CheckGaugeAsync(string key, long current, long adding = 1, long? tenantId = null, CancellationToken ct = default)
            => Task.FromResult(Limit is { } l && current + adding > l ? new EntitlementResult(EntitlementOutcome.Blocked, current, l, "limit_reached") : EntitlementResult.Ok(current + adding, Limit));
        public void Invalidate(long? t = null) { }
    }

    private static async Task<bool> EnvOkAsync()
    {
        if (string.IsNullOrWhiteSpace(App)) return false;
        await using var c = TenantNpgsql.Create(App, 1); await c.OpenAsync();
        if ((string)(await new NpgsqlCommand("select current_database()", c).ExecuteScalarAsync())! != "decatron_schema") return false;
        return (long)(await new NpgsqlCommand($"select count(*) from tenants where id in ({A},{B})", c).ExecuteScalarAsync())! == 2;
    }

    private static async Task<long> MakeOwnerAsync(long tenant, string login, string email)
    {
        await using var c = TenantNpgsql.Create(App, tenant); await c.OpenAsync();
        await using var tx = await c.BeginTransactionAsync();
        var id = await TenantProvisioner.CreateBuyerUserAsync(c, tx, login, email, "es");
        await new NpgsqlCommand($"insert into tenant_members (tenant_id, user_id, role) values ({tenant}, {id}, 'owner')", c, tx).ExecuteNonQueryAsync();
        await tx.CommitAsync();
        return id;
    }

    private static async Task CleanAsync()
    {
        foreach (var t in new[] { A, B })
        {
            await using var c = TenantNpgsql.Create(App, t); await c.OpenAsync();
            await new NpgsqlCommand($"delete from tenant_invitations; delete from tenant_members where tenant_id={t}; delete from users where tenant_id={t}; delete from accounts", c).ExecuteNonQueryAsync();
        }
    }

    private static async Task<long> Count(long tenant, string sql)
    {
        await using var c = TenantNpgsql.Create(App, tenant); await c.OpenAsync();
        return (long)(await new NpgsqlCommand(sql, c).ExecuteScalarAsync())!;
    }

    private static TenantTeam NewTeam(FakeEntitlements ent)
        => new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App }).Build(), ent);

    [Fact(DisplayName = "Equipo: invitar respeta quota.admins (dueño + admins + pendientes), un solo uso, vencimiento y aislamiento entre tenants")]
    public async Task FlujoCompleto()
    {
        if (!await EnvOkAsync()) return;
        await CleanAsync();
        var ent = new FakeEntitlements { Limit = 3 };
        var team = NewTeam(ent);
        try
        {
            var owner = await MakeOwnerAsync(A, "zzowner", "dueno@ejemplo.test");
            var otherOwner = await MakeOwnerAsync(B, "zzowner", "dueno@ejemplo.test");   // mismo correo y login en OTRO tenant: no choca

            // validaciones
            Assert.Equal("invalid_email", (await team.InviteAsync(A, owner, "no-es-correo", "es")).Code);
            Assert.Equal("already_member", (await team.InviteAsync(A, owner, "  DUENO@ejemplo.test ", "es")).Code);
            Assert.Equal("tenant_one", (await team.InviteAsync(1, owner, "x@ejemplo.test", "es")).Code);

            // cuota: límite 3 = dueño + 2
            var i1 = await team.InviteAsync(A, owner, "Uno@ejemplo.test", "es");
            Assert.True(i1.Ok);
            var inv1 = (InviteOutcome)i1.Data!;
            Assert.Equal("uno@ejemplo.test", inv1.Email);
            Assert.Equal("already_invited", (await team.InviteAsync(A, owner, "uno@ejemplo.test", "es")).Code);
            var i2 = await team.InviteAsync(A, owner, "dos@ejemplo.test", "en");
            Assert.True(i2.Ok);
            var blocked = await team.InviteAsync(A, owner, "tres@ejemplo.test", "es");   // 1 dueño + 2 pendientes = 3: lleno
            Assert.False(blocked.Ok); Assert.Equal("quota_admins", blocked.Code); Assert.Equal(403, blocked.Status);

            // el token solo se guarda como hash
            Assert.Equal(0L, await Count(A, $"select count(*) from tenant_invitations where token_hash = '{inv1.Token}'"));
            Assert.Equal(1L, await Count(A, $"select count(*) from tenant_invitations where token_hash = '{TenantTeam.HashOf(inv1.Token)}'"));

            // aislamiento: el enlace de A no sirve en B, y B no ve las invitaciones de A
            Assert.Equal("invalid_token", (await team.AcceptAsync(B, inv1.Token)).Code);
            Assert.Equal(0, ((IEnumerable<TeamInvitationRow>)Props(await team.GetAsync(B), "invitations")).Count());
            Assert.Equal(2, ((IEnumerable<TeamInvitationRow>)Props(await team.GetAsync(A), "invitations")).Count());

            // aceptar: crea cuenta de comprador y fila admin; el enlace se gasta
            Assert.Equal("invalid_token", (await team.AcceptAsync(A, "basura-basura-basura-basura")).Code);
            var acc = await team.AcceptAsync(A, inv1.Token);
            Assert.True(acc.Ok);
            var admin = (AcceptOutcome)acc.Data!;
            Assert.StartsWith("admin-", admin.Login);
            Assert.Equal("uno@ejemplo.test", admin.Email);
            Assert.Equal("admin", await ScalarStr(A, $"select role from tenant_members where user_id={admin.UserId}"));
            Assert.Equal("email", await ScalarStr(A, $"select auth_provider from users where id={admin.UserId}"));
            Assert.Equal("invalid_token", (await team.AcceptAsync(A, inv1.Token)).Code);

            // el tope ahora lo ocupan dueño + admin + 1 pendiente
            Assert.Equal("quota_admins", (await team.InviteAsync(A, owner, "tres@ejemplo.test", "es")).Code);

            // el plan baja mientras la invitación 2 está viva: no entra (falla cerrado)
            ent.Limit = 2;
            Assert.Equal("quota_admins", (await team.AcceptAsync(A, ((InviteOutcome)i2.Data!).Token)).Code);
            ent.Limit = 3;

            // sin operar no se invita ni se acepta
            ent.Operational = false;
            Assert.Equal("not_operational", (await team.InviteAsync(A, owner, "cuatro@ejemplo.test", "es")).Code);
            Assert.Equal("not_operational", (await team.AcceptAsync(A, ((InviteOutcome)i2.Data!).Token)).Code);
            ent.Operational = true;

            // cancelar libera el lugar y el enlace deja de servir
            var inv2 = (InviteOutcome)i2.Data!;
            Assert.True((await team.CancelInvitationAsync(A, inv2.InvitationId, owner)).Ok);
            Assert.Equal("invitation_not_found", (await team.CancelInvitationAsync(A, inv2.InvitationId, owner)).Code);
            Assert.Equal("invalid_token", (await team.AcceptAsync(A, inv2.Token)).Code);
            Assert.True((await team.InviteAsync(A, owner, "tres@ejemplo.test", "es")).Ok);

            // vencida: no cuenta, no se acepta y se puede reinvitar al mismo correo
            await using (var c = TenantNpgsql.Create(App, A)) { await c.OpenAsync();
                await new NpgsqlCommand("update tenant_invitations set expires_at = now() - interval '1 minute' where lower(email)='tres@ejemplo.test'", c).ExecuteNonQueryAsync(); }
            Assert.Equal(0, ((IEnumerable<TeamInvitationRow>)Props(await team.GetAsync(A), "invitations")).Count());
            var again = await team.InviteAsync(A, owner, "tres@ejemplo.test", "es");
            Assert.True(again.Ok);

            // quitar: solo admins; ni el dueño ni uno mismo; cierra la cuenta
            Assert.Equal("member_not_found", (await team.RemoveAdminAsync(A, owner, otherOwner)).Code);             // el dueño de OTRO tenant
            Assert.Equal("cannot_remove_self", (await team.RemoveAdminAsync(A, owner, owner)).Code);
            Assert.Equal("member_not_found", (await team.RemoveAdminAsync(A, admin.UserId, owner)).Code);            // un admin no quita al dueño
            Assert.True((await team.RemoveAdminAsync(A, owner, admin.UserId)).Ok);
            Assert.Equal(0L, await Count(A, $"select count(*) from tenant_members where user_id={admin.UserId}"));
            Assert.Equal(0L, await Count(A, $"select count(*) from users where id={admin.UserId} and is_active"));
            Assert.Equal(1L, await Count(A, $"select count(*) from tenant_members where user_id={owner} and role='owner'"));
            Assert.Equal(1L, await Count(B, $"select count(*) from tenant_members where user_id={otherOwner} and role='owner'"));

            // el mismo correo se puede volver a invitar y acepta con una cuenta NUEVA (login distinto)
            await team.CancelInvitationAsync(A, ((InviteOutcome)again.Data!).InvitationId, owner);
            var re = await team.InviteAsync(A, owner, "uno@ejemplo.test", "es");
            Assert.True(re.Ok);
            var admin2 = (AcceptOutcome)(await team.AcceptAsync(A, ((InviteOutcome)re.Data!).Token)).Data!;
            Assert.NotEqual(admin.UserId, admin2.UserId);
            Assert.NotEqual(admin.Login, admin2.Login);

            // auditoría
            Assert.True(await Count(A, "select count(*) from credential_access_log where provider='team' and action in ('invite','accept','remove','cancel')") >= 6);
            Assert.Equal(0L, await Count(A, $"select count(*) from credential_access_log where provider='team' and (purpose like '%@%' or actor like '%@%')"));   // sin correos en la bitácora
        }
        finally { await CleanAsync(); }
    }

    [Fact(DisplayName = "Equipo: topes de invitaciones pendientes (5) y por día (10)")]
    public async Task Topes()
    {
        if (!await EnvOkAsync()) return;
        await CleanAsync();
        var ent = new FakeEntitlements { Limit = null };     // plan sin tope de admins: aquí solo mandan los topes de abuso
        var team = NewTeam(ent);
        try
        {
            var owner = await MakeOwnerAsync(A, "zzowner", "dueno@ejemplo.test");
            var ids = new List<long>();
            for (var i = 0; i < TenantTeam.MaxPending; i++)
            {
                var r = await team.InviteAsync(A, owner, $"p{i}@ejemplo.test", "es");
                Assert.True(r.Ok); ids.Add(((InviteOutcome)r.Data!).InvitationId);
            }
            var sixth = await team.InviteAsync(A, owner, "p9@ejemplo.test", "es");
            Assert.Equal("too_many_pending", sixth.Code); Assert.Equal(429, sixth.Status);

            // cancelar y reinvitar no esquiva el tope diario: las canceladas también cuentan
            for (var round = 0; round < 3; round++)
            {
                foreach (var id in ids) await team.CancelInvitationAsync(A, id, owner);
                ids.Clear();
                for (var i = 0; i < TenantTeam.MaxPending; i++)
                {
                    var r = await team.InviteAsync(A, owner, $"q{round}{i}@ejemplo.test", "es");
                    if (!r.Ok) { Assert.Equal("daily_limit", r.Code); return; }
                    ids.Add(((InviteOutcome)r.Data!).InvitationId);
                }
            }
            Assert.Fail("El tope diario nunca se activó");
        }
        finally { await CleanAsync(); }
    }

    [Fact(DisplayName = "Equipo: el plan sin lugar para admins marca «no incluido» y no deja invitar")]
    public async Task NoIncluido()
    {
        if (!await EnvOkAsync()) return;
        await CleanAsync();
        var team = NewTeam(new FakeEntitlements { Limit = 1 });   // sandbox / Semilla
        try
        {
            var owner = await MakeOwnerAsync(A, "zzowner", "dueno@ejemplo.test");
            var snap = await team.GetAsync(A);
            Assert.False((bool)Props(snap, "included")); Assert.False((bool)Props(snap, "canInvite"));
            Assert.Equal("quota_admins", (await team.InviteAsync(A, owner, "uno@ejemplo.test", "es")).Code);
            Assert.Equal(0L, await Count(A, "select count(*) from tenant_invitations"));
        }
        finally { await CleanAsync(); }
    }

    // Los controladores se compilan dentro del proyecto web, que estas pruebas no referencian: se revisa el código fuente.
    private static string Source(string file)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Decatron.csproj"))) dir = dir.Parent;
        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine(dir!.FullName, "Decatron.Controllers", file));
    }

    [Fact(DisplayName = "Equipo: solo el dueño toca credenciales, 2FA y equipo; el admin solo lee estado y reabre EventSub")]
    public void FiltrosPorControlador()
    {
        // Todo lo que NO es BuyerStateController exige owner a nivel de clase, así una acción nueva nace protegida.
        foreach (var f in new[] { "BuyerTenantController.cs", "BuyerMfaController.cs", "BuyerTeamController.cs" })
        {
            var src = Source(f);
            Assert.Matches(@"\[Authorize, RequireBuyerOwner\]\s+public class", src);
            Assert.DoesNotContain("RequireBuyerMember", src);
            Assert.DoesNotContain("AllowAnonymous", src);
        }
        var state = Source("BuyerStateController.cs");
        Assert.Matches(@"\[Authorize, RequireBuyerMember\]\s+public class", state);
        Assert.DoesNotContain("RequireBuyerOwner]", state);
        var actions = Regex.Matches(state, @"\[Http(Get|Post|Put|Delete)\(""([^""]*)""\)\]").Select(m => m.Groups[1].Value + " " + m.Groups[2].Value).OrderBy(x => x).ToArray();
        Assert.Equal(new[] { "Get state", "Post eventsub/restart" }, actions);   // si alguien agrega una ruta aquí, esta prueba obliga a decidirlo a propósito

        // invitar y quitar admins exigen el 2FA reciente (cuando está activado)
        var team = Source("BuyerTeamController.cs");
        Assert.Matches(@"\[HttpPost\(""invite""\)\]\s+\[RequireStepUp\]", team);
        Assert.Matches(@"\[HttpDelete\(""members/\{userId:long\}""\)\]\s+\[RequireStepUp\]", team);
        // la aceptación pública no está en el controlador del dueño, y la transparencia y /me sí admiten admins
        Assert.Contains("team/accept", Source("PlatformSignupController.cs"));
        Assert.Matches(@"buyer/transparency""\)\]\s+\[Authorize, RequireBuyerMember\]", Source("PlatformTenantInfoController.cs"));
    }

    private static async Task<string> ScalarStr(long tenant, string sql)
    {
        await using var c = TenantNpgsql.Create(App, tenant); await c.OpenAsync();
        return (string)(await new NpgsqlCommand(sql, c).ExecuteScalarAsync())!;
    }

    /// <summary>Lee una propiedad del objeto anónimo que devuelve GetAsync.</summary>
    private static dynamic Props(PlanResult r, string name)
    {
        Assert.True(r.Ok);
        return r.Data!.GetType().GetProperty(name)!.GetValue(r.Data)!;
    }
}
