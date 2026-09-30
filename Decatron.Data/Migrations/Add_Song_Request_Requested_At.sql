-- Song Request, etapa 2 fase 5 (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md): límite de pedidos por hora. 2026-09-30
-- Cuándo se pidió lo que ya sonó (el historial solo guardaba cuándo sonó). NULL en lo viejo.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
ALTER TABLE song_request_history ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_song_request_history_requested
    ON song_request_history(user_id, requested_platform, requested_by_login, requested_at) WHERE requested_at IS NOT NULL;
