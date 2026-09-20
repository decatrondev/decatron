-- Coach de LoL fase 2b: voz. 2026-09-20
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
ALTER TABLE lol_coach_settings
    ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS voice_id VARCHAR(60) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS voice_kinds VARCHAR(60) NOT NULL DEFAULT 'my_turn,final,postgame';
