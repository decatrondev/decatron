-- Song Request fase 0 (.dev/plans/SONG_REQUEST_PLAN.md). 2026-09-25
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>

-- Canciones ya resueltas, una fila por video de la fuente (youtube, luego soundcloud...).
-- Hace de caché: la misma canción no vuelve a pasar por yt-dlp hasta que caduca resolved_at.
CREATE TABLE IF NOT EXISTS song_request_tracks (
    id               BIGSERIAL PRIMARY KEY,
    source           VARCHAR(30) NOT NULL,
    source_id        VARCHAR(100) NOT NULL,
    title            VARCHAR(300) NOT NULL DEFAULT '',
    artist           VARCHAR(200) NOT NULL DEFAULT '',
    author_id        VARCHAR(100),
    duration_seconds INT,
    view_count       BIGINT,
    thumbnail_url    VARCHAR(500),
    -- public | unlisted | private | ... tal como la da la fuente
    availability     VARCHAR(30),
    -- not_live | is_live | is_upcoming | was_live | post_live
    live_status      VARCHAR(30),
    is_embeddable    BOOLEAN NOT NULL DEFAULT TRUE,
    age_restricted   BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_song_request_tracks_source UNIQUE (source, source_id)
);

-- Config por canal. Todo lo configurable va en settings (filtros, límites, permisos, mensajes)
-- y en overlay_config (lo que arma el editor). Sin fila = módulo apagado.
CREATE TABLE IF NOT EXISTS song_request_configs (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id),
    channel_name   VARCHAR(100) NOT NULL,
    enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    -- Pedidos abiertos: el streamer puede cerrarlos sin apagar el módulo
    requests_open  BOOLEAN NOT NULL DEFAULT TRUE,
    settings       JSONB NOT NULL DEFAULT '{}',
    overlay_config JSONB NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_song_request_configs_user UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_song_request_configs_channel ON song_request_configs(channel_name);

-- Cola actual del canal (Twitch y Kick comparten la misma).
CREATE TABLE IF NOT EXISTS song_request_queue (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    track_id            BIGINT NOT NULL REFERENCES song_request_tracks(id),
    position            INT NOT NULL,
    -- queued | playing
    status              VARCHAR(20) NOT NULL DEFAULT 'queued',
    -- twitch | kick | dashboard
    requested_platform  VARCHAR(20) NOT NULL,
    requested_by_id     VARCHAR(100),
    requested_by_login  VARCHAR(100) NOT NULL,
    requested_by_name   VARCHAR(100) NOT NULL DEFAULT '',
    -- Desde dónde llegó el pedido cuando no es la fuente (spotify...): se muestra con esos datos
    origin_source       VARCHAR(30),
    origin_url          VARCHAR(500),
    origin_title        VARCHAR(300),
    origin_artist       VARCHAR(200),
    origin_thumbnail_url VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_song_request_queue_status CHECK (status IN ('queued', 'playing'))
);
CREATE INDEX IF NOT EXISTS idx_song_request_queue_user_position ON song_request_queue(user_id, position);

-- Lo que sonó.
CREATE TABLE IF NOT EXISTS song_request_history (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    track_id            BIGINT NOT NULL REFERENCES song_request_tracks(id),
    requested_platform  VARCHAR(20),
    requested_by_login  VARCHAR(100),
    requested_by_name   VARCHAR(100),
    origin_source       VARCHAR(30),
    origin_url          VARCHAR(500),
    -- finished | skipped | error | removed
    end_reason          VARCHAR(20) NOT NULL DEFAULT 'finished',
    is_favorite         BOOLEAN NOT NULL DEFAULT FALSE,
    played_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_song_request_history_user_date ON song_request_history(user_id, played_at DESC);

-- Vetos del canal: una canción, un canal/artista de la fuente o un usuario del chat.
CREATE TABLE IF NOT EXISTS song_request_bans (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    -- track (source:source_id) | author (source:author_id) | user (platform:login)
    ban_type    VARCHAR(20) NOT NULL,
    value       VARCHAR(200) NOT NULL,
    -- Texto para mostrar en la lista (título, nombre del canal, usuario)
    label       VARCHAR(300) NOT NULL DEFAULT '',
    created_by  VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_song_request_bans_type CHECK (ban_type IN ('track', 'author', 'user')),
    CONSTRAINT uq_song_request_bans UNIQUE (user_id, ban_type, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON song_request_tracks, song_request_configs, song_request_queue, song_request_history, song_request_bans TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE song_request_tracks_id_seq, song_request_configs_id_seq, song_request_queue_id_seq, song_request_history_id_seq, song_request_bans_id_seq TO decatron_user;
