-- Song Request fase 3 (.dev/plans/SONG_REQUEST_PLAN.md): playlist de respaldo. 2026-09-25
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS song_request_fallback (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id),
    track_id   BIGINT NOT NULL REFERENCES song_request_tracks(id),
    position   INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_song_request_fallback UNIQUE (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_song_request_fallback_user_position ON song_request_fallback(user_id, position);

ALTER TABLE song_request_configs
    ADD COLUMN IF NOT EXISTS fallback_cursor INT NOT NULL DEFAULT 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON song_request_fallback TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE song_request_fallback_id_seq TO decatron_user;
