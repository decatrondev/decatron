-- Song Request, etapa 2 fase 1 (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md): varias playlists por canal. 2026-09-30
-- La playlist de respaldo de cada canal pasa tal cual a ser su primera playlist (canciones, orden, al azar y cursor).
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
BEGIN;

CREATE TABLE IF NOT EXISTS song_request_playlists (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    name         VARCHAR(60) NOT NULL,
    -- public: se ve en /sr/{canal}; private: solo el dashboard
    visibility   VARCHAR(10) NOT NULL DEFAULT 'private',
    -- owner: solo streamer y mods; review / open: fase 2 y 3
    contribution VARCHAR(10) NOT NULL DEFAULT 'owner',
    is_fallback  BOOLEAN NOT NULL DEFAULT FALSE,
    shuffle      BOOLEAN NOT NULL DEFAULT FALSE,
    cursor       INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_song_request_playlists_user ON song_request_playlists(user_id);
-- Una sola playlist de respaldo por canal
CREATE UNIQUE INDEX IF NOT EXISTS uq_song_request_playlists_fallback ON song_request_playlists(user_id) WHERE is_fallback;

-- Una playlist por canal que ya usa song request (o que tiene canciones de respaldo)
INSERT INTO song_request_playlists (user_id, name, is_fallback, shuffle, cursor)
SELECT u.id,
       CASE WHEN u.preferred_language ILIKE 'en%' THEN 'Fallback playlist' ELSE 'Playlist de respaldo' END,
       TRUE,
       COALESCE((c.settings->>'FallbackShuffle')::boolean, (c.settings->>'fallbackShuffle')::boolean, FALSE),
       COALESCE(c.fallback_cursor, 0)
FROM users u
LEFT JOIN song_request_configs c ON c.user_id = u.id
WHERE (c.user_id IS NOT NULL OR EXISTS (SELECT 1 FROM song_request_fallback f WHERE f.user_id = u.id))
  AND NOT EXISTS (SELECT 1 FROM song_request_playlists p WHERE p.user_id = u.id);

ALTER TABLE song_request_fallback RENAME TO song_request_playlist_items;
ALTER SEQUENCE song_request_fallback_id_seq RENAME TO song_request_playlist_items_id_seq;
ALTER TABLE song_request_playlist_items ADD COLUMN playlist_id BIGINT REFERENCES song_request_playlists(id) ON DELETE CASCADE;

UPDATE song_request_playlist_items i
SET playlist_id = p.id
FROM song_request_playlists p
WHERE p.user_id = i.user_id AND p.is_fallback;

ALTER TABLE song_request_playlist_items ALTER COLUMN playlist_id SET NOT NULL;
ALTER TABLE song_request_playlist_items DROP CONSTRAINT uq_song_request_fallback;
ALTER TABLE song_request_playlist_items ADD CONSTRAINT uq_song_request_playlist_items UNIQUE (playlist_id, track_id);
DROP INDEX IF EXISTS idx_song_request_fallback_user_position;
CREATE INDEX IF NOT EXISTS idx_song_request_playlist_items_position ON song_request_playlist_items(playlist_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON song_request_playlists TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE song_request_playlists_id_seq TO decatron_user;

COMMIT;
