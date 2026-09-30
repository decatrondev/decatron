-- Song Request, etapa 2 fase 4 (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md): poner una playlist a sonar, !sr #n,
-- modo "solo desde playlists" (va en settings) y votos de viewers. 2026-09-30
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
BEGIN;

-- La playlist que suena con la cola vacía en vez de la de respaldo (NULL = la de respaldo)
ALTER TABLE song_request_configs ADD COLUMN IF NOT EXISTS active_playlist_id BIGINT
    REFERENCES song_request_playlists(id) ON DELETE SET NULL;

ALTER TABLE song_request_playlists ADD COLUMN IF NOT EXISTS voting_enabled BOOLEAN NOT NULL DEFAULT FALSE;
-- Orden por votos (más votadas primero) en vez del orden manual
ALTER TABLE song_request_playlists ADD COLUMN IF NOT EXISTS sort_by_votes BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS song_request_playlist_votes (
    id          BIGSERIAL PRIMARY KEY,
    playlist_id BIGINT NOT NULL REFERENCES song_request_playlists(id) ON DELETE CASCADE,
    item_id     BIGINT NOT NULL REFERENCES song_request_playlist_items(id) ON DELETE CASCADE,
    platform    VARCHAR(20) NOT NULL,
    login       VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_song_request_playlist_votes UNIQUE (item_id, platform, login)
);
CREATE INDEX IF NOT EXISTS idx_song_request_playlist_votes_playlist ON song_request_playlist_votes(playlist_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON song_request_playlist_votes TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE song_request_playlist_votes_id_seq TO decatron_user;

COMMIT;
