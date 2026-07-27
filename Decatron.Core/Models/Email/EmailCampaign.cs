using System;

namespace Decatron.Core.Models.Email
{
    public class EmailCampaign
    {
        public long Id { get; set; }
        public long TemplateId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string RecipientsFilter { get; set; } = string.Empty;
        public string Status { get; set; } = "draft";
        public int TotalSent { get; set; }
        public int TotalFailed { get; set; }
        public DateTime? SentAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public EmailTemplate? Template { get; set; }
    }
}
