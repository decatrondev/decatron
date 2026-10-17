using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Decatron.Services.Tenancy;

public sealed record TeamMemberRow(long UserId, string Email, string Role, long Since);
public sealed record TeamInvitationRow(long Id, string Email, long CreatedAt, long ExpiresAt);
public sealed record TeamViewerRow(string Login, string DisplayName, long Since);
public sealed record InviteOutcome(long InvitationId, string Token, string Email);
public sealed record AcceptOutcome(long UserId, string Login, string DisplayName, string Email);

/// <summary>
/// Plataforma, Fase A (Equipo): admins del tenant. El dueño invita por correo (enlace de 7 días, un solo uso); aceptar crea la cuenta de comprador del
/// invitado en ESE tenant (users con auth_provider 'email') y su fila en tenant_members con rol «admin». <c>quota.admins</c> cuenta dueño + admins +
/// invitaciones vivas y se comprueba al invitar y otra vez al aceptar. Falla cerrado. Todo el tiempo se calcula en SQL (now()) para no cruzar el
/// desfase horario legacy de Npgsql, y las horas salen como segundos Unix. Cada hecho queda en credential_access_log (provider «team»).
/// Ver .dev/plans/plataforma/FASE_A_EQUIPO_DISENO.md.
/// </summary>
public sealed class TenantTeam
{
    public const int InviteDays = 7;
    public const int MaxPending = 5;
    public const int MaxPerDay = 10;
    private const string Provider = "team", Kind = "invitation";
    private static readonly Regex EmailRx = new(@"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$", RegexOptions.Compiled);

    /// <summary>Miembros que ocupan lugar en quota.admins: todos menos los viewers (streamers que entraron por Twitch).</summary>
    public const string MembersSql = "(SELECT count(*) FROM tenant_members WHERE tenant_id=@t AND role <> 'viewer')";
    /// <summary>Invitaciones vivas (sin usar, sin cancelar y sin vencer): reservan lugar hasta que se acepten o venzan.</summary>
    public const string PendingSql = "(SELECT count(*) FROM tenant_invitations WHERE tenant_id=@t AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now())";

    private readonly string _cs;
    private readonly IEntitlements _ent;

    public TenantTeam(IConfiguration config, IEntitlements ent)
    {
        _cs = config.GetConnectionString("DefaultConnection") ?? "";
        _ent = ent;
    }

