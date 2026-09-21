using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Services.GameData.Riot;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Cuentas de juego de la PERSONA (linked_game_accounts): vincular, verificar
    /// (icono de invocador en Riot), editar, borrar. Generaliza lo que hacia
    /// RiotAccountController solo para LoL. Una cuenta de Riot verificada en un
    /// juego queda verificada en los otros juegos de Riot (mismo PUUID).
    /// </summary>
    public class GameAccountService
    {
        private static readonly int[] ChallengeIconPool = { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28 };
        private static readonly Random Rng = new();
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly DecatronDbContext _db;
        private readonly GameDataProviderRegistry _providers;
        private readonly RiotApiClient _riot;
        private readonly RiotApiKeys _riotKeys;
        private readonly GameDataPollingService _poller;

        public GameAccountService(DecatronDbContext db, GameDataProviderRegistry providers, RiotApiClient riot, RiotApiKeys riotKeys, GameDataPollingService poller)
        {
            _db = db;
            _providers = providers;
            _riot = riot;
            _riotKeys = riotKeys;
            _poller = poller;
        }

        public async Task<long> EffectiveAccountIdAsync(long userId)
        {
            var accountId = await _db.Users.Where(u => u.Id == userId).Select(u => u.AccountId).FirstOrDefaultAsync();
            return accountId ?? userId;
        }

        public Task<List<LinkedGameAccount>> ListAsync(long accountId) =>
            _db.LinkedGameAccounts.Where(a => a.AccountId == accountId).OrderBy(a => a.Game).ThenBy(a => a.SortOrder).ThenBy(a => a.Id).ToListAsync();

        public object ToDto(LinkedGameAccount a) => new
        {
            a.Id, a.Game, a.Provider,
            displayName = string.IsNullOrWhiteSpace(a.DisplayName) ? a.ExternalName : a.DisplayName,
            a.ExternalName, a.ExternalTag, fullName = a.FullExternalName, a.Region,
            verified = a.VerifiedAt != null,
            verificationPending = a.VerificationChallengeIconId != null,
            a.VerificationChallengeIconId,
            manualRank = string.IsNullOrWhiteSpace(a.ManualRankJson) ? null : JsonSerializer.Deserialize<ManualRank>(a.ManualRankJson, Json),
            a.SortOrder, a.IsActive, a.CreatedAt,
            hasApi = _providers.HasApi(a.Game) && a.Provider != GameProviders.Manual,
        };

        public class LinkRequest
        {
            public string Game { get; set; } = "";
            public string Name { get; set; } = "";
            public string? Tag { get; set; }
            public string? Region { get; set; }
            public string? DisplayName { get; set; }
        }

        /// <summary>
        /// Vincula una cuenta. Con API: resuelve id externo y (Riot) arranca el reto
        /// de icono. Sin API: fila manual. Respeta el tope de cuentas por juego del tier.
        /// </summary>
        public async Task<(LinkedGameAccount? account, string? error)> LinkAsync(long userId, LinkRequest req)
        {
            if (!GameIds.IsKnown(req.Game)) return (null, "Juego desconocido");
            if (string.IsNullOrWhiteSpace(req.Name)) return (null, "El nombre de la cuenta es requerido");

            var accountId = await EffectiveAccountIdAsync(userId);
            var tier = await TierResolver.GetEffectiveTierAsync(_db, userId);
            var limits = GameOverlayTierLimits.ForTier(tier);
            var count = await _db.LinkedGameAccounts.CountAsync(a => a.AccountId == accountId && a.Game == req.Game);
            if (count >= limits.MaxAccountsPerGame)
                return (null, $"Tu plan permite {limits.MaxAccountsPerGame} cuenta(s) por juego. Sube de tier para vincular más.");

            var provider = _providers.ForGame(req.Game);
            var (resolved, error) = await provider.ResolveAsync(req.Name, req.Tag, req.Region);
            if (resolved == null) return (null, error ?? "No se pudo resolver la cuenta");

            var isManual = provider.Provider == GameProviders.Manual;
            if (!isManual)
            {
                var dup = await _db.LinkedGameAccounts.AnyAsync(a => a.AccountId == accountId && a.Game == req.Game && a.Provider == provider.Provider && a.ExternalId == resolved.ExternalId);
                if (dup) return (null, "Esa cuenta ya está vinculada");

                var takenByOther = await _db.LinkedGameAccounts.AnyAsync(a => a.Provider == provider.Provider && a.Game == req.Game && a.ExternalId == resolved.ExternalId && a.VerifiedAt != null && a.AccountId != accountId);
                if (takenByOther) return (null, "Esa cuenta ya está verificada por otro usuario");
            }

            var account = new LinkedGameAccount
            {
                AccountId = accountId,
                Game = req.Game,
                Provider = provider.Provider,
                DisplayName = req.DisplayName?.Trim() ?? "",
                ExternalName = resolved.ExternalName,
                ExternalTag = resolved.ExternalTag,
                ExternalId = resolved.ExternalId,
                Region = resolved.Region,
                SortOrder = count,
            };

            if (provider.Capabilities.RequiresVerification)
            {
                // Riot: si este PUUID ya esta verificado por la misma persona en otro juego
                // de Riot (lol/tft/valorant comparten cuenta), hereda la verificacion.
                var verifiedElsewhere = provider.Provider == GameProviders.Riot && await _db.LinkedGameAccounts.AnyAsync(a =>
                    a.AccountId == accountId && a.Provider == GameProviders.Riot && a.ExternalId == resolved.ExternalId && a.VerifiedAt != null);
                if (verifiedElsewhere)
                    account.VerifiedAt = DateTime.UtcNow;
                else
                {
                    account.VerificationChallengeIconId = ChallengeIconPool[Rng.Next(ChallengeIconPool.Length)];
                    account.VerificationStartedAt = DateTime.UtcNow;
                }
            }
            else
            {
                account.VerifiedAt = DateTime.UtcNow; // datos publicos / manual: no hay que probar propiedad
            }

            _db.LinkedGameAccounts.Add(account);
            await _db.SaveChangesAsync();
            return (account, null);
        }

        /// <summary>Verificacion por icono de invocador (Riot). Hoy solo LoL tiene key; TFT/Valorant usan la misma cuenta.</summary>
        public async Task<(bool ok, string message)> VerifyAsync(long userId, long id)
        {
            var accountId = await EffectiveAccountIdAsync(userId);
            var account = await _db.LinkedGameAccounts.FirstOrDefaultAsync(a => a.Id == id && a.AccountId == accountId);
            if (account == null) return (false, "Cuenta no encontrada");
            if (account.VerifiedAt != null) return (true, "Ya estaba verificada");
            if (account.VerificationChallengeIconId == null) return (false, "Esta cuenta no tiene una verificación en curso");
            if (account.Provider != GameProviders.Riot || string.IsNullOrEmpty(account.Region)) return (false, "Esta cuenta no requiere verificación");

            // El icono se lee con summoner-v4 de LoL: la key de LoL sirve para verificar
            // cualquier cuenta de Riot aunque el juego elegido sea TFT/Valorant.
            var key = _riotKeys.ForGame(GameIds.Lol);
            if (key == null) return (false, "La plataforma no tiene una Riot API key configurada — intenta más tarde");

            var (ok, currentIconId, _) = await _riot.GetProfileIconIdAsync(account.Region, account.ExternalId, key);
            if (!ok) return (false, "No se pudo consultar la cuenta en Riot ahora mismo — intenta de nuevo en un rato");
            if (currentIconId != account.VerificationChallengeIconId)
                return (false, $"Todavía no vemos ese icono en la cuenta (vemos el {currentIconId}, se pidió el {account.VerificationChallengeIconId}) — verifica que sea el icono correcto y que se haya guardado en el cliente.");

            var takenByOther = await _db.LinkedGameAccounts.AnyAsync(a => a.Provider == GameProviders.Riot && a.ExternalId == account.ExternalId && a.VerifiedAt != null && a.AccountId != accountId);
            if (takenByOther) return (false, "Esa cuenta de Riot ya está verificada por otro usuario");

            var now = DateTime.UtcNow;
            // Verificar todas las filas de Riot de esta persona con el mismo PUUID (lol/tft/valorant).
            var siblings = await _db.LinkedGameAccounts.Where(a => a.AccountId == accountId && a.Provider == GameProviders.Riot && a.ExternalId == account.ExternalId).ToListAsync();
            foreach (var s in siblings)
            {
                s.VerifiedAt ??= now;
                s.VerificationChallengeIconId = null;
                s.UpdatedAt = now;
            }
            await _db.SaveChangesAsync();
            return (true, "Cuenta verificada");
        }

        public class UpdateRequest
        {
            public string? DisplayName { get; set; }
            public int? SortOrder { get; set; }
            public bool? IsActive { get; set; }
            /// <summary>null = no tocar; objeto vacio {} = borrar el rango manual.</summary>
            public ManualRank? ManualRank { get; set; }
            public bool ClearManualRank { get; set; }
        }

        public async Task<(LinkedGameAccount? account, string? error)> UpdateAsync(long userId, long id, UpdateRequest req)
        {
            var accountId = await EffectiveAccountIdAsync(userId);
            var account = await _db.LinkedGameAccounts.FirstOrDefaultAsync(a => a.Id == id && a.AccountId == accountId);
            if (account == null) return (null, "Cuenta no encontrada");

            if (req.DisplayName != null) account.DisplayName = req.DisplayName.Trim()[..Math.Min(100, req.DisplayName.Trim().Length)];
            if (req.SortOrder != null) account.SortOrder = req.SortOrder.Value;
            if (req.IsActive != null) account.IsActive = req.IsActive.Value;
            if (req.ClearManualRank) { account.ManualRankJson = null; account.ManualUpdatedAt = DateTime.UtcNow; }
            else if (req.ManualRank != null) await SetManualRankAsync(account, req.ManualRank, save: false);

            account.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            _poller.RequestRefresh(userId);
            return (account, null);
        }

        /// <summary>!setrango / panel: fija el rango manual (tier en mayusculas, division opcional).</summary>
        public async Task SetManualRankAsync(LinkedGameAccount account, ManualRank rank, bool save = true)
        {
            rank.Tier = (rank.Tier ?? "UNRANKED").Trim().ToUpperInvariant().Replace(' ', '_');
            rank.Division = string.IsNullOrWhiteSpace(rank.Division) ? null : rank.Division.Trim().ToUpperInvariant();
            account.ManualRankJson = JsonSerializer.Serialize(rank, Json);
            account.ManualUpdatedAt = DateTime.UtcNow;
            account.UpdatedAt = DateTime.UtcNow;
            if (save) await _db.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(long userId, long id)
        {
            var accountId = await EffectiveAccountIdAsync(userId);
            var account = await _db.LinkedGameAccounts.FirstOrDefaultAsync(a => a.Id == id && a.AccountId == accountId);
            if (account == null) return false;

            // No dejar participantes de torneo apuntando a una cuenta borrada.
            var usedInTournament = await _db.TournamentParticipants.AnyAsync(p => p.LinkedRiotAccountId == id);
            if (usedInTournament)
            {
                account.IsActive = false; // se conserva por integridad del torneo, deja de mostrarse
                account.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _db.LinkedGameAccounts.Remove(account);
            }
            await _db.SaveChangesAsync();
            _poller.RequestRefresh(userId);
            return true;
        }

        /// <summary>Catalogo de juegos para el panel: cual tiene API y que necesita al vincular.</summary>
        public IEnumerable<object> Catalog() => _providers.All().Select(x => new
        {
            game = x.game,
            provider = x.provider.Provider,
            hasApi = _providers.HasApi(x.game),
            capabilities = x.provider.Capabilities,
        });
    }
}
