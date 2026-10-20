-- Solicitudes de voz de personaje (Fish Audio): el streamer pide una voz y el admin la aprueba o rechaza.
-- Al aprobar, la voz entra al catálogo (tts_fish_voices, source = 'request'). Idempotente.

CREATE TABLE IF NOT EXISTS tts_fish_voice_requests (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL,
    -- qué voz quiere (nombre, personaje o enlace de Fish); texto libre
    description    TEXT         NOT NULL,
    -- id de Fish si el streamer pegó un enlace o id válido
    reference_id   VARCHAR(32),
    -- pending | approved | rejected
    status         VARCHAR(10)  NOT NULL DEFAULT 'pending',
    admin_note     TEXT,
    voice_id       VARCHAR(32),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ,
    CONSTRAINT chk_tts_fish_voice_requests_status CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS ix_tts_fish_voice_requests_status ON tts_fish_voice_requests (status, created_at);
CREATE INDEX IF NOT EXISTS ix_tts_fish_voice_requests_user ON tts_fish_voice_requests (user_id);

-- Permisos (la tabla la crea postgres):
--   GRANT SELECT,INSERT,UPDATE,DELETE ON tts_fish_voice_requests TO decatron_app; GRANT ALL ON tts_fish_voice_requests TO decatron_user;
--   GRANT USAGE,SELECT ON SEQUENCE tts_fish_voice_requests_id_seq TO decatron_app, decatron_user;

-- Reverso:
--   DROP TABLE IF EXISTS tts_fish_voice_requests;
