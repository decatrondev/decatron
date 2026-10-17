using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Decatron.Services.Tenancy;

public sealed record ProvisionResult(bool Ok, string? Error, long TenantId = 0, long UserId = 0);

/// <summary>
/// Fase A, pieza B: crea un tenant nuevo con su comprador (dueño) en una sola transacción: tenants, cuenta, usuario del comprador
/// (users del tenant, sin Twitch), tenant_members owner y suscripción sandbox de 7 días. Todo o nada.
/// </summary>
public sealed class TenantProvisioner
{
    public const int SandboxDays = 7;
    private readonly IConfiguration _cfg;
    private readonly ITenantResolver _resolver;

    public TenantProvisioner(IConfiguration cfg, ITenantResolver resolver) { _cfg = cfg; _resolver = resolver; }

    public async Task<ProvisionResult> CreateWithBuyerAsync(string slug, string projectName, string email, string locale, CancellationToken ct = default)
    {
        await using var c = TenantNpgsql.Create(_cfg["ConnectionStrings:DefaultConnection"], 1);
        await c.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        try
        {
            long tenantId;
            await using (var cmd = new NpgsqlCommand("INSERT INTO tenants (slug, name, status) VALUES (@s, @n, 'active') RETURNING id", c, tx))
            {
                cmd.Parameters.AddWithValue("s", slug);
                cmd.Parameters.AddWithValue("n", projectName);
                tenantId = (long)(await cmd.ExecuteScalarAsync(ct))!;
            }
            // De aqui en adelante las politicas RLS de accounts/users/tenant_subscriptions exigen el tenant nuevo (solo dentro de esta transaccion).
            await using (var cmd = new NpgsqlCommand("SELECT set_config('app.tenant_id', @t, true)", c, tx))
            {
                cmd.Parameters.AddWithValue("t", tenantId.ToString());
                await cmd.ExecuteScalarAsync(ct);
            }

            long accountId;
            await using (var cmd = new NpgsqlCommand("INSERT INTO accounts DEFAULT VALUES RETURNING id", c, tx))
                accountId = (long)(await cmd.ExecuteScalarAsync(ct))!;

            long userId;
            await using (var cmd = new NpgsqlCommand(@"
                INSERT INTO users (login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description,
                                   access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id, auth_provider, account_id, preferred_language)
                VALUES ('owner', @dn, @em, '', '', '', 0, '', '', '', now(), now(), now(), true, @uid, 'email', @acc, @lang)
                RETURNING id", c, tx))
            {
                cmd.Parameters.AddWithValue("dn", email.Split('@')[0]);
                cmd.Parameters.AddWithValue("em", email);
                cmd.Parameters.AddWithValue("uid", UniqueIdGenerator.Generate());
                cmd.Parameters.AddWithValue("acc", accountId);
                cmd.Parameters.AddWithValue("lang", locale == "en" ? "en" : "es");
                userId = (long)(await cmd.ExecuteScalarAsync(ct))!;
            }

            await using (var cmd = new NpgsqlCommand("INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (@t, @u, 'owner')", c, tx))
            {
                cmd.Parameters.AddWithValue("t", tenantId);
                cmd.Parameters.AddWithValue("u", userId);
                await cmd.ExecuteNonQueryAsync(ct);
            }

            await using (var cmd = new NpgsqlCommand(@"
                INSERT INTO tenant_subscriptions (plan_id, status, sandbox_ends_at)
                SELECT id, 'sandbox', now() + make_interval(days => @d) FROM plans WHERE key = 'sandbox'", c, tx))
            {
                cmd.Parameters.AddWithValue("d", SandboxDays);
                if (await cmd.ExecuteNonQueryAsync(ct) != 1) throw new InvalidOperationException("Falta el plan sandbox");
            }

            await tx.CommitAsync(ct);
            (_resolver as TenantResolver)?.InvalidateCache();
            return new ProvisionResult(true, null, tenantId, userId);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation && ex.ConstraintName == "tenants_slug_key")
        {
            await tx.RollbackAsync(ct);
            return new ProvisionResult(false, "slug_taken");
        }
    }

    public async Task<bool> SlugExistsAsync(string slug, CancellationToken ct = default)
    {
        await using var c = TenantNpgsql.Create(_cfg["ConnectionStrings:DefaultConnection"], 1);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT 1 FROM tenants WHERE slug = @s", c);
        cmd.Parameters.AddWithValue("s", slug);
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }
}
