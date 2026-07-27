using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.Email;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/admin/email")]
    [Authorize]
    [RequireSystemOwner]
    public class EmailAdminController : ControllerBase
    {
        private readonly EmailService _emailService;
        private readonly DecatronDbContext _db;

        public EmailAdminController(EmailService emailService, DecatronDbContext db)
        {
            _emailService = emailService;
            _db = db;
        }

        // ─── Templates ──────────────────────────────────────────────────────────────

        [HttpGet("templates")]
        public async Task<IActionResult> GetTemplates()
        {
            var templates = await _db.EmailTemplates
                .OrderByDescending(t => t.UpdatedAt)
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.Subject,
                    t.CreatedAt,
                    t.UpdatedAt
                })
                .ToListAsync();

            return Ok(templates);
        }

        [HttpGet("templates/{id}")]
        public async Task<IActionResult> GetTemplate(long id)
        {
            var template = await _db.EmailTemplates.FindAsync(id);
            if (template == null) return NotFound();
            return Ok(template);
        }

        [HttpPost("templates")]
        public async Task<IActionResult> CreateTemplate([FromBody] TemplateRequest req)
        {
            var template = new EmailTemplate
            {
                Name = req.Name,
                Subject = req.Subject,
                HtmlContent = req.HtmlContent ?? "",
                DesignJson = req.DesignJson ?? "",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.EmailTemplates.Add(template);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, id = template.Id });
        }

        [HttpPut("templates/{id}")]
        public async Task<IActionResult> UpdateTemplate(long id, [FromBody] TemplateRequest req)
        {
            var template = await _db.EmailTemplates.FindAsync(id);
            if (template == null) return NotFound();

            template.Name = req.Name;
            template.Subject = req.Subject;
            template.HtmlContent = req.HtmlContent ?? template.HtmlContent;
            template.DesignJson = req.DesignJson ?? template.DesignJson;
            template.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("templates/{id}")]
        public async Task<IActionResult> DeleteTemplate(long id)
        {
            var template = await _db.EmailTemplates.FindAsync(id);
            if (template == null) return NotFound();

            var hasCampaigns = await _db.EmailCampaigns.AnyAsync(c => c.TemplateId == id);
            if (hasCampaigns)
                return BadRequest(new { error = "No se puede eliminar un template con campañas asociadas" });

            _db.EmailTemplates.Remove(template);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ─── Recipients ─────────────────────────────────────────────────────────────

        [HttpGet("recipients")]
        public async Task<IActionResult> GetRecipients()
        {
            var users = await _db.Users
                .Where(u => u.Email != null && u.Email != "" && u.IsActive)
                .OrderBy(u => u.Login)
                .Select(u => new
                {
                    u.Id,
                    u.Login,
                    u.Email,
                    u.ProfileImageUrl
                })
                .ToListAsync();

            return Ok(users);
        }

        // ─── Campaigns ──────────────────────────────────────────────────────────────

        [HttpGet("campaigns")]
        public async Task<IActionResult> GetCampaigns()
        {
            var campaigns = await _db.EmailCampaigns
                .Include(c => c.Template)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    TemplateName = c.Template != null ? c.Template.Name : "",
                    c.Status,
                    c.TotalSent,
                    c.TotalFailed,
                    c.SentAt,
                    c.CreatedAt
                })
                .ToListAsync();

            return Ok(campaigns);
        }

        [HttpPost("campaigns")]
        public async Task<IActionResult> SendCampaign([FromBody] CampaignRequest req)
        {
            var template = await _db.EmailTemplates.FindAsync(req.TemplateId);
            if (template == null) return BadRequest(new { error = "Template no encontrado" });

            var campaign = new EmailCampaign
            {
                TemplateId = req.TemplateId,
                Name = req.Name,
                RecipientsFilter = System.Text.Json.JsonSerializer.Serialize(req.RecipientIds),
                CreatedAt = DateTime.UtcNow
            };

            _db.EmailCampaigns.Add(campaign);
            await _db.SaveChangesAsync();

            // Get recipients
            var recipients = await _db.Users
                .Where(u => req.RecipientIds.Contains(u.Id) && u.Email != null && u.Email != "")
                .Select(u => new { u.Email, u.Id })
                .ToListAsync();

            var recipientList = recipients.Select(r => (r.Email!, (long?)r.Id)).ToList();

            var (sent, failed) = await _emailService.SendCampaignAsync(campaign.Id, recipientList);

            return Ok(new { success = true, campaignId = campaign.Id, sent, failed });
        }

        [HttpGet("campaigns/{id}/logs")]
        public async Task<IActionResult> GetCampaignLogs(long id)
        {
            var logs = await _db.EmailLogs
                .Where(l => l.CampaignId == id)
                .OrderByDescending(l => l.SentAt)
                .Select(l => new
                {
                    l.Id,
                    l.RecipientEmail,
                    l.RecipientUserId,
                    l.Status,
                    l.SentAt,
                    l.ResendId,
                    l.ErrorMessage
                })
                .ToListAsync();

            return Ok(logs);
        }

        // ─── Preview / Test ─────────────────────────────────────────────────────────

        [HttpPost("preview")]
        public async Task<IActionResult> SendPreview([FromBody] PreviewRequest req)
        {
            var (success, resendId, error) = await _emailService.SendEmailAsync(
                req.TestEmail ?? "support@decatron.net",
                req.Subject ?? "Test Email",
                req.HtmlContent ?? "<p>Test</p>"
            );

            return Ok(new { success, resendId, error });
        }
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────────

    public class TemplateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string? HtmlContent { get; set; }
        public string? DesignJson { get; set; }
    }

    public class CampaignRequest
    {
        public string Name { get; set; } = string.Empty;
        public long TemplateId { get; set; }
        public List<long> RecipientIds { get; set; } = new();
    }

    public class PreviewRequest
    {
        public string? TestEmail { get; set; }
        public string? Subject { get; set; }
        public string? HtmlContent { get; set; }
    }
}
