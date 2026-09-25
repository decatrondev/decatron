-- Song Request fase 1 (.dev/plans/SONG_REQUEST_PLAN.md): pausa de la cola desde el chat. 2026-09-25
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
ALTER TABLE song_request_configs
    ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;
