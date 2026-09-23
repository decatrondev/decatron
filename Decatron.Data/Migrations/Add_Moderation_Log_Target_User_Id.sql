-- Moderación fase K (.dev/plans/MODERATION_PLAN.md): el id de plataforma de quien fue sancionado.
-- Kick sanciona y quita sanciones por id (no por nombre), así que deshacer lo necesita.
ALTER TABLE moderation_logs ADD COLUMN IF NOT EXISTS target_user_id VARCHAR(50);
