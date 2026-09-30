-- Song Request, etapa 2 fase 2 (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md): los viewers agregan a las playlists. 2026-09-30
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
BEGIN;

-- Requisitos para agregar (rol, antigüedad de cuenta y follow, límites, espera). JSON: los define el streamer.
ALTER TABLE song_request_playlists ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '{}';

-- Quién agregó cada canción (NULL = el streamer o su equipo desde el dashboard)
ALTER TABLE song_request_playlist_items ADD COLUMN IF NOT EXISTS added_by_platform VARCHAR(10);
ALTER TABLE song_request_playlist_items ADD COLUMN IF NOT EXISTS added_by_id VARCHAR(64);
ALTER TABLE song_request_playlist_items ADD COLUMN IF NOT EXISTS added_by_login VARCHAR(100);
ALTER TABLE song_request_playlist_items ADD COLUMN IF NOT EXISTS added_by_name VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_song_request_playlist_items_added_by
    ON song_request_playlist_items(playlist_id, added_by_platform, added_by_login) WHERE added_by_login IS NOT NULL;

COMMIT;
