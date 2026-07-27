using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
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
        private readonly EmailSettings _settings;
        private readonly DecatronDbContext _db;
        private readonly ILogger<EmailService> _logger;

        public EmailService(
            IHttpClientFactory httpClientFactory,
            IOptions<EmailSettings> settings,
            DecatronDbContext db,
            ILogger<EmailService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _settings = settings.Value;
            _db = db;
            _logger = logger;
        }

        public async Task<(bool success, string? resendId, string? error)> SendEmailAsync(string to, string subject, string htmlContent)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_settings.ResendApiKey}");

                var payload = new
                {
                    from = _settings.FromAddress,
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
