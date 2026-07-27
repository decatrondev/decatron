BEGIN;

CREATE TABLE IF NOT EXISTS gacha_sound_configs (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    master_volume INTEGER NOT NULL DEFAULT 80,
    enable_sounds BOOLEAN NOT NULL DEFAULT TRUE,
    sounds_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gacha_sound_config_channel UNIQUE (channel_name)
);

CREATE INDEX IF NOT EXISTS idx_gacha_sound_configs_channel ON gacha_sound_configs(channel_name);

COMMIT;
