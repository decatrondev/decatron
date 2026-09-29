using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Decatron.Core.Models.GameOverlays;
using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services.GameData;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Decatron.Controllers
{
    /// <summary>
    /// Vinculo verificado de la cuenta de Epic con el login oficial de Epic (Epic Account
    /// Services, OAuth con permiso basic_profile). Torneos de Fortnite F1, ver
    /// .dev/torneos/15-fortnite.md §1 y §6. App aprobada por Epic el 2026-09-29.
    ///
    /// Flujo (documentacion de Epic, web-api-ref/authentication):
    ///   1. GET  /api/me/epic/login-url      -> URL de www.epicgames.com/id/authorize con state
    ///   2. Epic vuelve a /api/auth/epic/callback?code&state
    ///   3. POST api.epicgames.dev/epic/oauth/v2/token (Basic client_id:secret) -> account_id
    ///   4. GET  api.epicgames.dev/epic/id/v2/accounts?accountId= -> displayName
    /// El resultado queda en linked_game_accounts (game fortnite, provider epic, verificada).
    /// </summary>
    [ApiController]
    public class EpicAuthController : ControllerBase
    {
        private const string AuthorizeUrl = "https://www.epicgames.com/id/authorize";
        private const string TokenUrl = "https://api.epicgames.dev/epic/oauth/v2/token";
        private const string AccountsUrl = "https://api.epicgames.dev/epic/id/v2/accounts";
        private static readonly TimeSpan StateTtl = TimeSpan.FromMinutes(10);

        private readonly DecatronDbContext _db;
        private readonly IConfiguration _config;
        private readonly IMemoryCache _cache;
        private readonly IHttpClientFactory _http;
        private readonly GameAccountService _accounts;
        private readonly ILogger<EpicAuthController> _logger;

        public EpicAuthController(DecatronDbContext db, IConfiguration config, IMemoryCache cache, IHttpClientFactory http, GameAccountService accounts, ILogger<EpicAuthController> logger)
        {
            _db = db;
            _config = config;
            _cache = cache;
            _http = http;
            _accounts = accounts;
            _logger = logger;
        }

        private string ClientId => _config["EpicSettings:ClientId"] ?? "";
        private string ClientSecret => _config["EpicSettings:ClientSecret"] ?? "";
        private string RedirectUri => _config["EpicSettings:RedirectUri"] ?? "https://decatron.net/api/auth/epic/callback";

        // Mientras el secreto no este cargado (o siga el texto de ejemplo) el boton no se ofrece.
        private bool IsConfigured =>
            !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret) && !ClientSecret.StartsWith("PEGAR_AQUI");

        private record PendingLogin(long UserId, string ReturnTo);

        /// <summary>Solo rutas propias del sitio, para que el state no sirva de redireccion abierta.</summary>
        private static string SafeReturnTo(string? returnTo) =>
            !string.IsNullOrWhiteSpace(returnTo) && returnTo.StartsWith('/') && !returnTo.StartsWith("//") && !returnTo.Contains('\\')
                ? returnTo
                : "/settings";

        [HttpGet("api/me/epic/status")]
        [Authorize]
        public IActionResult Status() => Ok(new { success = true, available = IsConfigured });

        [HttpGet("api/me/epic/login-url")]
        [Authorize]
        public IActionResult LoginUrl([FromQuery] string? returnTo)
        {
            if (!IsConfigured)
                return BadRequest(new { success = false, message = "El inicio de sesión con Epic todavía no está disponible" });
            if (!long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();

            var state = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
            _cache.Set("epic-oauth:" + state, new PendingLogin(userId, SafeReturnTo(returnTo)), StateTtl);

            var url = $"{AuthorizeUrl}?client_id={Uri.EscapeDataString(ClientId)}&redirect_uri={Uri.EscapeDataString(RedirectUri)}" +
                      $"&response_type=code&scope=basic_profile&state={state}";
            return Ok(new { success = true, url });
        }

        /// <summary>Epic vuelve aca. Sin sesion propia: el state dice quien es.</summary>
        [HttpGet("api/auth/epic/callback")]
        [AllowAnonymous]
        public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
        {
            if (string.IsNullOrEmpty(state) || !_cache.TryGetValue("epic-oauth:" + state, out PendingLogin? pending) || pending == null)
                return Redirect("/settings?epic=error&reason=" + Uri.EscapeDataString("El enlace venció: vuelve a intentarlo"));
            _cache.Remove("epic-oauth:" + state);

            string Back(bool ok, string? reason = null)
            {
                var sep = pending.ReturnTo.Contains('?') ? "&" : "?";
                return pending.ReturnTo + sep + "epic=" + (ok ? "ok" : "error") + (reason == null ? "" : "&reason=" + Uri.EscapeDataString(reason));
            }

            if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code))
                return Redirect(Back(false, "Cancelaste el inicio de sesión con Epic"));

            var (accountId, displayName, fetchError) = await ExchangeAsync(code);
            if (accountId == null)
                return Redirect(Back(false, fetchError ?? "Epic no respondió: vuelve a intentarlo"));

            var saveError = await SaveVerifiedAccountAsync(pending.UserId, accountId, displayName ?? accountId);
            return Redirect(saveError == null ? Back(true) : Back(false, saveError));
        }

        private async Task<(string? accountId, string? displayName, string? error)> ExchangeAsync(string code)
        {
            try
            {
                var http = _http.CreateClient();
                http.Timeout = TimeSpan.FromSeconds(15);

                using var tokenReq = new HttpRequestMessage(HttpMethod.Post, TokenUrl);
                tokenReq.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                    Convert.ToBase64String(Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}")));
                tokenReq.Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "authorization_code",
                    ["code"] = code,
                    ["redirect_uri"] = RedirectUri,
                });
                using var tokenRes = await http.SendAsync(tokenReq);
                var tokenJson = await tokenRes.Content.ReadAsStringAsync();
                if (!tokenRes.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[EpicAuth] token {Status}: {Body}", (int)tokenRes.StatusCode, tokenJson.Length > 300 ? tokenJson[..300] : tokenJson);
                    return (null, null, "Epic rechazó el inicio de sesión: vuelve a intentarlo");
                }

                var token = JsonNode.Parse(tokenJson);
                var accessToken = token?["access_token"]?.GetValue<string>();
                var accountId = token?["account_id"]?.GetValue<string>();
                if (string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(accountId))
                    return (null, null, "Epic no devolvió la cuenta");

                // El nombre visible; si falla, igual se vincula (queda el id y se corrige despues).
                string? displayName = null;
                using var accReq = new HttpRequestMessage(HttpMethod.Get, $"{AccountsUrl}?accountId={Uri.EscapeDataString(accountId)}");
                accReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                using var accRes = await http.SendAsync(accReq);
                if (accRes.IsSuccessStatusCode)
                {
                    var list = JsonNode.Parse(await accRes.Content.ReadAsStringAsync()) as JsonArray;
                    displayName = list?.FirstOrDefault(n => n?["accountId"]?.GetValue<string>() == accountId)?["displayName"]?.GetValue<string>();
                }
                else
                {
                    _logger.LogWarning("[EpicAuth] accounts {Status}", (int)accRes.StatusCode);
                }

                return (accountId, displayName, null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[EpicAuth] Error hablando con Epic");
                return (null, null, "Epic no respondió: vuelve a intentarlo");
            }
        }

        /// <summary>
        /// Guarda la cuenta verificada. Si la persona ya tenia esa cuenta cargada a mano
        /// (mismo nombre), esa fila pasa a verificada: asi sus inscripciones de torneo
        /// quedan verificadas sin tener que cambiar de cuenta.
        /// </summary>
        private async Task<string?> SaveVerifiedAccountAsync(long userId, string epicAccountId, string displayName)
        {
            var accountId = await _accounts.EffectiveAccountIdAsync(userId);

            var takenByOther = await _db.LinkedGameAccounts.AnyAsync(a =>
                a.Provider == GameProviders.Epic && a.Game == GameIds.Fortnite && a.ExternalId == epicAccountId && a.VerifiedAt != null && a.AccountId != accountId);
            if (takenByOther) return "Esa cuenta de Epic ya está vinculada y verificada por otro usuario";

            var now = DateTime.UtcNow;
            var row = await _db.LinkedGameAccounts.FirstOrDefaultAsync(a =>
                a.AccountId == accountId && a.Game == GameIds.Fortnite && a.Provider == GameProviders.Epic && a.ExternalId == epicAccountId);
            row ??= await _db.LinkedGameAccounts.FirstOrDefaultAsync(a =>
                a.AccountId == accountId && a.Game == GameIds.Fortnite && a.Provider == GameProviders.Manual && a.ExternalName.ToLower() == displayName.ToLower());

            if (row == null)
            {
                var count = await _db.LinkedGameAccounts.CountAsync(a => a.AccountId == accountId && a.Game == GameIds.Fortnite);
                row = new LinkedGameAccount { AccountId = accountId, Game = GameIds.Fortnite, SortOrder = count };
                _db.LinkedGameAccounts.Add(row);
            }

            row.Provider = GameProviders.Epic;
            row.ExternalId = epicAccountId;
            row.ExternalName = displayName;
            row.VerifiedAt = now;
            row.IsActive = true;
            row.UpdatedAt = now;
            await _db.SaveChangesAsync();

            // Las inscripciones de torneo que usan esta cuenta pasan a verificadas.
            var participants = await _db.TournamentParticipants.Where(p => p.GameAccountId == row.Id).ToListAsync();
            // No se les cambia el nombre: si la fila venia de una carga a mano, ya es el mismo.
            foreach (var p in participants) p.GameAccountVerified = true;
            if (participants.Count > 0) await _db.SaveChangesAsync();

            _logger.LogInformation("[EpicAuth] Cuenta de Epic {Name} verificada para account {AccountId}", displayName, accountId);
            return null;
        }
    }
}
