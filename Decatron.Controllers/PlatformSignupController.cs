using System;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.Platform;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Controllers
{
    /// <summary>
    /// Fase A, piezas B y C (.dev/plans/plataforma/FASE_A_BC_DISENO.md): registro del comprador con enlace por correo
    /// (el tenant nace solo al confirmar el correo) y entrada posterior del comprador por enlace.
    /// Las respuestas no dependen de si el correo existe, para no revelar quién tiene cuenta.
    /// </summary>
    [ApiController]
    public class PlatformSignupController : ControllerBase
    {
        private static readonly Regex EmailRx = new(@"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$", RegexOptions.Compiled);
        private static readonly TimeSpan SignupLinkLife = TimeSpan.FromMinutes(30);
        private static readonly TimeSpan LoginLinkLife = TimeSpan.FromMinutes(15);
        private static readonly TimeSpan ResendCooldown = TimeSpan.FromMinutes(10);
        private const int MaxPerIpPerDay = 5;
        private const int MaxPerEmailPerDay = 3;

        private readonly DecatronDbContext _db;
        private readonly EmailService _email;
        private readonly IConfiguration _config;
        private readonly ILogger<PlatformSignupController> _log;
        private readonly TurnstileVerifier _turnstile;
        private readonly TenantProvisioner _provisioner;
        private readonly BuyerSessions _sessions;

        public PlatformSignupController(DecatronDbContext db, EmailService email, IConfiguration config, ILogger<PlatformSignupController> log,
            TurnstileVerifier turnstile, TenantProvisioner provisioner, BuyerSessions sessions)
        {
            _db = db; _email = email; _config = config; _log = log; _turnstile = turnstile; _provisioner = provisioner; _sessions = sessions;
        }

        /// <summary>Misma cuenta de correos por día que la lista de espera (la cuota de Resend la comparte todo el bot).</summary>
        private int MaxEmailsPerDay => Math.Max(0, _config.GetValue<int?>("Platform:WaitlistMaxEmailsPerDay") ?? 40);
        private string RootUrl => (_config["Platform:BaseUrl"] ?? "https://decatron.top").TrimEnd('/');

        private string ClientIp()
        {
            var cf = Request.Headers["CF-Connecting-IP"].ToString();
            if (!string.IsNullOrWhiteSpace(cf)) return cf.Trim();
            var forwarded = Request.Headers["X-Forwarded-For"].ToString();
            return string.IsNullOrWhiteSpace(forwarded) ? HttpContext.Connection.RemoteIpAddress?.ToString() ?? "anon" : forwarded.Split(',')[0].Trim();
        }

        private static string Sha256(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();
        private static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        private static string TenantUrl(string slug) => $"https://{slug}.{TenantResolver.PlatformDomain}";

        // ── B: registro ──

        /// <summary>El formulario pregunta aquí, en vivo, si el subdominio sirve.</summary>
        [HttpGet("api/platform/signup/slug")]
        [AllowAnonymous]
        [EnableRateLimiting("platform-waitlist")]
        public async Task<IActionResult> SlugCheck([FromQuery] string? slug)
        {
            slug = (slug ?? "").Trim().ToLowerInvariant();
            var bad = PlatformSlug.Check(slug);
            if (bad != null) return Ok(new { success = true, available = false, reason = bad });
            if (await _provisioner.SlugExistsAsync(slug)) return Ok(new { success = true, available = false, reason = "taken" });
            return Ok(new { success = true, available = true });
        }

        public class SignupRequest
        {
            public string? Email { get; set; }
            public string? ProjectName { get; set; }
            public string? Slug { get; set; }
            public string? Locale { get; set; }
            /// <summary>Trampa para bots: el formulario lo deja oculto y vacío.</summary>
            public string? Website { get; set; }
            public string? TurnstileToken { get; set; }
        }

        [HttpPost("api/platform/signup")]
        [AllowAnonymous]
        [EnableRateLimiting("platform-waitlist")]
        public async Task<IActionResult> Signup([FromBody] SignupRequest req)
        {
            var ok = Ok(new { success = true });
            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            var slug = (req.Slug ?? "").Trim().ToLowerInvariant();
            var name = (req.ProjectName ?? "").Trim();
            if (email.Length == 0 || email.Length > 254 || !EmailRx.IsMatch(email)) return BadRequest(new { success = false, code = "invalid_email" });
            if (name.Length < 2 || name.Length > 80) return BadRequest(new { success = false, code = "invalid_name" });
            if (PlatformSlug.Check(slug) is { } why) return BadRequest(new { success = false, code = "slug_" + why });
            if (!string.IsNullOrEmpty(req.Website)) return ok; // bot
            if (!await _turnstile.VerifyAsync(req.TurnstileToken, ClientIp())) return BadRequest(new { success = false, code = "captcha" });
            if (await _provisioner.SlugExistsAsync(slug)) return BadRequest(new { success = false, code = "slug_taken" });

            var locale = req.Locale == "en" ? "en" : "es";
            var ipHash = Sha256(ClientIp());
            var since = DateTime.UtcNow.AddDays(-1);
            if (await _db.PlatformSignups.CountAsync(s => s.IpHash == ipHash && s.CreatedAt >= since) >= MaxPerIpPerDay) return ok;
            if (await _db.PlatformSignups.CountAsync(s => s.Email == email && s.CreatedAt >= since) >= MaxPerEmailPerDay) return ok;
            var cooldownFrom = DateTime.UtcNow - ResendCooldown;
            if (await _db.PlatformSignups.AnyAsync(s => s.Email == email && s.Purpose == "signup" && s.UsedAt == null && s.CreatedAt >= cooldownFrom)) return ok;

            if (await _db.PlatformWaitlistEmails.CountAsync(m => m.SentAt >= since) >= MaxEmailsPerDay)
            {
                _log.LogWarning("Registro: tope diario de correos alcanzado ({Max})", MaxEmailsPerDay);
                return StatusCode(503, new { success = false, code = "busy" });
            }

            var token = NewToken();
            _db.PlatformSignups.Add(new PlatformSignup
            {
                Email = email, Slug = slug, ProjectName = name, Locale = locale, TokenHash = Sha256(token), IpHash = ipHash,
                ExpiresAt = DateTime.UtcNow.Add(SignupLinkLife), Purpose = "signup",
            });
            _db.PlatformWaitlistEmails.Add(new PlatformWaitlistEmail()); // se cuenta aunque Resend falle: el intento también gasta cuota
            await _db.SaveChangesAsync();

            var (subject, html) = BuildEmail(locale, "signup", name, $"{RootUrl}/registro/confirmar?t={token}", (int)SignupLinkLife.TotalMinutes);
            var (sent, _, error) = await _email.SendEmailAsync(email, subject, html, "Decatron <support@decatron.net>");
            if (!sent) _log.LogWarning("Registro: no se pudo enviar el enlace ({Error})", error);
            return ok;
        }

        public class TokenRequest { public string? Token { get; set; } }

        /// <summary>Confirma el correo: crea el tenant con su comprador y devuelve a dónde ir con la sesión ya iniciada.</summary>
        [HttpPost("api/platform/signup/confirm")]
        [AllowAnonymous]
        [EnableRateLimiting("platform-waitlist")]
        public async Task<IActionResult> Confirm([FromBody] TokenRequest req)
        {
            var token = (req.Token ?? "").Trim();
            if (token.Length < 20 || token.Length > 100) return BadRequest(new { success = false, code = "invalid_token" });

            var hash = Sha256(token);
            var now = DateTime.UtcNow;
            var signup = await _db.PlatformSignups.FirstOrDefaultAsync(s => s.TokenHash == hash && s.Purpose == "signup" && s.UsedAt == null && s.ExpiresAt > now);
            if (signup == null) return BadRequest(new { success = false, code = "invalid_token" });

            var result = await _provisioner.CreateWithBuyerAsync(signup.Slug, signup.ProjectName, signup.Email, signup.Locale);
            if (!result.Ok) return Conflict(new { success = false, code = result.Error ?? "error" });

            signup.UsedAt = now;
            signup.TenantId = result.TenantId;
            await _db.SaveChangesAsync();
            _log.LogInformation("Registro: tenant {Slug} creado (id {Tenant}) para {Email}", signup.Slug, result.TenantId, signup.Email);

            var code = _sessions.IssueExchangeCode(result.UserId, "owner", signup.Email.Split('@')[0], signup.Email, result.TenantId);
            return Ok(new { success = true, slug = signup.Slug, url = $"{TenantUrl(signup.Slug)}/panel?code={code}" });
        }

        // ── C: entrada del comprador en su subdominio ──

        [HttpPost("api/platform/buyer/login-link")]
        [AllowAnonymous]
        [EnableRateLimiting("platform-waitlist")]
        public async Task<IActionResult> LoginLink([FromBody] SignupRequest req)
        {
            var ok = Ok(new { success = true });
            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            if (email.Length == 0 || email.Length > 254 || !EmailRx.IsMatch(email)) return BadRequest(new { success = false, code = "invalid_email" });
            if (!string.IsNullOrEmpty(req.Website)) return ok;
            var tenantId = TenantAmbient.Current;
            if (tenantId is null or 1) return NotFound(new { success = false, code = "no_tenant" }); // solo en slug.decatron.top
            if (!await _turnstile.VerifyAsync(req.TurnstileToken, ClientIp())) return BadRequest(new { success = false, code = "captcha" });

            var ipHash = Sha256(ClientIp());
            var since = DateTime.UtcNow.AddDays(-1);
            if (await _db.PlatformSignups.CountAsync(s => s.IpHash == ipHash && s.CreatedAt >= since) >= MaxPerIpPerDay * 2) return ok;
            if (await _db.PlatformSignups.CountAsync(s => s.Email == email && s.CreatedAt >= since) >= MaxPerEmailPerDay * 2) return ok;
            if (await _db.PlatformSignups.AnyAsync(s => s.Email == email && s.Purpose == "login" && s.UsedAt == null && s.CreatedAt >= DateTime.UtcNow - ResendCooldown)) return ok;

            // users y tenant_members ya vienen filtrados por el tenant del Host (filtro global + RLS).
            var buyer = await (from u in _db.Users
                               join m in _db.TenantMembers on u.Id equals m.UserId
                               where m.TenantId == tenantId && (m.Role == "owner" || m.Role == "admin") && u.Email != null && u.Email.ToLower() == email && u.IsActive
                               select new { u.Id }).FirstOrDefaultAsync();
            if (buyer == null) return ok; // misma respuesta: no se revela si el correo existe

            if (await _db.PlatformWaitlistEmails.CountAsync(m => m.SentAt >= since) >= MaxEmailsPerDay)
                return StatusCode(503, new { success = false, code = "busy" });

            var slug = await _db.Tenants.AsNoTracking().Where(t => t.Id == tenantId).Select(t => t.Slug).FirstOrDefaultAsync();
            if (slug == null) return ok;
            var token = NewToken();
            var locale = req.Locale == "en" ? "en" : "es";
            _db.PlatformSignups.Add(new PlatformSignup
            {
                Email = email, Slug = slug, ProjectName = "", Locale = locale, TokenHash = Sha256(token), IpHash = ipHash,
                ExpiresAt = DateTime.UtcNow.Add(LoginLinkLife), Purpose = "login", UserId = buyer.Id, TenantId = tenantId,
            });
            _db.PlatformWaitlistEmails.Add(new PlatformWaitlistEmail());
            await _db.SaveChangesAsync();

            var (subject, html) = BuildEmail(locale, "login", slug, $"{TenantUrl(slug)}/panel/entrar?t={token}", (int)LoginLinkLife.TotalMinutes);
            var (sent, _, error) = await _email.SendEmailAsync(email, subject, html, "Decatron <support@decatron.net>");
            if (!sent) _log.LogWarning("Entrada del comprador: no se pudo enviar el enlace ({Error})", error);
            return ok;
        }

        [HttpPost("api/platform/buyer/login-confirm")]
        [AllowAnonymous]
        [EnableRateLimiting("platform-waitlist")]
        public async Task<IActionResult> LoginConfirm([FromBody] TokenRequest req)
        {
            var token = (req.Token ?? "").Trim();
            if (token.Length < 20 || token.Length > 100) return BadRequest(new { success = false, code = "invalid_token" });
            var tenantId = TenantAmbient.Current;
            if (tenantId is null or 1) return NotFound(new { success = false, code = "no_tenant" });

            var hash = Sha256(token);
            var now = DateTime.UtcNow;
            // El enlace solo vale en el subdominio del tenant al que se pidió.
            var link = await _db.PlatformSignups.FirstOrDefaultAsync(s => s.TokenHash == hash && s.Purpose == "login" && s.UsedAt == null && s.ExpiresAt > now && s.TenantId == tenantId);
            if (link?.UserId == null) return BadRequest(new { success = false, code = "invalid_token" });

            var user = await _db.Users.AsNoTracking().Where(u => u.Id == link.UserId && u.IsActive).Select(u => new { u.Id, u.Login, u.DisplayName, u.Email }).FirstOrDefaultAsync();
            if (user == null) return BadRequest(new { success = false, code = "invalid_token" });

            link.UsedAt = now;
            await _db.SaveChangesAsync();
            var code = _sessions.IssueExchangeCode(user.Id, user.Login, user.DisplayName, user.Email ?? "", tenantId.Value);
            return Ok(new { success = true, code });
        }

        /// <summary>Resumen del tenant para el comprador con sesión (alcance buyer). La parte completa del panel es la pieza D.</summary>
        [HttpGet("api/platform/buyer/me")]
        [Authorize]
        public async Task<IActionResult> BuyerMe()
        {
            var tenantId = TenantAmbient.Current;
            if (tenantId is null or 1 || User.FindFirst(BuyerClaimScope)?.Value != "buyer") return Forbid();
            var email = User.FindFirst("Email")?.Value ?? "";
            await using var c = TenantNpgsql.Create(_config["ConnectionStrings:DefaultConnection"], tenantId.Value);
            await c.OpenAsync();
            await using var cmd = new NpgsqlCommand(@"
                SELECT t.slug, t.name, t.status, p.key, p.name, s.status, s.sandbox_ends_at
                FROM tenants t
                LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id AND s.status <> 'cancelled'
                LEFT JOIN plans p ON p.id = s.plan_id
                WHERE t.id = @t", c);
            cmd.Parameters.AddWithValue("t", tenantId.Value);
            await using var r = await cmd.ExecuteReaderAsync();
            if (!await r.ReadAsync()) return NotFound(new { success = false });
            var ends = r.IsDBNull(6) ? (DateTime?)null : r.GetDateTime(6);
            return Ok(new
            {
                success = true,
                tenant = new { slug = r.GetString(0), name = r.GetString(1), status = r.GetString(2) },
                plan = new { key = r.IsDBNull(3) ? null : r.GetString(3), name = r.IsDBNull(4) ? null : r.GetString(4), status = r.IsDBNull(5) ? null : r.GetString(5), sandboxEndsAt = ends,
                             daysLeft = ends is null ? (int?)null : Math.Max(0, (int)Math.Ceiling((ends.Value.ToUniversalTime() - DateTime.UtcNow).TotalDays)) },
                buyer = new { email, role = "owner" },
            });
        }

        private const string BuyerClaimScope = "scope";

        private static (string subject, string html) BuildEmail(string locale, string kind, string subjectName, string link, int minutes)
        {
            var safeLink = WebUtility.HtmlEncode(link);
            var safeName = WebUtility.HtmlEncode(subjectName);
            const string btn = "display:inline-block;background:#2f5fc6;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold";
            string Wrap(string h, string p, string label, string foot) =>
                $"<div style=\"font-family:Arial,sans-serif;max-width:480px;color:#12151c\"><h2 style=\"margin:0 0 12px\">{h}</h2><p>{p}</p>" +
                $"<p><a href=\"{safeLink}\" style=\"{btn}\">{label}</a></p><p style=\"color:#5b6475;font-size:13px\">{foot}</p></div>";
            if (locale == "en")
                return kind == "signup"
                    ? ("Confirm your email to create " + subjectName, Wrap("Almost there", $"Confirm your email to create <b>{safeName}</b> on Decatron. The link works once and expires in {minutes} minutes.", "Confirm and create", "If you did not ask for this, you can ignore this message."))
                    : ("Your sign-in link for " + subjectName, Wrap("Sign in", $"Use this link to enter the <b>{safeName}</b> panel. It works once and expires in {minutes} minutes.", "Sign in", "If you did not ask for this, you can ignore this message."));
            return kind == "signup"
                ? ("Confirma tu correo para crear " + subjectName, Wrap("Casi listo", $"Confirma tu correo para crear <b>{safeName}</b> en Decatron. El enlace sirve una vez y vence en {minutes} minutos.", "Confirmar y crear", "Si no lo pediste, puedes ignorar este mensaje."))
                : ("Tu enlace de entrada a " + subjectName, Wrap("Entrar", $"Usa este enlace para entrar al panel de <b>{safeName}</b>. Sirve una vez y vence en {minutes} minutos.", "Entrar", "Si no lo pediste, puedes ignorar este mensaje."));
        }
    }
}
