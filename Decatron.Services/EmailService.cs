using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models.Email;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services
{
    public class EmailService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IOptionsMonitor<EmailSettings> _settingsMonitor;
        private EmailSettings _settings => _settingsMonitor.CurrentValue;
        private readonly DecatronDbContext _db;
        private readonly ILogger<EmailService> _logger;

        public EmailService(
            IHttpClientFactory httpClientFactory,
            IOptionsMonitor<EmailSettings> settings,
            DecatronDbContext db,
            ILogger<EmailService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _settingsMonitor = settings;
            _db = db;
            _logger = logger;
        }

        /// <summary>Proveedor activo de los correos de la plataforma: «resend» o «smtp» (servidor propio).</summary>
        public async Task<string> GetProviderAsync()
        {
            var p = (await _db.Database.SqlQueryRaw<string>("SELECT provider AS \"Value\" FROM platform_mail_settings WHERE id = 1").ToListAsync()).FirstOrDefault();
            return p == "smtp" ? "smtp" : "resend";
        }

        public async Task SetProviderAsync(string provider, string by)
        {
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE platform_mail_settings SET provider = {0}, updated_at = now(), updated_by = {1} WHERE id = 1", provider, by);
        }

        public (bool resend, bool smtp) Configured() => (!string.IsNullOrWhiteSpace(_settings.ResendApiKey), _settings.Smtp.Configured);

        /// <summary>
        /// Envía por el proveedor elegido. Si el servidor propio falla y Resend está configurado, reintenta por Resend:
        /// un enlace de acceso no puede perderse por un fallo del correo propio.
        /// </summary>
        public async Task<(bool success, string? resendId, string? error)> SendEmailAsync(string to, string subject, string htmlContent, string? fromOverride = null, bool allowFallback = true)
        {
            if (_settings.Smtp.Configured && await GetProviderAsync() == "smtp")
            {
                var r = await SendViaSmtpAsync(to, subject, htmlContent, fromOverride);
                if (r.success || !allowFallback || string.IsNullOrWhiteSpace(_settings.ResendApiKey)) return r;
                _logger.LogWarning("SMTP propio fallo ({Error}); se reintenta por Resend", r.error);
            }
            return await SendViaResendAsync(to, subject, htmlContent, fromOverride);
        }

        private async Task<(bool success, string? resendId, string? error)> SendViaSmtpAsync(string to, string subject, string htmlContent, string? fromOverride)
        {
            try
            {
                var smtp = _settings.Smtp;
                var from = new MailAddress(string.IsNullOrWhiteSpace(fromOverride) ? _settings.FromAddress : fromOverride);
                // El remitente debe ser del buzon autenticado; si no, el servidor lo rechaza o lo reescribe.
                using var msg = new MailMessage(from, new MailAddress(to)) { Subject = subject, Body = htmlContent, IsBodyHtml = true };
                using var client = new SmtpClient(smtp.Host, smtp.Port)
                {
                    EnableSsl = true,
                    Credentials = new NetworkCredential(smtp.User, smtp.Password),
                    Timeout = 15000
                };
                await client.SendMailAsync(msg);
                return (true, "smtp", null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMTP send failed to {To}", to);
                return (false, null, ex.Message);
            }
        }

        private async Task<(bool success, string? resendId, string? error)> SendViaResendAsync(string to, string subject, string htmlContent, string? fromOverride)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_settings.ResendApiKey}");

                var payload = new
                {
                    from = string.IsNullOrWhiteSpace(fromOverride) ? _settings.FromAddress : fromOverride,
                    to = new[] { to },
                    subject,
                    html = htmlContent
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await client.PostAsync("https://api.resend.com/emails", content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    var result = JsonSerializer.Deserialize<JsonElement>(responseBody);
                    var resendId = result.GetProperty("id").GetString();
                    return (true, resendId, null);
                }

                _logger.LogError("Resend API error: {Status} - {Body}", response.StatusCode, responseBody);
                return (false, null, responseBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {To}", to);
                return (false, null, ex.Message);
            }
        }

        public async Task<(int sent, int failed)> SendCampaignAsync(long campaignId, List<(string email, long? userId)> recipients)
        {
            var campaign = await _db.EmailCampaigns
                .Include(c => c.Template)
                .FirstOrDefaultAsync(c => c.Id == campaignId);

            if (campaign == null || campaign.Template == null)
                throw new InvalidOperationException("Campaign or template not found");

            campaign.Status = "sending";
            await _db.SaveChangesAsync();

            int sent = 0, failed = 0;

            foreach (var (email, userId) in recipients)
            {
                var (success, resendId, error) = await SendEmailAsync(email, campaign.Template.Subject, campaign.Template.HtmlContent);

                var log = new EmailLog
                {
                    CampaignId = campaignId,
                    RecipientEmail = email,
                    RecipientUserId = userId,
                    Status = success ? "sent" : "failed",
                    SentAt = DateTime.UtcNow,
                    ResendId = resendId,
                    ErrorMessage = error
                };

                _db.EmailLogs.Add(log);

                if (success) sent++;
                else failed++;
            }

            campaign.Status = "sent";
            campaign.TotalSent = sent;
            campaign.TotalFailed = failed;
            campaign.SentAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation("Campaign {Id} sent: {Sent} success, {Failed} failed", campaignId, sent, failed);
            return (sent, failed);
        }
    }
}
