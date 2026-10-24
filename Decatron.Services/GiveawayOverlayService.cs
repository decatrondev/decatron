using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services.Accounts;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Estado del giveaway para el overlay de OBS (Giveaways F3b, .dev/plans/giveaways/PLAN.md).
    /// El servidor decide todo: la fase, el ganador y los tiempos. El navegador solo dibuja. El estado se calcula desde la
    /// base (no vive en memoria), así que un refresco de OBS o un reinicio no pierde el sorteo: al conectar, el overlay
    /// pide la foto completa; después llegan eventos. Todo se emite a UN solo grupo, overlay_{OverlayKey}
    /// (ver .dev/plans/MULTIPLATAFORMA_PATRON.md).
    /// </summary>
    public class GiveawayOverlayService
    {
        public const string StateEvent = "GiveawayState";
        private const int RecentEntries = 10;
        private const int MaxCandidates = 40;

        private static readonly ConcurrentDictionary<string, string> _lastPublished = new();

        private readonly DecatronDbContext _context;
        private readonly AccountChannelResolver _accounts;
        private readonly IHubContext<OverlayHub> _hub;
        private readonly ILogger<GiveawayOverlayService> _logger;

        public GiveawayOverlayService(DecatronDbContext context, AccountChannelResolver accounts,
            IHubContext<OverlayHub> hub, ILogger<GiveawayOverlayService> logger)
        {
            _context = context;
            _accounts = accounts;
            _hub = hub;
            _logger = logger;
        }

        /// <summary>
        /// La base guarda UTC en columnas «timestamp without time zone» y Npgsql (modo legacy) las devuelve sin zona: el JSON
        /// salía sin la Z y el navegador las leía como hora local (en Lima, 5 horas adelante: la ruleta nunca arrancaba).
        /// Todo instante que sale hacia el overlay pasa por aquí.
        /// </summary>
        public static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
        public static DateTime? AsUtc(DateTime? value) => value.HasValue ? AsUtc(value.Value) : null;

        public record EntryView(string DisplayName, string Platform, DateTime EnteredAt);
        public record WinnerView(int Position, string DisplayName, string Platform, string State, DateTime? Deadline, bool WasBackup, bool Fresh = false);

        public record Snapshot(
            string Phase,
            int? SessionId,
            string? Prize,
            string? Command,
            bool AllowAutoEntry,
            bool Twitch,
            bool Kick,
            int ParticipantCount,
            DateTime? EndsAt,
            DateTime? DrawnAt,
            int RevealSeconds,
            int ResultSeconds,
            int ResponseTimeoutSeconds,
            IReadOnlyList<EntryView> Recent,
            IReadOnlyList<string> Candidates,
            IReadOnlyList<WinnerView> Winners,
            DateTime ServerNow,
            GiveawayOverlayRules Appearance,
            bool Simulated = false);

        /// <summary>A qué clave de overlay pertenece este canal de Twitch (el login de la fila principal de la cuenta).</summary>
        public async Task<string?> OverlayKeyAsync(string channelId)
        {
            var row = await _context.Users.AsNoTracking().Where(u => u.TwitchId == channelId)
                .Select(u => new { u.Id, u.Login }).FirstOrDefaultAsync();
            if (row == null) return null;
            var account = await _accounts.ResolveByUserIdAsync(row.Id);
            return account?.OverlayKey ?? row.Login;
        }

        /// <summary>Resuelve el alias del enlace del overlay a la cuenta y su giveaway (público: lo pregunta OBS).</summary>
        public async Task<(string OverlayKey, string Variant, string? TwitchId)?> ResolveAsync(string alias)
        {
            var resolved = await _accounts.ResolveAliasAsync(alias);
            if (resolved == null) return null;
            return (resolved.Account.OverlayKey, resolved.LegacyVariant, resolved.Account.TwitchId);
        }

        public async Task<Snapshot> BuildSnapshotAsync(string channelId)
        {
            var now = DateTime.UtcNow;
            var session = await _context.GiveawaySessions.AsNoTracking()
                .Where(s => s.ChannelId == channelId)
                .OrderByDescending(s => s.UpdatedAt)
                .FirstOrDefaultAsync();

            var appearance = await LoadAppearanceAsync(channelId);
            if (session == null) return Idle(now, appearance);

            var config = JsonSerializer.Deserialize<GiveawayConfig>(session.ConfigSnapshot) ?? new GiveawayConfig();
            var gs = GiveawaySettings.Parse(config.Settings);
            var reveal = Math.Max(0, appearance.RevealSeconds);
            var resultSeconds = Math.Max(0, appearance.ResultSeconds);

            var recentRows = await _context.GiveawayParticipants.AsNoTracking()
                .Where(p => p.SessionId == session.Id)
                .OrderByDescending(p => p.EnteredAt)
                .Take(RecentEntries)
                .Select(p => new { p.DisplayName, p.Platform, p.EnteredAt })
                .ToListAsync();
            var recent = recentRows.Select(p => new EntryView(p.DisplayName, p.Platform, AsUtc(p.EnteredAt))).ToList();

            var common = new Snapshot("idle", session.Id, session.PrizeName, NormalizeCommand(config.EntryCommand), config.AllowAutoEntry,
                gs.Platforms.Twitch, gs.Platforms.Kick, session.TotalParticipants, AsUtc(session.EndsAt), AsUtc(session.EndedAt), reveal, resultSeconds,
                config.WinnerResponseTimeout, recent, Array.Empty<string>(), Array.Empty<WinnerView>(), now, appearance);

            switch (session.Status)
            {
                case "active":
                    return common with { Phase = "open" };

                case "selecting_winners":
                case "completed":
                {
                    var endedAt = session.EndedAt ?? now;
                    var winners = await LoadWinnersAsync(session.Id, config.WinnerResponseTimeout, endedAt);
                    // El revelado real es lo que se esperó al sortear: el plazo de los ganadores empieza al terminar (sin overlay
                    // conectado, no hubo revelado). Para sesiones viejas, sin diferencia, no hay ruleta.
                    // Cada sorteo nuevo (el primero, un reroll, un choose posterior) reinicia EndedAt y deja a sus ganadores con
                    // SelectedAt = EndedAt + revelado: el último en elegirse marca cuándo termina la ruleta de esa ronda
                    var lastSelected = await _context.GiveawayWinners.AsNoTracking()
                        .Where(w => w.SessionId == session.Id && !w.IsBackup && !w.WasDisqualified)
                        .MaxAsync(w => (DateTime?)w.SelectedAt);
                    var revealEnds = lastSelected.HasValue && lastSelected.Value > endedAt ? lastSelected.Value : endedAt;
                    common = common with { RevealSeconds = (int)Math.Round((revealEnds - endedAt).TotalSeconds) };

                    if (now < revealEnds)
                    {
                        // La ruleta de nombres recorre candidatos reales y termina en el ganador que el servidor ya eligió
                        var candidates = await _context.GiveawayParticipants.AsNoTracking()
                            .Where(p => p.SessionId == session.Id)
                            .Select(p => p.DisplayName).Take(2000).ToListAsync();
                        return common with { Phase = "drawing", Winners = winners, Candidates = Shuffle(candidates).Take(MaxCandidates).ToList() };
                    }

                    var pending = winners.Any(w => w.State == "pending");
                    if (session.Status == "selecting_winners" || pending)
                        return common with { Phase = pending ? "winner" : "result", Winners = winners };

                    // completed: el resultado se queda ResultSeconds desde que terminó el último plazo
                    var closeAt = session.UpdatedAt.AddSeconds(resultSeconds);
                    return now < closeAt
                        ? common with { Phase = "result", Winners = winners }
                        : common with { Phase = "idle", Winners = Array.Empty<WinnerView>() };
                }

                case "cancelled":
                {
                    var closeAt = (session.EndedAt ?? session.UpdatedAt).AddSeconds(resultSeconds);
                    return now < closeAt ? common with { Phase = "cancelled" } : Idle(now, appearance);
                }

                default:
                    return Idle(now, appearance);
            }
        }

        /// <summary>Emite la foto del estado al overlay SOLO si cambió desde la última emisión.</summary>
        public async Task PublishIfChangedAsync(string channelId, bool force = false)
        {
            try
            {
                // Durante una simulación el overlay solo muestra la simulación
                if (_simulations.TryGetValue(channelId, out var simUntil) && simUntil > DateTime.UtcNow) return;
                var key = await OverlayKeyAsync(channelId);
                if (key == null) return;

                var snapshot = await BuildSnapshotAsync(channelId);
                // Sin sesión visible no se publica nada: el servicio de fondo corre una vez por tenant y cada uno solo ve sus
                // filas; publicar «idle» por un canal ajeno apagaría el overlay de otro streamer
                if (snapshot.SessionId == null) return;
                var fingerprint = JsonSerializer.Serialize(snapshot with { ServerNow = default });
                if (!force && _lastPublished.TryGetValue(channelId, out var last) && last == fingerprint) return;
                _lastPublished[channelId] = fingerprint;

                await _hub.Clients.Group($"overlay_{key}").SendAsync(StateEvent, snapshot);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo publicar el estado del giveaway de {ChannelId} al overlay", channelId);
            }
        }

        /// <summary>
        /// Pasada del servicio de fondo: revisa los giveaways activos o terminados hace poco de ESTE tenant y emite el estado
        /// si cambió (cubre las transiciones por tiempo: fin del revelado, plazos y ocultar el resultado).
        /// </summary>
        public async Task PublishRecentAsync()
        {
            var since = DateTime.UtcNow.AddMinutes(-10);
            var channels = await _context.GiveawaySessions.AsNoTracking()
                .Where(s => s.Status == "active" || s.Status == "selecting_winners" || s.UpdatedAt >= since)
                .Select(s => s.ChannelId).Distinct().ToListAsync();
            foreach (var channelId in channels)
                await PublishIfChangedAsync(channelId);
        }

        private async Task<IReadOnlyList<WinnerView>> LoadWinnersAsync(int sessionId, int timeoutSeconds, DateTime endedAt)
        {
            var rows = await (from w in _context.GiveawayWinners.AsNoTracking()
                              join p in _context.GiveawayParticipants.AsNoTracking() on w.ParticipantId equals p.Id
                              where w.SessionId == sessionId && !w.WasDisqualified
                              select new { w, p.DisplayName, p.Platform }).ToListAsync();

            // Por posición manda la fila vigente: un respaldo promovido reemplaza al titular que no respondió
            return rows.Where(r => !r.w.IsBackup)
                .GroupBy(r => r.w.Position)
                .Select(g => g.OrderByDescending(r => r.w.SelectedAt).First())
                .OrderBy(r => r.w.Position)
                .Select(r =>
                {
                    var state = r.w.HasResponded ? "responded" : r.w.TimeoutProcessed ? "timeout" : "pending";
                    // «Nueva» = elegida en el último sorteo: la ruleta aterriza en ella y no en un ganador de rondas anteriores
                    return new WinnerView(r.w.Position, r.DisplayName, r.Platform, state,
                        state == "pending" ? AsUtc(r.w.SelectedAt).AddSeconds(timeoutSeconds) : null, r.w.PromotedAt != null,
                        r.w.SelectedAt >= endedAt.AddSeconds(-2));
                })
                .ToList();
        }

        private static Snapshot Idle(DateTime now, GiveawayOverlayRules appearance) =>
            new("idle", null, null, null, false, true, false, 0, null, null, appearance.RevealSeconds, appearance.ResultSeconds, 0,
                Array.Empty<EntryView>(), Array.Empty<string>(), Array.Empty<WinnerView>(), now, appearance);

        /// <summary>Apariencia del overlay desde la configuración VIVA del streamer (no desde la copia del sorteo en curso).</summary>
        public async Task<GiveawayOverlayRules> LoadAppearanceAsync(string channelId)
        {
            var json = await _context.GiveawayConfigs.AsNoTracking()
                .Where(c => c.ChannelId == channelId).OrderByDescending(c => c.UpdatedAt)
                .Select(c => c.Settings).FirstOrDefaultAsync();
            return GiveawaySettings.Parse(json).Overlay;
        }

        // ====================================================================
        // SIMULACIÓN: corre el ciclo completo en el overlay de OBS sin tocar la base ni el chat
        // ====================================================================
        private static readonly ConcurrentDictionary<string, DateTime> _simulations = new();
        private static readonly string[] SimNames = { "Camila", "Mateo", "Valentina", "Santiago", "Lucía", "Diego", "Sofía", "Andrés",
            "Mariana", "Javier", "Daniela", "Gabriel", "Paula", "Nicolás", "Isabella", "Tomás" };

        /// <summary>Inicia la simulación. Devuelve false si hay un giveaway real en curso o ya hay otra simulación.</summary>
        public async Task<string?> StartSimulationAsync(string channelId)
        {
            var key = await OverlayKeyAsync(channelId);
            if (key == null) return "no_channel";
            if (_simulations.TryGetValue(channelId, out var until) && until > DateTime.UtcNow) return "already_running";

            var real = await _context.GiveawaySessions.AsNoTracking()
                .AnyAsync(s => s.ChannelId == channelId && (s.Status == "active" || s.Status == "selecting_winners"));
            if (real) return "real_giveaway_active";

            var a = await LoadAppearanceAsync(channelId);
            var cfg = await _context.GiveawayConfigs.AsNoTracking().Where(c => c.ChannelId == channelId)
                .OrderByDescending(c => c.UpdatedAt).FirstOrDefaultAsync();
            var gs = GiveawaySettings.Parse(cfg?.Settings);
            var command = NormalizeCommand(cfg?.EntryCommand);
            var prize = string.IsNullOrWhiteSpace(cfg?.PrizeName) ? "Premio de prueba" : cfg!.PrizeName;

            _simulations[channelId] = DateTime.UtcNow.AddMinutes(2);
            _ = Task.Run(() => RunSimulationAsync(channelId, key, a, gs.Platforms.Kick, command, prize));
            return null;
        }

        private async Task RunSimulationAsync(string channelId, string key, GiveawayOverlayRules a, bool withKick, string command, string prize)
        {
            var group = _hub.Clients.Group($"overlay_{key}");
            var entries = new List<EntryView>();
            var rnd = new Random();
            var names = SimNames.OrderBy(_ => rnd.Next()).ToList();
            var timeout = 20;

            Snapshot Frame(string phase, IReadOnlyList<string>? candidates = null, IReadOnlyList<WinnerView>? winners = null, DateTime? drawnAt = null, DateTime? endsAt = null) =>
                new(phase, 0, prize, command, false, true, withKick, entries.Count, endsAt, drawnAt, a.RevealSeconds, a.ResultSeconds, timeout,
                    entries.OrderByDescending(e => e.EnteredAt).Take(RecentEntries).ToList(), candidates ?? Array.Empty<string>(),
                    winners ?? Array.Empty<WinnerView>(), DateTime.UtcNow, a, Simulated: true);

            try
            {
                var endsAt = DateTime.UtcNow.AddSeconds(12);
                await group.SendAsync(StateEvent, Frame("open", endsAt: endsAt));
                for (var i = 0; i < 10; i++)
                {
                    await Task.Delay(900);
                    entries.Add(new EntryView(names[i], withKick && i % 3 == 2 ? "kick" : "twitch", DateTime.UtcNow));
                    await _hub.Clients.Group($"overlay_{key}").SendAsync("GiveawayParticipantJoined",
                        new { Username = names[i].ToLower(), DisplayName = names[i], Platform = entries[^1].Platform, CalculatedWeight = 1, EnteredAt = DateTime.UtcNow });
                    await group.SendAsync(StateEvent, Frame("open", endsAt: endsAt));
                }

                var winnerEntry = entries[rnd.Next(entries.Count)];
                var drawnAt = DateTime.UtcNow;
                var winner = new WinnerView(1, winnerEntry.DisplayName, winnerEntry.Platform, "pending", drawnAt.AddSeconds(a.RevealSeconds + timeout), false);
                await group.SendAsync(StateEvent, Frame("drawing", entries.Select(e => e.DisplayName).ToList(), new[] { winner }, drawnAt));

                await Task.Delay(Math.Max(0, a.RevealSeconds) * 1000);
                await group.SendAsync(StateEvent, Frame("winner", winners: new[] { winner with { Deadline = DateTime.UtcNow.AddSeconds(timeout) } }, drawnAt: drawnAt));

                await Task.Delay(6000);
                await group.SendAsync(StateEvent, Frame("result", winners: new[] { winner with { State = "responded", Deadline = null } }, drawnAt: drawnAt));

                await Task.Delay(Math.Clamp(a.ResultSeconds, 3, 10) * 1000);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en la simulación del overlay del giveaway de {Channel}", channelId);
            }
            finally
            {
                _simulations.TryRemove(channelId, out _);
                // Deja el overlay limpio; si hubiera un giveaway real, el siguiente cambio lo vuelve a mostrar
                try { await _hub.Clients.Group($"overlay_{key}").SendAsync(StateEvent, Idle(DateTime.UtcNow, a)); } catch { /* sin conexión */ }
                _lastPublished.TryRemove(channelId, out _);
            }
        }

        private static string NormalizeCommand(string? command)
        {
            var cmd = (command ?? "!join").Trim().ToLowerInvariant();
            if (cmd.Length == 0) cmd = "!join";
            return cmd.StartsWith('!') ? cmd : "!" + cmd;
        }

        private static List<string> Shuffle(List<string> items)
        {
            for (var i = items.Count - 1; i > 0; i--)
            {
                var j = RandomNumberGenerator.GetInt32(i + 1);
                (items[i], items[j]) = (items[j], items[i]);
            }
            return items;
        }
    }
}
