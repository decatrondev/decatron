-- Emotes globales de Decatron: set de la plataforma visible en todos los canales (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md).
-- Archivos en emote-assets/global/{file_key}/{1,2,4}.webp. Sin límites por tier.

CREATE TABLE IF NOT EXISTS global_emotes (
    id               BIGSERIAL PRIMARY KEY,
    name             VARCHAR(25) NOT NULL,
    file_key         VARCHAR(32) NOT NULL,
    animated         BOOLEAN NOT NULL DEFAULT FALSE,
    zero_width       BOOLEAN NOT NULL DEFAULT FALSE,
    width            INT NOT NULL,
    height           INT NOT NULL,
    bytes            INT NOT NULL,
    -- approved: se ve en todos los canales | hidden: apagado
    status           VARCHAR(10) NOT NULL DEFAULT 'approved',
    uploaded_by      BIGINT NOT NULL REFERENCES users(id),
    uploaded_by_name VARCHAR(100) NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_global_emote_status CHECK (status IN ('approved', 'hidden'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_emotes_name ON global_emotes (LOWER(name));

-- Personas (por usuario de Twitch) a las que el dueño dejó manejar los emotes globales, además de los admins del sistema
CREATE TABLE IF NOT EXISTS global_emote_managers (
    id         BIGSERIAL PRIMARY KEY,
    login      VARCHAR(100) NOT NULL,
    added_by   VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_global_emote_managers UNIQUE (login)
);

-- Si se aplica como postgres, devolver la propiedad al usuario de la app
ALTER TABLE global_emotes OWNER TO decatron_user;
ALTER TABLE global_emote_managers OWNER TO decatron_user;
ALTER SEQUENCE global_emotes_id_seq OWNER TO decatron_user;
ALTER SEQUENCE global_emote_managers_id_seq OWNER TO decatron_user;
