-- Moderación fase 5 (.dev/plans/MODERATION_PLAN.md): historial con deshacer.
ALTER TABLE moderation_logs ADD COLUMN IF NOT EXISTS undone_at TIMESTAMP;
ALTER TABLE moderation_logs ADD COLUMN IF NOT EXISTS undone_by VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_channel_user ON moderation_logs(channel_name, username);