    public static string HashOf(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    public static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private async Task<NpgsqlConnection> OpenAsync(long tenantId, CancellationToken ct)
    {
        var c = TenantNpgsql.Create(_cs, tenantId);
        await c.OpenAsync(ct);
        return c;
    }

    private static async Task LogAsync(NpgsqlConnection c, NpgsqlTransaction? tx, long tenantId, string action, string actor, string purpose, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO credential_access_log (tenant_id, provider, kind, action, actor, purpose) VALUES (@t, @p, @k, @a, @actor, @purpose)", c, tx);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("p", Provider);
        cmd.Parameters.AddWithValue("k", Kind);
        cmd.Parameters.AddWithValue("a", action);
        cmd.Parameters.AddWithValue("actor", actor);
        cmd.Parameters.AddWithValue("purpose", purpose);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Un solo candado por tenant para que dos invitaciones o aceptaciones a la vez no se pasen del tope.</summary>
    private static async Task LockAsync(NpgsqlConnection c, NpgsqlTransaction tx, long tenantId, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtext('tenant_team'), @t::int)", c, tx);
        cmd.Parameters.AddWithValue("t", tenantId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<long> ScalarAsync(NpgsqlConnection c, NpgsqlTransaction? tx, string sql, long tenantId, CancellationToken ct, params (string, object)[] extra)
    {
        await using var cmd = new NpgsqlCommand(sql, c, tx);
        cmd.Parameters.AddWithValue("t", tenantId);
        foreach (var (k, v) in extra) cmd.Parameters.AddWithValue(k, v);
        return Convert.ToInt64(await cmd.ExecuteScalarAsync(ct) ?? 0L);
    }

    // ── Lectura ──

    public async Task<PlanResult> GetAsync(long tenantId, CancellationToken ct = default)
    {
        if (tenantId == 1) return PlanResult.Fail(400, "tenant_one");
        var members = new List<TeamMemberRow>();
        var invites = new List<TeamInvitationRow>();
        var viewers = new List<TeamViewerRow>();
        await using var c = await OpenAsync(tenantId, ct);
        await using (var cmd = new NpgsqlCommand(@"
            SELECT u.id, COALESCE(u.email,''), m.role, EXTRACT(EPOCH FROM m.created_at)::bigint
            FROM tenant_members m JOIN users u ON u.id = m.user_id
            WHERE m.tenant_id=@t AND m.role IN ('owner','admin')
            ORDER BY (m.role='owner') DESC, m.created_at", c))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) members.Add(new TeamMemberRow(r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetInt64(3)));
        }
        await using (var cmd = new NpgsqlCommand(@"
            SELECT id, email, EXTRACT(EPOCH FROM created_at)::bigint, EXTRACT(EPOCH FROM expires_at)::bigint
            FROM tenant_invitations WHERE tenant_id=@t AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now() ORDER BY created_at DESC", c))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) invites.Add(new TeamInvitationRow(r.GetInt64(0), r.GetString(1), r.GetInt64(2), r.GetInt64(3)));
        }
        await using (var cmd = new NpgsqlCommand(@"
            SELECT u.login, COALESCE(NULLIF(u.display_name,''), u.login), EXTRACT(EPOCH FROM m.created_at)::bigint
            FROM tenant_members m JOIN users u ON u.id = m.user_id
            WHERE m.tenant_id=@t AND m.role='viewer' ORDER BY m.created_at DESC LIMIT 500", c))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) viewers.Add(new TeamViewerRow(r.GetString(0), r.GetString(1), r.GetInt64(2)));
        }
        var limit = (await _ent.LimitAsync("quota.admins", tenantId, live: true, ct)).Limit;
        var seats = members.Count + invites.Count;
        // «No incluido en tu plan» = el plan no deja ni un lugar más allá del dueño; «lleno» = tiene lugares pero ya están ocupados.
        var included = limit is null || limit > members.Count(m => m.Role == "owner");
        var canInvite = await _ent.IsOperationalAsync(tenantId, live: true, ct) && (limit is null || seats < limit) && invites.Count < MaxPending;
        return PlanResult.Success(new { success = true, members, invitations = invites, viewers, seats = new { used = members.Count, pending = invites.Count, limit }, included, canInvite, inviteDays = InviteDays });
    }

    // ── Invitar ──

    public async Task<PlanResult> InviteAsync(long tenantId, long ownerId, string email, string locale, CancellationToken ct = default)
    {
        if (tenantId == 1) return PlanResult.Fail(400, "tenant_one");
        email = (email ?? "").Trim().ToLowerInvariant();
        if (email.Length == 0 || email.Length > 254 || !EmailRx.IsMatch(email)) return PlanResult.Fail(400, "invalid_email");
        if (!await _ent.IsOperationalAsync(tenantId, live: true, ct)) return PlanResult.Fail(403, "not_operational");

        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await LockAsync(c, tx, tenantId, ct);

        // Las vencidas ya no cuentan ni estorban a una reinvitación: se cierran aquí.
        await using (var cmd = new NpgsqlCommand("UPDATE tenant_invitations SET cancelled_at=now() WHERE tenant_id=@t AND used_at IS NULL AND cancelled_at IS NULL AND expires_at <= now()", c, tx))
        { cmd.Parameters.AddWithValue("t", tenantId); await cmd.ExecuteNonQueryAsync(ct); }

        if (await ScalarAsync(c, tx, @"SELECT count(*) FROM tenant_members m JOIN users u ON u.id=m.user_id
              WHERE m.tenant_id=@t AND m.role IN ('owner','admin') AND lower(u.email)=@e", tenantId, ct, ("e", email)) > 0)
            return PlanResult.Fail(409, "already_member");
        if (await ScalarAsync(c, tx, "SELECT count(*) FROM tenant_invitations WHERE tenant_id=@t AND lower(email)=@e AND used_at IS NULL AND cancelled_at IS NULL", tenantId, ct, ("e", email)) > 0)
            return PlanResult.Fail(409, "already_invited");

        var pending = await ScalarAsync(c, tx, "SELECT " + PendingSql, tenantId, ct);
        if (pending >= MaxPending) return PlanResult.Fail(429, "too_many_pending");
        if (await ScalarAsync(c, tx, "SELECT count(*) FROM tenant_invitations WHERE tenant_id=@t AND created_at > now() - interval '24 hours'", tenantId, ct) >= MaxPerDay)
            return PlanResult.Fail(429, "daily_limit");

        var seats = await ScalarAsync(c, tx, "SELECT " + MembersSql + " + " + PendingSql, tenantId, ct);
        var gauge = await _ent.CheckGaugeAsync("quota.admins", seats, 1, tenantId, ct);
        if (!gauge.IsAllowed) return PlanResult.Fail(403, "quota_admins");

        var token = NewToken();
        long id;
        await using (var cmd = new NpgsqlCommand(@"
            INSERT INTO tenant_invitations (tenant_id, email, token_hash, locale, invited_by, expires_at)
            VALUES (@t, @e, @h, @l, @by, now() + make_interval(days => @d)) RETURNING id", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("e", email);
            cmd.Parameters.AddWithValue("h", HashOf(token));
            cmd.Parameters.AddWithValue("l", locale == "en" ? "en" : "es");
            cmd.Parameters.AddWithValue("by", ownerId);
            cmd.Parameters.AddWithValue("d", InviteDays);
            id = (long)(await cmd.ExecuteScalarAsync(ct))!;
        }
        await LogAsync(c, tx, tenantId, "invite", "buyer:" + ownerId, "invitation:" + id, ct);
        await tx.CommitAsync(ct);
        return PlanResult.Success(new InviteOutcome(id, token, email));
    }

    public async Task<PlanResult> CancelInvitationAsync(long tenantId, long invitationId, long actorId, string reason = "cancel", CancellationToken ct = default)
    {
        if (tenantId == 1) return PlanResult.Fail(400, "tenant_one");
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await using (var cmd = new NpgsqlCommand("UPDATE tenant_invitations SET cancelled_at=now() WHERE tenant_id=@t AND id=@id AND used_at IS NULL AND cancelled_at IS NULL", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("id", invitationId);
            if (await cmd.ExecuteNonQueryAsync(ct) != 1) return PlanResult.Fail(404, "invitation_not_found");
        }
        await LogAsync(c, tx, tenantId, reason, "buyer:" + actorId, "invitation:" + invitationId, ct);
        await tx.CommitAsync(ct);
        return PlanResult.Success(new { success = true });
    }

    // ── Aceptar ──

    /// <summary>El enlace solo vale en el subdominio del tenant al que se invitó (la RLS lo acota). Un solo uso: se gasta al aceptar.</summary>
    public async Task<PlanResult> AcceptAsync(long tenantId, string token, CancellationToken ct = default)
    {
        if (tenantId == 1) return PlanResult.Fail(400, "tenant_one");
        token = (token ?? "").Trim();
        if (token.Length < 20 || token.Length > 100) return PlanResult.Fail(400, "invalid_token");
        if (!await _ent.IsOperationalAsync(tenantId, live: true, ct)) return PlanResult.Fail(403, "not_operational");

        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await LockAsync(c, tx, tenantId, ct);

        long id; string email, locale;
        await using (var cmd = new NpgsqlCommand(@"
            SELECT id, email, locale FROM tenant_invitations
            WHERE tenant_id=@t AND token_hash=@h AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now() FOR UPDATE", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("h", HashOf(token));
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return PlanResult.Fail(400, "invalid_token");
            id = r.GetInt64(0); email = r.GetString(1); locale = r.GetString(2);
        }

        if (await ScalarAsync(c, tx, @"SELECT count(*) FROM tenant_members m JOIN users u ON u.id=m.user_id
              WHERE m.tenant_id=@t AND m.role IN ('owner','admin') AND lower(u.email)=@e", tenantId, ct, ("e", email)) > 0)
            return PlanResult.Fail(409, "already_member");

        // La invitación misma ya está contada como viva: el resto es lo que ocupa lugar sin ella. Si el plan bajó mientras tanto, no entra.
        var others = await ScalarAsync(c, tx, "SELECT " + MembersSql + " + " + PendingSql + " - 1", tenantId, ct);
        var gauge = await _ent.CheckGaugeAsync("quota.admins", Math.Max(0, others), 1, tenantId, ct);
        if (!gauge.IsAllowed) return PlanResult.Fail(403, "quota_admins");

        var login = "admin-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(5)).ToLowerInvariant();
        var userId = await TenantProvisioner.CreateBuyerUserAsync(c, tx, login, email, locale, ct);
        await using (var cmd = new NpgsqlCommand("INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (@t, @u, 'admin')", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("u", userId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new NpgsqlCommand("UPDATE tenant_invitations SET used_at=now(), accepted_user_id=@u WHERE tenant_id=@t AND id=@id", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("u", userId);
            cmd.Parameters.AddWithValue("id", id);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await LogAsync(c, tx, tenantId, "accept", "buyer:" + userId, "invitation:" + id, ct);
        await tx.CommitAsync(ct);
        return PlanResult.Success(new AcceptOutcome(userId, login, email.Split('@')[0], email));
    }

    // ── Quitar ──

    /// <summary>Solo se quitan admins (no el dueño, no uno mismo). Cierra el acceso al instante: los filtros leen el rol de la base en cada llamada.</summary>
    public async Task<PlanResult> RemoveAdminAsync(long tenantId, long ownerId, long userId, CancellationToken ct = default)
    {
        if (tenantId == 1) return PlanResult.Fail(400, "tenant_one");
        if (userId == ownerId) return PlanResult.Fail(400, "cannot_remove_self");
        await using var c = await OpenAsync(tenantId, ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await using (var cmd = new NpgsqlCommand("DELETE FROM tenant_members WHERE tenant_id=@t AND user_id=@u AND role='admin'", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("u", userId);
            if (await cmd.ExecuteNonQueryAsync(ct) != 1) return PlanResult.Fail(404, "member_not_found");
        }
        // La cuenta de comprador del admin ya no sirve para nada: queda inactiva (se conserva por la auditoría). Una nueva invitación crea otra.
        await using (var cmd = new NpgsqlCommand("UPDATE users SET is_active=false, updated_at=now() WHERE id=@u AND auth_provider='email' AND tenant_id=@t", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("u", userId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await LogAsync(c, tx, tenantId, "remove", "buyer:" + ownerId, "member:" + userId, ct);
        await tx.CommitAsync(ct);
        return PlanResult.Success(new { success = true });
    }
}
