using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Decatron.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// CRUD de live_overlay_configs (instancias del overlay "Partida en vivo", por canal)
    /// y el estado que ve ese overlay: lo último que mandó Decatron Desktop del cliente
    /// de LoL (LolLiveStateStore). El overlay es gratis para todos; lo que usa IA ya se
    /// limita en el coach por tier. Plan: LIVE_MATCH_OVERLAY_PLAN.md §3.
    /// </summary>
    public class LiveOverlayService
    {
        private const int MaxInstances = 5;
        private static readonly Regex SlugRegex = new("^[a-z0-9][a-z0-9-]{0,39}$", RegexOptions.Compiled);
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly DecatronDbContext _db;
        private readonly IHubContext<OverlayHub> _hub;
        private readonly LolLive.LolLiveStateStore _live;

        public LiveOverlayService(DecatronDbContext db, IHubContext<OverlayHub> hub, LolLive.LolLiveStateStore live)
        {
            _db = db;
            _hub = hub;
            _live = live;
        }

        /// <summary>Lo que el overlay dibuja: la fase actual del Desktop (null = sin Desktop → transparente).</summary>
        public static object BuildState(LolLive.LolLiveStateStore.Entry? live) => new
        {
            connected = live != null,
            summonerName = live?.SummonerName,
            phase = live?.Phase,
            updatedAt = DateTime.UtcNow,
        };

        public object StateFor(long userId) => BuildState(_live.Get(userId));

        public Task<List<LiveOverlayConfig>> ListAsync(long channelUserId) =>
            _db.LiveOverlayConfigs.Where(c => c.UserId == channelUserId).OrderBy(c => c.Id).ToListAsync();

        public Task<LiveOverlayConfig?> GetAsync(long channelUserId, string slug) =>
            _db.LiveOverlayConfigs.FirstOrDefaultAsync(c => c.UserId == channelUserId && c.Slug == slug);

        public async Task<(LiveOverlayConfig? config, string? error)> CreateAsync(long channelUserId, string? slug, string? name)
        {
            var count = await _db.LiveOverlayConfigs.CountAsync(c => c.UserId == channelUserId);
            if (count >= MaxInstances) return (null, $"Máximo {MaxInstances} overlays de Partida en vivo.");

            slug = string.IsNullOrWhiteSpace(slug) ? (count == 0 ? "main" : $"live-{count + 1}") : slug.Trim().ToLowerInvariant();
            if (!SlugRegex.IsMatch(slug)) return (null, "El identificador solo admite letras minúsculas, números y guiones (máx. 40).");
            if (await _db.LiveOverlayConfigs.AnyAsync(c => c.UserId == channelUserId && c.Slug == slug))
                return (null, "Ya existe un overlay con ese identificador.");

            var config = new LiveOverlayConfig
            {
                UserId = channelUserId,
                Slug = slug,
                Name = string.IsNullOrWhiteSpace(name) ? (count == 0 ? "Principal" : $"Overlay {count + 1}") : name.Trim(),
            };
            _db.LiveOverlayConfigs.Add(config);
            await _db.SaveChangesAsync();
            return (config, null);
        }

        public class UpdateRequest
        {
            public string? Name { get; set; }
            public bool? IsEnabled { get; set; }
            public JsonElement? Canvas { get; set; }
            public JsonElement? Config { get; set; }
        }

        /// <summary>Guarda la instancia. config_json se guarda tal cual (el frontend es dueño del shape); solo se acotan tamaño y escala.</summary>
        public async Task<(LiveOverlayConfig? config, string? error)> UpdateAsync(long channelUserId, string slug, UpdateRequest req)
        {
            var config = await GetAsync(channelUserId, slug);
            if (config == null) return (null, "Overlay no encontrado");

            if (req.Name != null) config.Name = req.Name.Trim().Length == 0 ? config.Name : req.Name.Trim()[..Math.Min(60, req.Name.Trim().Length)];
            if (req.IsEnabled != null) config.IsEnabled = req.IsEnabled.Value;
            if (req.Canvas != null && req.Canvas.Value.ValueKind == JsonValueKind.Object)
            {
                var w = req.Canvas.Value.TryGetProperty("width", out var wv) && wv.TryGetInt32(out var wi) ? Math.Clamp(wi, 320, 3840) : 1920;
                var h = req.Canvas.Value.TryGetProperty("height", out var hv) && hv.TryGetInt32(out var hi) ? Math.Clamp(hi, 180, 2160) : 1080;
                config.CanvasJson = JsonSerializer.Serialize(new { width = w, height = h });
            }
            if (req.Config != null && req.Config.Value.ValueKind == JsonValueKind.Object)
            {
                var node = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(req.Config.Value.GetRawText(), Json) ?? new();
                if (node.TryGetValue("size", out var sizeEl) && sizeEl.ValueKind == JsonValueKind.Object
                    && sizeEl.TryGetProperty("width", out var sw) && sw.TryGetInt32(out var swi)
                    && sizeEl.TryGetProperty("height", out var sh) && sh.TryGetInt32(out var shi))
                    node["size"] = JsonSerializer.SerializeToElement(new { width = Math.Clamp(swi, 100, 3840), height = Math.Clamp(shi, 40, 2160) });
                else node.Remove("size");
                if (node.TryGetValue("scale", out var scEl) && scEl.ValueKind == JsonValueKind.Number && scEl.TryGetDouble(out var scd))
                    node["scale"] = JsonSerializer.SerializeToElement(Math.Round(Math.Clamp(scd, 0.5, 2.0), 2));
                else node.Remove("scale");
                config.ConfigJson = JsonSerializer.Serialize(node, Json);
            }

            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await NotifyConfigChangedAsync(channelUserId, config.Slug);
            return (config, null);
        }

        public async Task<bool> DeleteAsync(long channelUserId, string slug)
        {
            var config = await GetAsync(channelUserId, slug);
            if (config == null) return false;
            _db.LiveOverlayConfigs.Remove(config);
            await _db.SaveChangesAsync();
            await NotifyConfigChangedAsync(channelUserId, slug);
            return true;
        }

        private async Task NotifyConfigChangedAsync(long channelUserId, string slug)
        {
            var login = await _db.Users.Where(u => u.Id == channelUserId).Select(u => u.Login).FirstOrDefaultAsync();
            if (string.IsNullOrEmpty(login)) return;
            try { await _hub.Clients.Group($"overlay_{login.ToLowerInvariant()}").SendAsync("LiveOverlayConfigChanged", new { slug }); }
            catch { /* overlay desconectado: lo lee al reconectar */ }
        }
    }
}
