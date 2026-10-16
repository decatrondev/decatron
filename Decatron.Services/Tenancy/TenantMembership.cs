using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 4: pertenencia de una cuenta de Twitch a un tenant. La tabla users es global (sin tenant_id) y guarda UN juego de tokens por
/// persona: si alguien ya es streamer de otro tenant y entra por este, el login sobrescribiria sus tokens con los de OTRA app de Twitch.
/// Por eso (decision provisional, hasta tener tokens por tenant) una cuenta pertenece a un solo tenant. <c>channels</c> (sin RLS) es la fuente.
/// </summary>
public sealed class TenantMembership
{
    private readonly IConfiguration _cfg;
    private readonly ITenantResolver? _resolver;
    public TenantMembership(IConfiguration cfg, ITenantResolver? resolver = null) { _cfg = cfg; _resolver = resolver; }

    private NpgsqlConnection Open() => TenantNpgsql.Create(_cfg["ConnectionStrings:DefaultConnection"], 1);

    /// <summary>true si la cuenta ya tiene canales y NINGUNO es de <paramref name="tenantId"/> (entra por el tenant equivocado).</summary>
    public async Task<bool> BelongsElsewhereAsync(string twitchId, long tenantId, CancellationToken ct = default)
    {
        await using var c = Open();
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            @"SELECT count(*) FILTER (WHERE ch.tenant_id = @t), count(*)
              FROM channels ch JOIN users u ON u.id = ch.user_id WHERE u.twitch_id = @tw", c);
        cmd.Parameters.AddWithValue("t", tenantId);
        cmd.Parameters.AddWithValue("tw", twitchId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        await r.ReadAsync(ct);
        return r.GetInt64(1) > 0 && r.GetInt64(0) == 0;
    }

    /// <summary>Da de alta el canal (y la membresia) de un usuario nuevo en su tenant; sin esto el resolutor lo trataria como del #1.</summary>
    public async Task EnsureChannelAsync(long tenantId, long userId, string twitchId, string login, CancellationToken ct = default, bool addMember = true)
    {
        await using var c = Open();
        await c.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await using (var cmd = new NpgsqlCommand(
            @"INSERT INTO channels (tenant_id, platform, external_id, user_id, login)
              SELECT @t, 'twitch', @ext, @u, @login
              WHERE NOT EXISTS (SELECT 1 FROM channels WHERE user_id=@u AND platform='twitch')", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("ext", twitchId);
            cmd.Parameters.AddWithValue("u", userId);
            cmd.Parameters.AddWithValue("login", login.ToLowerInvariant());
            await cmd.ExecuteNonQueryAsync(ct);
        }
        if (addMember)
        await using (var cmd = new NpgsqlCommand(
            "INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (@t, @u, 'viewer') ON CONFLICT DO NOTHING", c, tx))
        {
            cmd.Parameters.AddWithValue("t", tenantId);
            cmd.Parameters.AddWithValue("u", userId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        (_resolver as TenantResolver)?.InvalidateCache(); // el canal nuevo se resuelve ya, sin esperar el refresco de 1 min
    }
}
