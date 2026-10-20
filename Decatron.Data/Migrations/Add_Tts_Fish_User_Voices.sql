-- Voces de personaje (Fish Audio) propias de un streamer con rango Patrocinador o superior.
-- El Patrocinador las busca y agrega él mismo (sin aprobación del admin); solo se ofrecen y se sintetizan
-- en su canal, y solo mientras conserve el rango. El catálogo global (tts_fish_voices) sigue siendo del admin.
-- Idempotente.

CREATE TABLE IF NOT EXISTS tts_fish_user_voices (
    user_id         BIGINT       NOT NULL,
    reference_id    VARCHAR(32)  NOT NULL,
    name            TEXT         NOT NULL,
    languages       TEXT         NOT NULL DEFAULT '',
    author          TEXT,
    sample_url      TEXT,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    -- manual | missing (Fish ya no la devuelve) | takedown | admin (la desactivó el dueño de la plataforma)
    inactive_reason VARCHAR(20),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, reference_id)
);

CREATE INDEX IF NOT EXISTS ix_tts_fish_user_voices_ref ON tts_fish_user_voices (reference_id);

-- Permisos (la tabla la crea postgres):
--   GRANT SELECT,INSERT,UPDATE,DELETE ON tts_fish_user_voices TO decatron_app; GRANT ALL ON tts_fish_user_voices TO decatron_user;

-- Reverso:
--   DROP TABLE IF EXISTS tts_fish_user_voices;
