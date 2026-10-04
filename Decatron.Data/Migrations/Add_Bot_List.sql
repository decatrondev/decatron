-- Lista de bots, fase 0 (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md).

-- Catálogo global de bots conocidos (lo mantiene el owner desde /admin). Aplica a todos los
-- canales salvo que el streamer lo apague o cambie sus efectos.
CREATE TABLE IF NOT EXISTS bot_catalog (
    id           BIGSERIAL PRIMARY KEY,
    platform     VARCHAR(10)  NOT NULL DEFAULT 'twitch',
    -- Usuario en minúsculas (en Kick, con "_" en lugar de "-")
    username     VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    category     VARCHAR(20)  NOT NULL,
    notes        VARCHAR(300),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bot_catalog_platform CHECK (platform IN ('twitch', 'kick', 'youtube')),
    CONSTRAINT chk_bot_catalog_category CHECK (category IN ('competencia', 'moderacion', 'musica', 'alertas', 'utilidad', 'propio')),
    CONSTRAINT uq_bot_catalog UNIQUE (platform, username)
);

-- Lo que cada canal cambia sobre el catálogo (apagar un bot, ajustar efectos) y los bots
-- que agrega por su cuenta. Un efecto en NULL usa el valor por defecto de la categoría.
CREATE TABLE IF NOT EXISTS channel_bot_entries (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    platform        VARCHAR(10)  NOT NULL DEFAULT 'twitch',
    username        VARCHAR(100) NOT NULL,
    -- Solo los bots propios del canal (is_custom) traen nombre y categoría; los del catálogo los toman de allá
    display_name    VARCHAR(100),
    category        VARCHAR(20),
    is_custom       BOOLEAN NOT NULL DEFAULT FALSE,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    hide_overlay    BOOLEAN,
    skip_counting   BOOLEAN,
    skip_commands   BOOLEAN,
    skip_moderation BOOLEAN,
    skip_speech     BOOLEAN,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_channel_bot_platform CHECK (platform IN ('twitch', 'kick', 'youtube')),
    CONSTRAINT chk_channel_bot_category CHECK (category IS NULL OR category IN ('competencia', 'moderacion', 'musica', 'alertas', 'utilidad', 'propio')),
    CONSTRAINT uq_channel_bot_entries UNIQUE (user_id, platform, username)
);
CREATE INDEX IF NOT EXISTS idx_channel_bot_entries_user_id ON channel_bot_entries(user_id);

-- Semilla armada con datos reales (chat_messages, 2026-10-04): solo cuentas confirmadas como bots
-- leyendo sus mensajes. Ojo: no se puede decidir por "termina en bot" (botsitanat es una persona).
INSERT INTO bot_catalog (platform, username, display_name, category, notes) VALUES
    ('twitch', 'nightbot',           'Nightbot',        'competencia', NULL),
    ('twitch', 'streamelements',     'StreamElements',  'competencia', NULL),
    ('twitch', 'streamlabs',         'Streamlabs',      'competencia', NULL),
    ('twitch', 'moobot',             'Moobot',          'competencia', NULL),
    ('twitch', 'fossabot',           'Fossabot',        'competencia', NULL),
    ('twitch', 'wizebot',            'WizeBot',         'competencia', NULL),
    ('twitch', 'botrixoficial',      'Botrix',          'competencia', NULL),
    ('twitch', 'deepbot',            'DeepBot',         'competencia', NULL),
    ('twitch', 'soundalerts',        'SoundAlerts',     'alertas',     NULL),
    ('twitch', 'blerp',              'Blerp',           'alertas',     NULL),
    ('twitch', 'streamlootsbot',     'Streamloots',     'alertas',     NULL),
    ('twitch', 'supibot',            'Supibot',         'utilidad',    NULL),
    ('twitch', 'commanderroot',      'CommanderRoot',   'utilidad',    NULL),
    ('twitch', 'spanixbot',          'SpanixBot',       'utilidad',    NULL),
    ('twitch', 'sery_bot',           'Sery_Bot',        'utilidad',    NULL),
    ('twitch', 'decatronstreambot',  'Decatron',        'propio',      'La cuenta del bot de Decatron')
ON CONFLICT (platform, username) DO NOTHING;
