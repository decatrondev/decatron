-- Coach de LoL fase 3a: briefing, objetivo del día, tilt check. 2026-09-20
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
ALTER TABLE lol_coach_settings
    ADD COLUMN IF NOT EXISTS briefing BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS tilt_check BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS lobby_comments BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS daily_goal VARCHAR(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS goal_set_at TIMESTAMPTZ;
