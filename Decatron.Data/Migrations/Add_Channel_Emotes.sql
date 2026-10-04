-- Emotes propios de Decatron, fase 3 (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md).

-- Quién puede subir emotes a un canal. Sin fila, el canal usa el modo 'staff' (streamer, control total y mods del panel).
CREATE TABLE IF NOT EXISTS channel_emote_settings (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users(id),
    -- owner: solo el streamer y quien tenga control total | staff: además los mods del panel |
    -- approval: cualquiera con cuenta, y lo que sube un viewer queda pendiente | list: solo la lista de permitidos
    upload_mode          VARCHAR(10) NOT NULL DEFAULT 'staff',
    max_pending_per_user INT NOT NULL DEFAULT 5,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_channel_emote_mode CHECK (upload_mode IN ('owner', 'staff', 'approval', 'list')),
    CONSTRAINT chk_channel_emote_pending CHECK (max_pending_per_user BETWEEN 1 AND 50),
    CONSTRAINT uq_channel_emote_settings_user UNIQUE (user_id)
);

-- Personas permitidas por el streamer (suben sin revisión en los modos approval y list)
CREATE TABLE IF NOT EXISTS channel_emote_uploaders (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id),
    platform   VARCHAR(10) NOT NULL DEFAULT 'twitch',
    login      VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_channel_emote_uploader_platform CHECK (platform IN ('twitch', 'kick')),
    CONSTRAINT uq_channel_emote_uploaders UNIQUE (user_id, platform, login)
);

CREATE TABLE IF NOT EXISTS channel_emotes (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id),
    -- Lo que se escribe en el chat
    name             VARCHAR(25) NOT NULL,
    -- Carpeta de los archivos: emote-assets/{user_id}/{file_key}/{1,2,4}.webp
    file_key         VARCHAR(32) NOT NULL,
    animated         BOOLEAN NOT NULL DEFAULT FALSE,
    zero_width       BOOLEAN NOT NULL DEFAULT FALSE,
    width            INT NOT NULL,
    height           INT NOT NULL,
    bytes            INT NOT NULL,
    -- pending: espera revisión | approved: se ve | hidden: aprobado pero apagado | rejected: no pasó la revisión
    -- removed: el streamer lo retiró (los archivos se borran; lo ve quien lo subió)
    status           VARCHAR(10) NOT NULL DEFAULT 'pending',
    uploaded_by      BIGINT NOT NULL REFERENCES users(id),
    uploaded_by_name VARCHAR(100) NOT NULL,
    reviewed_by_name VARCHAR(100),
    reviewed_at      TIMESTAMP,
    reason           VARCHAR(300),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_channel_emote_status CHECK (status IN ('pending', 'approved', 'hidden', 'rejected', 'removed'))
);
-- Un nombre no se repite entre los emotes vivos del canal (sin distinguir mayúsculas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_emotes_live_name ON channel_emotes (user_id, LOWER(name))
    WHERE status IN ('pending', 'approved', 'hidden');
CREATE INDEX IF NOT EXISTS idx_channel_emotes_user_status ON channel_emotes (user_id, status);
CREATE INDEX IF NOT EXISTS idx_channel_emotes_uploader ON channel_emotes (uploaded_by);

-- Reportes de abuso hechos por viewers con cuenta
CREATE TABLE IF NOT EXISTS channel_emote_reports (
    id               BIGSERIAL PRIMARY KEY,
    emote_id         BIGINT NOT NULL REFERENCES channel_emotes(id) ON DELETE CASCADE,
    reporter_user_id BIGINT NOT NULL REFERENCES users(id),
    reason           VARCHAR(300),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_channel_emote_reports UNIQUE (emote_id, reporter_user_id)
);
