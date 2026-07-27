using System;

namespace Decatron.Core.Models.Email
{
    public class EmailLog
    {
        public long Id { get; set; }
        public long CampaignId { get; set; }
        public string RecipientEmail { get; set; } = string.Empty;
        public long? RecipientUserId { get; set; }
        public string Status { get; set; } = "sent";
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public string? ResendId { get; set; }
        public string? ErrorMessage { get; set; }

        public EmailCampaign? Campaign { get; set; }
    }
}
