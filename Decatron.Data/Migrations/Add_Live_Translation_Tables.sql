-- Traducción en vivo (doblaje por espectador). Plan: .dev/plans/REALTIME_TRANSLATION_PLAN.md
-- Fase 1 — 2026-09-18

CREATE TABLE IF NOT EXISTS live_translation_settings (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    source_language     VARCHAR(10) NOT NULL DEFAULT 'es',
    target_languages    VARCHAR(200) NOT NULL DEFAULT 'en',
    voice_engine        VARCHAR(20) NOT NULL DEFAULT 'deepgram',
    voices_json         TEXT NOT NULL DEFAULT '{}',
    announce_in_chat    BOOLEAN NOT NULL DEFAULT TRUE,
    announce_message    VARCHAR(400),
    background_volume   INT NOT NULL DEFAULT 15,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_translation_devices (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(80) NOT NULL DEFAULT '',
    token_hash    VARCHAR(64) NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_live_translation_devices_user ON live_translation_devices(user_id);

CREATE TABLE IF NOT EXISTS live_translation_sessions (
    id                     BIGSERIAL PRIMARY KEY,
    user_id                BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id              BIGINT REFERENCES live_translation_devices(id) ON DELETE SET NULL,
    started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at               TIMESTAMPTZ,
    speech_seconds         DOUBLE PRECISION NOT NULL DEFAULT 0,
    segments               INT NOT NULL DEFAULT 0,
    chars_by_language_json TEXT NOT NULL DEFAULT '{}',
    peak_listeners         INT NOT NULL DEFAULT 0,
    credits_used           BIGINT NOT NULL DEFAULT 0,
    end_reason             VARCHAR(30)
);
CREATE INDEX IF NOT EXISTS ix_live_translation_sessions_user_started ON live_translation_sessions(user_id, started_at DESC);
