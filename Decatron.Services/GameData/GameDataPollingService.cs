using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Core.Helpers;
using Decatron.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Unico scheduler del modulo Game Overlays. Cada tick (30 s) recorre los canales
    /// EN VIVO con una instancia de overlay habilitada, resuelve el juego activo
    /// (GameDetectionService), y para cada cuenta del juego cuyo refresco venció
    /// (intervalo por tier) consulta al proveedor — a traves de GameDataCache — y
    /// actualiza la sesion. Publica el OverlayState resultante en
    /// GameOverlayStateStore y a los overlays conectados por SignalR
    /// ("GameOverlayState" en el grupo overlay_{login}).
    ///
    /// Un canal offline cuesta cero requests. Nada consulta proveedores fuera de aca.
    /// </summary>
    public class GameDataPollingService : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<GameDataPollingService> _logger;
        private readonly IStreamStatusService _streamStatus;
        private readonly GameDetectionService _detection;
        private readonly GameDataProviderRegistry _providers;
        private readonly GameOverlayStateStore _store;
        private readonly GameDataCache _cache;
        private readonly IHubContext<OverlayHub> _hub;
        private readonly TwitchApiService _twitchApi;
        private readonly LolLive.LolLiveStateStore _live;

        private static readonly TimeSpan Tick = TimeSpan.FromSeconds(30);
        private readonly ConcurrentDictionary<long, DateTime> _lastRefresh = new(); // por linked_account_id
        private readonly ConcurrentDictionary<long, bool> _forceRefresh = new();    // por userId (cambio de juego/config)
        private DateTime _lastPurge = DateTime.MinValue;

        public GameDataPollingService(
            IServiceProvider services,
            ILogger<GameDataPollingService> logger,
            IStreamStatusService streamStatus,
            GameDetectionService detection,
            GameDataProviderRegistry providers,
            GameOverlayStateStore store,
            GameDataCache cache,
            IHubContext<OverlayHub> hub,
            TwitchApiService twitchApi,
            LolLive.LolLiveStateStore live)
        {
            _live = live;
            _services = services;
            _logger = logger;
            _streamStatus = streamStatus;
            _detection = detection;
            _providers = providers;
            _store = store;
            _cache = cache;
            _hub = hub;
            _twitchApi = twitchApi;

            _detection.GameChanged += userId =>
            {
                _forceRefresh[userId] = true;
                // Canal offline: el tick no lo procesa, asi que se empuja el nuevo estado
                // (o el "oculto") a los overlays abiertos ahora mismo — si no, OBS se
                // queda mostrando el juego anterior hasta recargar.
                _ = Task.Run(() => PushOfflineStateAsync(userId));
            };
        }

        private readonly ConcurrentDictionary<(long userId, string slug), DateTime> _offlineRefresh = new();

        /// <summary>
        /// Estado para un canal OFFLINE, bajo demanda (cuando alguien abre la URL del
        /// overlay o el panel): rango real + ultimas partidas, SIN abrir sesion. Se
        /// limita a una consulta por intervalo del tier por instancia, asi abrir el
        /// overlay veinte veces mientras se configura OBS cuesta una sola request.
        /// Si el canal esta en vivo, devuelve lo que ya calculo el poller.
        /// </summary>
        public async Task<OverlayState?> GetOrBuildStateAsync(long userId, string slug, CancellationToken ct = default)
        {
            var existing = _store.Get(userId, slug);

            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user == null) return existing;

            var isLive = !string.IsNullOrEmpty(user.TwitchId) && _streamStatus.IsLive(user.TwitchId);
            if (isLive) return existing;

            var tier = await TierResolver.GetEffectiveTierAsync(db, userId);
            var limits = GameOverlayTierLimits.ForTier(tier);
            if (existing != null && _offlineRefresh.TryGetValue((userId, slug), out var last)
                && DateTime.UtcNow - last < TimeSpan.FromSeconds(limits.PollingIntervalSeconds))
                return existing;

            var config = await db.GameOverlayConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == userId && c.Slug == slug, ct);
            if (config == null || !config.IsEnabled) return null;

            if (_detection.Get(userId) == null && !string.IsNullOrEmpty(user.TwitchId))
            {
                // Offline no hay stream: leer la categoria del canal (channels, no streams).
                var channel = await _twitchApi.GetChannelAsync(user.TwitchId);
                await _detection.SetCategoryAsync(userId, "twitch", channel?.game_id, channel?.game_name);
            }

            var (game, reason) = _detection.Resolve(userId, config);
            OverlayState state;
            if (game == null)
                state = new OverlayState { Reason = "idle" };
            else
            {
                var games = GameOverlayGamesConfig.Parse(config.GamesJson);
                if (!games.TryGetValue(game, out var gameCfg) || !gameCfg.Enabled)
                    state = new OverlayState { ActiveGame = game, Reason = "unconfigured" };
                else
                {
                    var accountId = user.AccountId ?? user.Id;
                    var linked = await db.LinkedGameAccounts.AsNoTracking().Where(a => a.AccountId == accountId && a.IsActive).ToListAsync(ct);
                    var accounts = gameCfg.Accounts.Select(id => linked.FirstOrDefault(a => a.Id == id && a.Game == game)).Where(a => a != null).Select(a => a!).Take(limits.MaxAccountsPerGame).ToList();
                    if (accounts.Count == 0)
                        state = new OverlayState { ActiveGame = game, Reason = "no_accounts" };
                    else
                    {
                        var states = new List<AccountOverlayState>();
                        foreach (var account in accounts)
                        {
                            var provider = _providers.For(account);
                            var queue = gameCfg.QueueFor(account.Id);
                            var rank = await provider.GetRankAsync(account, queue, ct);
                            if (rank == null || (!provider.Capabilities.HasExactPoints && account.ManualRankJson != null))
                                rank = Providers.ManualProvider.FromManual(account) ?? rank;
                            var matches = provider.Capabilities.HasRecentMatches
                                ? await provider.GetRecentMatchesAsync(account, limits.MaxRecentMatches, null, queue, ct)
                                : Array.Empty<MatchSummary>();
                            states.Add(new AccountOverlayState
                            {
                                AccountId = account.Id, Game = account.Game,
                                DisplayName = string.IsNullOrWhiteSpace(account.DisplayName) ? account.ExternalName : account.DisplayName,
                                ExternalName = account.FullExternalName, ExternalId = account.ExternalId, Region = account.Region,
                                Rank = rank,
                                // Sin sesion (offline): el overlay oculta la fila "Hoy" y muestra solo las partidas.
                                Session = new SessionState { CurrentRank = rank, Matches = matches.ToList(), StreamStartedAt = DateTime.UtcNow, Wins = -1, Losses = -1 },
                                Stats = await SafeStatsAsync(provider, account, queue, null, ct),
                                LivePhase = _live.PhaseFor(userId, account.ExternalId),
                                UpdatedAt = DateTime.UtcNow,
                            });
                        }
                        state = new OverlayState { ActiveGame = game, Reason = "offline", ActiveAccountId = states[0].AccountId, Accounts = states };
                    }
                }
            }

            _offlineRefresh[(userId, slug)] = DateTime.UtcNow;
            _store.Set(userId, slug, state);
            return state;
        }

        /// <summary>Borra el throttle offline para que la proxima consulta recalcule (tras !setrango, etc.).</summary>
        public void InvalidateOffline(long userId)
        {
            foreach (var key in _offlineRefresh.Keys.Where(k => k.userId == userId).ToList()) _offlineRefresh.TryRemove(key, out _);
        }

        /// <summary>
        /// Estado puntual de UN juego que no es el activo (ej. "!rango valorant"
        /// mientras juega LoL): rango + partidas, sin sesion, sin tocar la deteccion
        /// ni el store. Gasta rate limit real; se usa solo desde comandos.
        /// </summary>
        public async Task<OverlayState?> BuildStateForGameAsync(long userId, GameOverlayConfig config, string game, CancellationToken ct = default)
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user == null) return null;
            var tier = await TierResolver.GetEffectiveTierAsync(db, userId);
            var limits = GameOverlayTierLimits.ForTier(tier);

            var games = GameOverlayGamesConfig.Parse(config.GamesJson);
            if (!games.TryGetValue(game, out var gameCfg) || !gameCfg.Enabled) return null;
            var accountId = user.AccountId ?? user.Id;
            var linked = await db.LinkedGameAccounts.AsNoTracking().Where(a => a.AccountId == accountId && a.IsActive).ToListAsync(ct);
            var accounts = gameCfg.Accounts.Select(id => linked.FirstOrDefault(a => a.Id == id && a.Game == game)).Where(a => a != null).Select(a => a!).Take(limits.MaxAccountsPerGame).ToList();
            if (accounts.Count == 0) return new OverlayState { ActiveGame = game, Reason = "no_accounts" };

            var states = new List<AccountOverlayState>();
            foreach (var account in accounts)
            {
                var provider = _providers.For(account);
                var queue = gameCfg.QueueFor(account.Id);
                var rank = await provider.GetRankAsync(account, queue, ct);
                if (rank == null || (!provider.Capabilities.HasExactPoints && account.ManualRankJson != null))
                    rank = Providers.ManualProvider.FromManual(account) ?? rank;
                var matches = provider.Capabilities.HasRecentMatches ? await provider.GetRecentMatchesAsync(account, 5, null, queue, ct) : Array.Empty<MatchSummary>();
                states.Add(new AccountOverlayState
                {
                    AccountId = account.Id, Game = account.Game,
                    DisplayName = string.IsNullOrWhiteSpace(account.DisplayName) ? account.ExternalName : account.DisplayName,
                    ExternalName = account.FullExternalName, ExternalId = account.ExternalId, Region = account.Region, Rank = rank,
                    Session = new SessionState { CurrentRank = rank, Matches = matches.ToList(), StreamStartedAt = DateTime.UtcNow, Wins = -1, Losses = -1 },
                    Stats = await SafeStatsAsync(provider, account, queue, null, ct),
                    LivePhase = _live.PhaseFor(userId, account.ExternalId),
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            return new OverlayState { ActiveGame = game, Reason = "adhoc", ActiveAccountId = states[0].AccountId, Accounts = states };
        }

        private async Task PushOfflineStateAsync(long userId)
        {
            try
            {
                using var scope = _services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
                if (user == null) return;
                if (!string.IsNullOrEmpty(user.TwitchId) && _streamStatus.IsLive(user.TwitchId)) return; // en vivo lo hace el tick

                InvalidateOffline(userId);
                var slugs = await db.GameOverlayConfigs.AsNoTracking().Where(c => c.UserId == userId && c.IsEnabled).Select(c => c.Slug).ToListAsync();
                foreach (var slug in slugs)
                {
                    var state = await GetOrBuildStateAsync(userId, slug);
                    if (state != null) await PublishAsync(userId, user.Login, slug, state);
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "GameOverlays: no se pudo empujar estado offline a user {UserId}", userId);
            }
        }

        /// <summary>El panel llama esto al guardar config para no esperar al proximo intervalo.</summary>
        public void RequestRefresh(long userId) => _forceRefresh[userId] = true;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🎮 GameDataPollingService iniciado (tick {Seconds}s)", Tick.TotalSeconds);
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try { await TickAsync(stoppingToken); }
                catch (OperationCanceledException) { }
                catch (Exception ex) { _logger.LogError(ex, "Error en el tick de GameDataPollingService"); }

                await Task.Delay(Tick, stoppingToken);
            }
        }

        private async Task TickAsync(CancellationToken ct)
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var sessions = scope.ServiceProvider.GetRequiredService<GameSessionService>();

            var configs = await db.GameOverlayConfigs.AsNoTracking()
                .Where(c => c.IsEnabled)
                .Join(db.Users.AsNoTracking(), c => c.UserId, u => u.Id, (c, u) => new { Config = c, User = u })
                .ToListAsync(ct);

            foreach (var group in configs.GroupBy(x => x.User.Id))
            {
                var user = group.First().User;
                var isLive = !string.IsNullOrEmpty(user.TwitchId) && _streamStatus.IsLive(user.TwitchId);
                if (!isLive)
                {
                    // Canal apagado: cerrar sesiones que hayan quedado abiertas y limpiar estado.
                    await sessions.CloseAllAsync(db, user.Id, ct);
                    foreach (var x in group) _store.Remove(user.Id, x.Config.Slug);
                    continue;
                }

                try
                {
                    // Sin estado de deteccion (backend recien arrancado o evento perdido):
                    // hidratar la categoria actual desde Helix una sola vez. Despues manda
                    // channel.update por EventSub.
                    if (_detection.Get(user.Id) == null)
                    {
                        var stream = await _twitchApi.GetStreamAsync(user.TwitchId!);
                        await _detection.SetCategoryAsync(user.Id, "twitch", stream?.game_id, stream?.game_name);
                    }

                    await ProcessChannelAsync(db, sessions, user.Id, user.Login, user.AccountId ?? user.Id, group.Select(x => x.Config).ToList(), ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "GameOverlays: error procesando canal {Login}", user.Login);
                }
            }

            if (DateTime.UtcNow - _lastPurge > TimeSpan.FromHours(6))
            {
                _lastPurge = DateTime.UtcNow;
                await _cache.PurgeExpiredAsync(ct);
            }
        }

        private async Task ProcessChannelAsync(DecatronDbContext db, GameSessionService sessions, long userId, string login, long accountId,
            List<GameOverlayConfig> instances, CancellationToken ct)
        {
            var tier = await TierResolver.GetEffectiveTierAsync(db, userId);
            var limits = GameOverlayTierLimits.ForTier(tier);
            var interval = TimeSpan.FromSeconds(limits.PollingIntervalSeconds);
            var force = _forceRefresh.TryRemove(userId, out _);

            var linked = await db.LinkedGameAccounts
                .Where(a => a.AccountId == accountId && a.IsActive)
                .ToListAsync(ct);

            foreach (var config in instances)
            {
                var (game, reason) = _detection.Resolve(userId, config);
                var previous = _store.Get(userId, config.Slug);

                if (game == null)
                {
                    var idle = new OverlayState { ActiveGame = null, Reason = "idle" };
                    if (previous?.ActiveGame != null || previous == null)
                        await PublishAsync(userId, login, config.Slug, idle);
                    continue;
                }

                var games = GameOverlayGamesConfig.Parse(config.GamesJson);
                if (!games.TryGetValue(game, out var gameCfg) || !gameCfg.Enabled)
                {
                    var idle = new OverlayState { ActiveGame = game, Reason = "unconfigured" };
                    if (previous?.Reason != "unconfigured" || previous.ActiveGame != game)
                        await PublishAsync(userId, login, config.Slug, idle);
                    continue;
                }

                // Cuentas del juego en el orden configurado, respetando el tope del tier.
                var accounts = gameCfg.Accounts
                    .Select(id => linked.FirstOrDefault(a => a.Id == id && a.Game == game))
                    .Where(a => a != null).Select(a => a!)
                    .Take(limits.MaxAccountsPerGame)
                    .ToList();

                if (accounts.Count == 0)
                {
                    var idle = new OverlayState { ActiveGame = game, Reason = "no_accounts" };
                    if (previous?.Reason != "no_accounts" || previous.ActiveGame != game)
                        await PublishAsync(userId, login, config.Slug, idle);
                    continue;
                }

                var wantLive = gameCfg.Rotation.Mode == "active_first" && limits.AllowsRotation("active_first");
                var changed = force || previous == null || previous.ActiveGame != game;
                var states = new List<AccountOverlayState>();

                foreach (var account in accounts)
                {
                    var due = force || !_lastRefresh.TryGetValue(account.Id, out var last) || DateTime.UtcNow - last >= interval;
                    var prevState = previous?.Accounts.FirstOrDefault(a => a.AccountId == account.Id);

                    if (!due && prevState != null)
                    {
                        states.Add(prevState);
                        continue;
                    }

                    var state = await RefreshAccountAsync(db, sessions, userId, account, limits, wantLive, prevState, gameCfg.QueueFor(account.Id), ct);
                    _lastRefresh[account.Id] = DateTime.UtcNow;
                    states.Add(state);
                    changed = true;
                }

                if (!changed) continue;

                var activeAccount = wantLive
                    ? states.FirstOrDefault(s => s.Live?.InGame == true)?.AccountId
                    : null;

                await PublishAsync(userId, login, config.Slug, new OverlayState
                {
                    ActiveGame = game,
                    Reason = reason,
                    ActiveAccountId = activeAccount ?? states.First().AccountId,
                    Accounts = states,
                });
            }
        }

        private async Task<AccountOverlayState> RefreshAccountAsync(DecatronDbContext db, GameSessionService sessions, long userId,
            LinkedGameAccount account, GameOverlayTierLimits limits, bool wantLive, AccountOverlayState? previous, string? queue, CancellationToken ct)
        {
            var provider = _providers.For(account);
            var state = new AccountOverlayState
            {
                AccountId = account.Id,
                Game = account.Game,
                DisplayName = string.IsNullOrWhiteSpace(account.DisplayName) ? account.ExternalName : account.DisplayName,
                ExternalName = account.FullExternalName,
                ExternalId = account.ExternalId,
                Region = account.Region,
                UpdatedAt = DateTime.UtcNow,
            };

            // Rango: si el proveedor falla, conservar el ultimo bueno (no dejar el overlay en blanco).
            var rank = await provider.GetRankAsync(account, queue, ct) ?? previous?.Rank;
            // Override manual sobre un proveedor sin puntos exactos (Valorant) o sin rango.
            if (rank == null || (!provider.Capabilities.HasExactPoints && account.ManualRankJson != null))
                rank = Providers.ManualProvider.FromManual(account) ?? rank;
            state.Rank = rank;

            var open = await sessions.GetOpenAsync(db, userId, account.Id, ct);
            var streamStartedAt = open?.StreamStartedAt ?? DateTime.UtcNow;
            var session = open ?? await sessions.GetOrOpenAsync(db, userId, account, streamStartedAt, rank, ct);

            var matches = provider.Capabilities.HasRecentMatches
                ? await provider.GetRecentMatchesAsync(account, limits.MaxRecentMatches, session.StreamStartedAt.AddMinutes(-5), queue, ct)
                : Array.Empty<MatchSummary>();

            await sessions.UpdateAsync(db, session, rank, matches, limits.MaxRecentMatches, ct);
            state.Session = sessions.ToState(session);

            if (wantLive && provider.Capabilities.HasLiveGame)
                state.Live = await provider.GetLiveGameAsync(account, ct) ?? previous?.Live;

            state.Stats = await SafeStatsAsync(provider, account, queue, previous?.Stats, ct);
            state.LivePhase = _live.PhaseFor(userId, account.ExternalId);

            return state;
        }

        /// <summary>
        /// Decatron Desktop mando algo nuevo del cliente de LoL: reemplaza la fase en vivo
        /// de la cuenta correspondiente en todos los overlays del canal y publica ya, sin
        /// esperar al tick ni tocar la Riot API. Si no hay estado (canal offline y nadie
        /// abrio el overlay), lo construye bajo demanda.
        /// </summary>
        public async Task PushLivePhaseAsync(long userId)
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return;
            var slugs = await db.GameOverlayConfigs.AsNoTracking().Where(c => c.UserId == userId && c.IsEnabled).Select(c => c.Slug).ToListAsync();
            var live = _live.Get(userId);

            // Overlay "Partida en vivo": recibe la fase cruda, sin pasar por el estado de Games.
            try { await _hub.Clients.Group($"overlay_{user.Login.ToLowerInvariant()}").SendAsync("LiveMatchState", new { state = LiveOverlayService.BuildState(live) }); }
            catch (Exception ex) { _logger.LogDebug(ex, "LiveOverlay: no se pudo notificar a overlay_{Login}", user.Login); }

            foreach (var slug in slugs)
            {
                var state = _store.Get(userId, slug);
                if (state == null || state.ActiveGame != GameIds.Lol)
                {
                    // Sin estado de LoL todavia: construirlo (respeta el throttle offline) y ya sale con la fase.
                    if (live == null) continue;
                    InvalidateOffline(userId);
                    state = await GetOrBuildStateAsync(userId, slug);
                    if (state == null || state.ActiveGame != GameIds.Lol) continue;
                }

                var changed = false;
                foreach (var acc in state.Accounts)
                {
                    var phase = _live.PhaseFor(userId, GetPuuid(acc));
                    if (!ReferenceEquals(acc.LivePhase, phase)) { acc.LivePhase = phase; changed = true; }
                }
                // Mientras el streamer esta en partida, la cuenta con el cliente abierto es la que se muestra.
                var inGame = state.Accounts.FirstOrDefault(a => a.LivePhase != null && a.LivePhase.Phase != "none");
                if (inGame != null && state.ActiveAccountId != inGame.AccountId) { state.ActiveAccountId = inGame.AccountId; changed = true; }
                if (changed || live != null) await PublishAsync(userId, user.Login, slug, state);
            }
        }

        private static string? GetPuuid(AccountOverlayState acc) => acc.ExternalId;

        /// <summary>
        /// Stats agregadas del proveedor. La primera vez para una cuenta cuesta hasta 20
        /// partidas de Riot (y puede chocar con el rate limit): no se bloquea el estado
        /// mas de unos segundos — si tarda, el fetch sigue en segundo plano, se cachea, y
        /// las stats aparecen en el siguiente refresco. Si falla, conserva las anteriores.
        /// </summary>
        private async Task<AccountStats?> SafeStatsAsync(IGameDataProvider provider, LinkedGameAccount account, string? queue, AccountStats? previous, CancellationToken ct)
        {
            try
            {
                // Token propio: si el request que disparo esto se cancela, el fetch igual termina y cachea.
                var task = provider.GetStatsAsync(account, queue, CancellationToken.None);
                var done = await Task.WhenAny(task, Task.Delay(TimeSpan.FromSeconds(6), ct));
                if (done == task) return await task ?? previous;

                _logger.LogDebug("GameOverlays: stats de {Name} siguen cargando en segundo plano", account.FullExternalName);
                _ = task.ContinueWith(t => _logger.LogDebug(t.Exception, "GameOverlays: stats de {Name} fallaron en segundo plano", account.FullExternalName),
                    TaskContinuationOptions.OnlyOnFaulted);
                return previous;
            }
            catch (OperationCanceledException) { return previous; }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "GameOverlays: stats de {Name} fallaron", account.FullExternalName);
                return previous;
            }
        }

        private async Task PublishAsync(long userId, string login, string slug, OverlayState state)
        {
            state.UpdatedAt = DateTime.UtcNow;
            _store.Set(userId, slug, state);
            try
            {
                await _hub.Clients.Group($"overlay_{login.ToLowerInvariant()}")
                    .SendAsync("GameOverlayState", new { slug, state });
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "GameOverlays: no se pudo notificar a overlay_{Login}", login);
            }
        }
    }
}
