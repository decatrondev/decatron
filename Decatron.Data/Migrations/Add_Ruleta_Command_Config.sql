-- Comando !ruleta configurable por streamer, mas cola de restauracion de mod
-- 2026-08-25

CREATE TABLE IF NOT EXISTS ruleta_command_configs (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    command_name VARCHAR(50) NOT NULL DEFAULT '!ruleta',
    chance_percent INTEGER NOT NULL DEFAULT 17,
    min_timeout_seconds INTEGER NOT NULL DEFAULT 60,
    max_timeout_seconds INTEGER NOT NULL DEFAULT 60,
    cooldown_global INTEGER NOT NULL DEFAULT 10,
    cooldown_user INTEGER NOT NULL DEFAULT 30,
    permission VARCHAR(20) NOT NULL DEFAULT 'everyone',
    allow_self_target BOOLEAN NOT NULL DEFAULT TRUE,
    allow_target_moderators BOOLEAN NOT NULL DEFAULT FALSE,
    hit_message TEXT NOT NULL DEFAULT '🔫💥 BANG! @{shooter} le disparó a @{target} — {seconds}s de timeout',
    miss_message TEXT NOT NULL DEFAULT '🔫 *click* @{shooter} apuntó a @{target}... y sobrevivió',
    use_self_messages BOOLEAN NOT NULL DEFAULT TRUE,
    self_hit_message TEXT NOT NULL DEFAULT '🔫💥 @{shooter} se apuntó a sí mismo... BANG! {seconds}s de timeout',
    self_miss_message TEXT NOT NULL DEFAULT '🔫 @{shooter} se apuntó a sí mismo... *click* sobrevivió de milagro',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Un solo config por streamer, igual que watchtime_command_configs
CREATE UNIQUE INDEX IF NOT EXISTS uq_ruleta_command_configs_userid ON ruleta_command_configs(user_id);

-- Cola de restauracion de moderador cuando !ruleta le da a un mod (ver RuletaModRestore.cs)
CREATE TABLE IF NOT EXISTS ruleta_mod_restores (
    id SERIAL PRIMARY KEY,
    channel_login VARCHAR(255) NOT NULL,
    target_username VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ruleta_mod_restores_pending ON ruleta_mod_restores(processed, expires_at) WHERE NOT processed;
