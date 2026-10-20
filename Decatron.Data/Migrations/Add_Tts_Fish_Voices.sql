-- Catálogo de voces de personaje (Fish Audio) curado desde el admin.
-- Solo las voces activas aparecen en los selectores de Speak Chat, Event Alerts, Tips y Timers;
-- una voz que no esté aquí (o esté inactiva) se cambia por la predeterminada al sintetizar.
-- Idempotente.

CREATE TABLE IF NOT EXISTS tts_fish_voices (
    reference_id   VARCHAR(32)  PRIMARY KEY,
    name           TEXT         NOT NULL,
    -- códigos de idioma que declara la voz en Fish (es, en, ja...), separados por coma
    languages      TEXT         NOT NULL DEFAULT '',
    author         TEXT,
    sample_url     TEXT,
    -- commercial | noncommercial | unknown  (lo anota el admin; Fish no garantiza uso comercial)
    license        VARCHAR(20)  NOT NULL DEFAULT 'unknown',
    license_note   TEXT,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    -- por qué quedó inactiva: manual | missing (Fish ya no la devuelve) | takedown
    inactive_reason VARCHAR(20),
    -- admin | request (la pidió un streamer, ver A5)
    source         VARCHAR(20)  NOT NULL DEFAULT 'admin',
    created_by     BIGINT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ,
    CONSTRAINT chk_tts_fish_voices_license CHECK (license IN ('commercial','noncommercial','unknown'))
);

CREATE INDEX IF NOT EXISTS ix_tts_fish_voices_active ON tts_fish_voices (active);

-- La voz que ya usan los canales hasta ahora
INSERT INTO tts_fish_voices (reference_id, name, languages, author, license, license_note)
VALUES ('4eb30374137749b9a377f06674a3ca22', 'Toji · español latino', 'es', 'JOA549582', 'unknown',
        'Voz pública de Fish; la licencia es la de su autor y Fish no garantiza uso comercial.')
ON CONFLICT (reference_id) DO NOTHING;

-- Permisos (la tabla la crea postgres): GRANT SELECT,INSERT,UPDATE,DELETE ON tts_fish_voices TO decatron_app; GRANT ALL ON tts_fish_voices TO decatron_user;

-- Reverso:
--   DROP TABLE IF EXISTS tts_fish_voices;
