-- Song Request, etapa 2 fase 3 (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md): revisión de pedidos y aportes. 2026-09-30
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
BEGIN;

-- Lo que espera aprobación: un pedido a la cola (playlist_id NULL) o un aporte a una playlist "con revisión"
CREATE TABLE IF NOT EXISTS song_request_pending (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users(id),
    playlist_id          BIGINT REFERENCES song_request_playlists(id) ON DELETE CASCADE,
    track_id             BIGINT NOT NULL REFERENCES song_request_tracks(id),
    requested_platform   VARCHAR(20) NOT NULL,
    requested_by_id      VARCHAR(100),
    requested_by_login   VARCHAR(100) NOT NULL,
    requested_by_name    VARCHAR(100) NOT NULL,
    -- A qué chat avisar la decisión (login de Twitch o id de Kick)
    reply_channel        VARCHAR(100),
    origin_source        VARCHAR(30),
    origin_url           VARCHAR(500),
    origin_title         VARCHAR(300),
    origin_artist        VARCHAR(200),
    origin_thumbnail_url VARCHAR(500),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_song_request_pending_user ON song_request_pending(user_id, created_at);

-- Viewers de confianza: lo suyo no pasa por revisión
CREATE TABLE IF NOT EXISTS song_request_trusted (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    platform     VARCHAR(20) NOT NULL,
    login        VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_by   VARCHAR(100),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_song_request_trusted UNIQUE (user_id, platform, login)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON song_request_pending, song_request_trusted TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE song_request_pending_id_seq, song_request_trusted_id_seq TO decatron_user;

COMMIT;
