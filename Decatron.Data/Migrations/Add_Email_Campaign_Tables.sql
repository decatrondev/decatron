-- Email Campaign System Tables
-- Created: 2026-05-06

CREATE TABLE IF NOT EXISTS email_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL DEFAULT '',
    design_json TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES email_templates(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    recipients_filter TEXT NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    total_sent INT NOT NULL DEFAULT 0,
    total_failed INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_campaigns_template ON email_campaigns(template_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);

CREATE TABLE IF NOT EXISTS email_logs (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_user_id BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resend_id VARCHAR(100),
    error_message VARCHAR(1000)
);

CREATE INDEX idx_email_logs_campaign ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_user_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
