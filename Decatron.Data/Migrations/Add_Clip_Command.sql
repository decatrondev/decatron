-- Comando !clip (.dev/plans/CLIP_COMANDO_PLAN.md), fase 1. 2026-10-11
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
-- Solo agrega tablas: se puede aplicar antes de desplegar el backend sin afectar nada de lo actual.

-- Config por canal. Sin fila = comando apagado. Los mensajes editables van en la columna messages ({"chat":{"clave":{"es":"..","en":".."}}}),
-- igual que la Rueda; vacío = el texto base de Decatron.
-- El umbral de espacio libre en disco (10 GB) es global y va en appsettings (ClipCommandSettings), no por canal.
CREATE TABLE IF NOT EXISTS clip_command_configs (
    id                       BIGSERIAL PRIMARY KEY,
    user_id                  BIGINT NOT NULL REFERENCES users(id),
    channel_name             VARCHAR(100) NOT NULL,
    enabled                  BOOLEAN NOT NULL DEFAULT FALSE,
    -- Idioma de las respuestas del bot en el chat: es | en
    language                 VARCHAR(2) NOT NULL DEFAULT 'es',
    messages                 JSONB NOT NULL DEFAULT '{}',
    -- everyone | follower | subscriber | vip | moderator | lead_moderator | broadcaster
    min_role                 VARCHAR(20) NOT NULL DEFAULT 'everyone',
    -- Cooldowns en segundos (0 = sin cooldown)
    global_cooldown_seconds  INT NOT NULL DEFAULT 30,
    user_cooldown_seconds    INT NOT NULL DEFAULT 120,
    staff_skip_user_cooldown BOOLEAN NOT NULL DEFAULT TRUE,
    -- Tope por usuario en cada stream (NULL = sin tope)
    max_per_user_per_stream  INT,
    -- Duración en segundos; Twitch acepta de 5 a 60 con precisión de 0.1
    default_duration         NUMERIC(4,1) NOT NULL DEFAULT 30,
    min_duration             NUMERIC(4,1) NOT NULL DEFAULT 5,
    max_duration             NUMERIC(4,1) NOT NULL DEFAULT 60,
    allow_viewer_duration    BOOLEAN NOT NULL DEFAULT TRUE,
    allow_title              BOOLEAN NOT NULL DEFAULT TRUE,
    -- Twitch limita el título a 100 caracteres
    max_title_length         INT NOT NULL DEFAULT 100,
    -- Otros nombres del comando, separados por coma, sin "!" (ej: "clipear,clipa")
    aliases                  VARCHAR(300) NOT NULL DEFAULT '',
    -- Kick no permite crear clips por API: message = avisa que no está disponible, silent = no responde
    unsupported_platform_mode VARCHAR(10) NOT NULL DEFAULT 'message',
    -- Descarga al archivo de la plataforma (caché y red social). Apagada: solo se guarda el enlace
    download_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    -- Tope de descargas por mes (NULL = sin tope; lo fija solo el admin)
    download_monthly_cap     INT,
    -- Días que se conserva el historial (NULL = para siempre)
    history_retention_days   INT DEFAULT 90,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clip_command_configs_user UNIQUE (user_id),
    CONSTRAINT chk_clip_cmd_min_role CHECK (min_role IN
        ('everyone','follower','subscriber','vip','moderator','lead_moderator','broadcaster')),
    CONSTRAINT chk_clip_cmd_cooldowns CHECK (global_cooldown_seconds >= 0 AND user_cooldown_seconds >= 0),
    CONSTRAINT chk_clip_cmd_durations CHECK (
        min_duration >= 5 AND max_duration <= 60 AND min_duration <= max_duration
        AND default_duration BETWEEN min_duration AND max_duration),
    CONSTRAINT chk_clip_cmd_title_length CHECK (max_title_length BETWEEN 1 AND 100),
    CONSTRAINT chk_clip_cmd_language CHECK (language IN ('es','en')),
    CONSTRAINT chk_clip_cmd_unsupported CHECK (unsupported_platform_mode IN ('message','silent')),
    CONSTRAINT chk_clip_cmd_caps CHECK (
        (max_per_user_per_stream IS NULL OR max_per_user_per_stream > 0)
        AND (download_monthly_cap IS NULL OR download_monthly_cap > 0)
        AND (history_retention_days IS NULL OR history_retention_days > 0))
);

-- Usuarios que no pueden usar !clip en el canal.
CREATE TABLE IF NOT EXISTS clip_command_blocks (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    twitch_user_id  VARCHAR(50) NOT NULL,
    twitch_login    VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clip_command_blocks UNIQUE (user_id, twitch_user_id)
);

-- Historial: un intento por fila (también los fallidos, para poder diagnosticar).
CREATE TABLE IF NOT EXISTS clip_command_history (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id),
    channel_name      VARCHAR(100) NOT NULL,
    -- created | failed
    status            VARCHAR(10) NOT NULL,
    -- NULL si falló antes de crearse. Error: offline, no_scope, clips_disabled, followers_only, not_clippable, automod_title, timeout, ...
    clip_id           VARCHAR(150),
    clip_url          VARCHAR(300),
    error_code        VARCHAR(40),
    title             VARCHAR(200),
    duration_seconds  NUMERIC(4,1),
    requested_by_id   VARCHAR(50) NOT NULL,
    requested_by_login VARCHAR(100) NOT NULL,
    requested_by_role VARCHAR(20) NOT NULL DEFAULT 'everyone',
    -- Descarga al archivo de la plataforma (se guarda por id del clip)
    downloaded        BOOLEAN NOT NULL DEFAULT FALSE,
    local_path        VARCHAR(500),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_clip_cmd_history_status CHECK (status IN ('created','failed'))
);
CREATE INDEX IF NOT EXISTS idx_clip_cmd_history_channel ON clip_command_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clip_cmd_history_requester ON clip_command_history (user_id, requested_by_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clip_cmd_history_clip ON clip_command_history (user_id, clip_id) WHERE clip_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON clip_command_configs, clip_command_blocks, clip_command_history TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE clip_command_configs_id_seq, clip_command_blocks_id_seq, clip_command_history_id_seq TO decatron_user;

-- Para quien ya aplicó la primera versión de este archivo (2026-10-11): agrega lo que se sumó después.
ALTER TABLE clip_command_configs ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'es';
ALTER TABLE clip_command_configs ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '{}';
DO $$ BEGIN
    ALTER TABLE clip_command_configs ADD CONSTRAINT chk_clip_cmd_language CHECK (language IN ('es','en'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
