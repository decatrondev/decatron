using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.Platform;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    /// <summary>
    /// Lista de espera de la plataforma (decatron.top, .dev/plans/plataforma/PLATAFORMA_PLAN.md, Fase L).
    /// Alta anónima con doble confirmación por correo; lectura y exportación solo para el dueño.
    /// No crea cuentas ni tenants: solo recoge interés.
    /// </summary>
    [ApiController]
    public class PlatformWaitlistController : ControllerBase
    {
        private static readonly string[] UseCases = { "own_channel", "several_channels", "community", "other" };
        private static readonly string[] Platforms = { "twitch", "kick", "other" };
        private static readonly Regex EmailRx = new(@"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$", RegexOptions.Compiled);
        private static readonly TimeSpan ResendCooldown = TimeSpan.FromMinutes(10);
        private const int MaxPerIpPerDay = 5;

        private readonly DecatronDbContext _db;
        private readonly EmailService _email;
        private readonly IConfiguration _config;
        private readonly ILogger<PlatformWaitlistController> _log;
        private readonly IHttpClientFactory _http;

        public PlatformWaitlistController(DecatronDbContext db, EmailService email, IConfiguration config, ILogger<PlatformWaitlistController> log, IHttpClientFactory http)
        {
            _db = db; _email = email; _config = config; _log = log; _http = http;
        }

        /// <summary>Tope de correos de confirmación por 24 h. La cuota de Resend la comparte el resto del bot, así que esta lista nunca debe gastarla toda.</summary>
        private int MaxEmailsPerDay => Math.Max(0, _config.GetValue<int?>("Platform:WaitlistMaxEmailsPerDay") ?? 40);

        // Turnstile se lee en cada petición (el archivo de secretos se recarga solo): poner las claves no exige reiniciar.
        private string TurnstileSecret => _config["Turnstile:SecretKey"] ?? "";
        private string TurnstileSiteKey => _config["Turnstile:SiteKey"] ?? "";
        private bool TurnstileOn => TurnstileSecret.Length > 0 && TurnstileSiteKey.Length > 0;

        /// <summary>Verifica el desafío de Cloudflare Turnstile. Si el servicio no responde se rechaza (más seguro que dejar pasar).</summary>
        private async Task<bool> VerifyTurnstileAsync(string? token)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 2048) return false;
            try
            {
                var form = new System.Collections.Generic.Dictionary<string, string>
                {
                    ["secret"] = TurnstileSecret, ["response"] = token,
                };
                var ip = Request.Headers["CF-Connecting-IP"].ToString();
                if (!string.IsNullOrWhiteSpace(ip)) form["remoteip"] = ip;
                var client = _http.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(8);
                using var res = await client.PostAsync("https://challenges.cloudflare.com/turnstile/v0/siteverify", new FormUrlEncodedContent(form));
                var body = await res.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(body);
                return doc.RootElement.TryGetProperty("success", out var ok) && ok.GetBoolean();
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Lista de espera: no se pudo verificar Turnstile");
                return false;
            }
        }

        /// <summary>La landing pregunta aquí si debe mostrar el desafío. La clave pública solo se entrega si la secreta también está.</summary>
        [HttpGet("api/platform/config")]
        [AllowAnonymous]
        public IActionResult PublicConfig()
        {
            Response.Headers["Cache-Control"] = "public, max-age=60";
            return Ok(new { turnstileSiteKey = TurnstileOn ? TurnstileSiteKey : "" });
        }

        private string BaseUrl => (_config["Platform:BaseUrl"] ?? "https://decatron.top").TrimEnd('/');

        private string ClientIp()
        {
            var forwarded = Request.Headers["X-Forwarded-For"].ToString();
            return string.IsNullOrWhiteSpace(forwarded)
                ? HttpContext.Connection.RemoteIpAddress?.ToString() ?? "anon"
                : forwarded.Split(',')[0].Trim();
        }

        private static string Sha256(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();

        private static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');

        public class JoinRequest
        {
            public string? Email { get; set; }
            public string? UseCase { get; set; }
            public string? Platform { get; set; }
            public string? Locale { get; set; }
            /// <summary>Trampa para bots: el formulario lo deja oculto y vacío.</summary>
            public string? Website { get; set; }
            /// <summary>Respuesta del desafío de Cloudflare Turnstile (solo si está activado).</summary>
            public string? TurnstileToken { get; set; }
        }

        [HttpPost("api/platform/waitlist")]
        [AllowAnonymous]
        [EnableRateLimiting("platform-waitlist")]
        public async Task<IActionResult> Join([FromBody] JoinRequest req)
        {
            // La respuesta es siempre la misma (exista o no el correo, se envíe o no el mensaje) para no
            // revelar quién está anotado. Las únicas excepciones son errores que no dependen del correo.
            var ok = Ok(new { success = true });

            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            if (email.Length == 0 || email.Length > 254 || !EmailRx.IsMatch(email))
                return BadRequest(new { success = false, code = "invalid_email" });

            if (!string.IsNullOrEmpty(req.Website)) return ok; // bot

            // Desafío anti-bot. Va antes de tocar la base de datos o enviar nada.
            if (TurnstileOn && !await VerifyTurnstileAsync(req.TurnstileToken))
                return BadRequest(new { success = false, code = "captcha" });

            var useCase = UseCases.Contains(req.UseCase ?? "") ? req.UseCase! : "other";
            var platform = Platforms.Contains(req.Platform ?? "") ? req.Platform! : "";
            var locale = req.Locale == "en" ? "en" : "es";
            var ipHash = Sha256(ClientIp());

            var since = DateTime.UtcNow.AddDays(-1);
            if (await _db.PlatformWaitlist.CountAsync(w => w.IpHash == ipHash && w.CreatedAt >= since) >= MaxPerIpPerDay)
                return ok;

            var entry = await _db.PlatformWaitlist.FirstOrDefaultAsync(w => w.Email == email);
            if (entry != null && entry.ConfirmedAt != null) return ok;
            if (entry?.LastEmailAt != null && DateTime.UtcNow - entry.LastEmailAt < ResendCooldown) return ok;

            // Tope global: a partir de aquí se va a enviar un correo. Si ya salieron demasiados en 24 h no se guarda ni se envía nada,
            // y la persona ve un aviso para volver más tarde. Así un ataque no puede gastar la cuota de Resend del resto del bot.
            if (await _db.PlatformWaitlistEmails.CountAsync(m => m.SentAt >= since) >= MaxEmailsPerDay)
            {
                _log.LogWarning("Lista de espera: tope diario de correos alcanzado ({Max})", MaxEmailsPerDay);
                return StatusCode(503, new { success = false, code = "busy" });
            }

            if (entry == null)
            {
                entry = new PlatformWaitlistEntry { Email = email, IpHash = ipHash };
                _db.PlatformWaitlist.Add(entry);
            }

            entry.UseCase = useCase; entry.Platform = platform; entry.Locale = locale;
            var token = NewToken();
            entry.ConfirmTokenHash = Sha256(token);
            entry.LastEmailAt = DateTime.UtcNow;
            _db.PlatformWaitlistEmails.Add(new PlatformWaitlistEmail()); // se cuenta aunque Resend falle: el intento también gasta cuota
            try
            {
                await _db.SaveChangesAsync();
                // Limpieza oportunista del contador: solo hacen falta las últimas 24 h.
                await _db.PlatformWaitlistEmails.Where(m => m.SentAt < DateTime.UtcNow.AddDays(-7)).ExecuteDeleteAsync();
            }
            catch (DbUpdateException) { return ok; } // dos altas simultáneas del mismo correo

            var (subject, html) = BuildConfirmationEmail(locale, $"{BaseUrl}/lista-de-espera/confirmar?token={token}");
            var (sent, _, error) = await _email.SendEmailAsync(email, subject, html, "Decatron <support@decatron.net>");
            if (!sent) _log.LogWarning("Lista de espera: no se pudo enviar la confirmación ({Error})", error);
            return ok;
        }

        public class ConfirmRequest { public string? Token { get; set; } }

        [HttpPost("api/platform/waitlist/confirm")]
        [AllowAnonymous]
        [EnableRateLimiting("platform-waitlist")]
        public async Task<IActionResult> Confirm([FromBody] ConfirmRequest req)
        {
            var token = (req.Token ?? "").Trim();
            if (token.Length < 20 || token.Length > 100) return BadRequest(new { success = false, code = "invalid_token" });

            var hash = Sha256(token);
            var entry = await _db.PlatformWaitlist.FirstOrDefaultAsync(w => w.ConfirmTokenHash == hash);
            if (entry == null) return BadRequest(new { success = false, code = "invalid_token" });

            entry.ConfirmedAt ??= DateTime.UtcNow;
            entry.ConfirmTokenHash = ""; // un solo uso
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ── Admin (solo dueño) ──

        [HttpGet("api/admin/platform/waitlist")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 200);
            var total = await _db.PlatformWaitlist.CountAsync();
            var confirmed = await _db.PlatformWaitlist.CountAsync(w => w.ConfirmedAt != null);
            var byUse = await _db.PlatformWaitlist.Where(w => w.ConfirmedAt != null).GroupBy(w => w.UseCase)
                .Select(g => new { useCase = g.Key, count = g.Count() }).ToListAsync();
            var items = await _db.PlatformWaitlist.OrderByDescending(w => w.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(w => new { w.Id, w.Email, w.UseCase, w.Platform, w.Locale, confirmed = w.ConfirmedAt != null, w.ConfirmedAt, w.CreatedAt })
                .ToListAsync();
            return Ok(new { success = true, total, confirmed, byUse, page, pageSize, items });
        }

        [HttpGet("api/admin/platform/waitlist/export")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> Export([FromQuery] bool onlyConfirmed = true)
        {
            var rows = await _db.PlatformWaitlist.Where(w => !onlyConfirmed || w.ConfirmedAt != null)
                .OrderBy(w => w.CreatedAt).ToListAsync();
            var sb = new StringBuilder("email,use_case,platform,locale,confirmed_at,created_at\n");
            // Un correo que empieza con = + - @ se neutraliza para que una hoja de cálculo no lo ejecute como fórmula.
            static string Csv(string s) => "\"" + ("=+-@".Contains(s.FirstOrDefault()) ? "'" + s : s).Replace("\"", "\"\"") + "\"";
            foreach (var w in rows)
                sb.Append(Csv(w.Email)).Append(',').Append(Csv(w.UseCase)).Append(',').Append(Csv(w.Platform)).Append(',')
                  .Append(Csv(w.Locale)).Append(',').Append(w.ConfirmedAt?.ToString("o") ?? "").Append(',').Append(w.CreatedAt.ToString("o")).Append('\n');
            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv; charset=utf-8", $"waitlist-{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        [HttpDelete("api/admin/platform/waitlist/{id:long}")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> Remove(long id)
        {
            var e = await _db.PlatformWaitlist.FindAsync(id);
            if (e == null) return NotFound(new { success = false });
            _db.PlatformWaitlist.Remove(e);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        private static (string subject, string html) BuildConfirmationEmail(string locale, string link)
        {
            var safe = WebUtility.HtmlEncode(link);
            if (locale == "en")
                return ("Confirm your spot on the Decatron waitlist",
                    $"<div style=\"font-family:Arial,sans-serif;max-width:480px;color:#12151c\"><h2 style=\"margin:0 0 12px\">One more step</h2>" +
                    $"<p>Confirm your email to join the Decatron platform waitlist. We will write to you when accounts open.</p>" +
                    $"<p><a href=\"{safe}\" style=\"display:inline-block;background:#2f5fc6;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold\">Confirm my email</a></p>" +
                    $"<p style=\"color:#5b6475;font-size:13px\">If you did not ask for this, you can ignore this message.</p></div>");
            return ("Confirma tu lugar en la lista de espera de Decatron",
                $"<div style=\"font-family:Arial,sans-serif;max-width:480px;color:#12151c\"><h2 style=\"margin:0 0 12px\">Un paso más</h2>" +
                $"<p>Confirma tu correo para entrar a la lista de espera de la plataforma de Decatron. Te escribiremos cuando abramos cuentas.</p>" +
                $"<p><a href=\"{safe}\" style=\"display:inline-block;background:#2f5fc6;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold\">Confirmar mi correo</a></p>" +
                $"<p style=\"color:#5b6475;font-size:13px\">Si no lo pediste, puedes ignorar este mensaje.</p></div>");
        }
    }
}
