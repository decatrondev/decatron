-- Comando !watchtime configurable por streamer
-- 2026-07-22

CREATE TABLE IF NOT EXISTS watchtime_command_configs (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    command_name VARCHAR(50) NOT NULL DEFAULT '!watchtime',
    cooldown_global INTEGER NOT NULL DEFAULT 5,
    cooldown_user INTEGER NOT NULL DEFAULT 30,
    permission VARCHAR(20) NOT NULL DEFAULT 'everyone',
    track_lurkers BOOLEAN NOT NULL DEFAULT TRUE,
    min_minutes_to_respond INTEGER NOT NULL DEFAULT 0,
    time_format VARCHAR(20) NOT NULL DEFAULT 'full',
    show_position BOOLEAN NOT NULL DEFAULT FALSE,
    only_when_live BOOLEAN NOT NULL DEFAULT TRUE,
    custom_message TEXT NOT NULL DEFAULT '@{user} llevas {hours} hora(s) {minutes} minuto(s) viendo el stream',
    use_first_time_message BOOLEAN NOT NULL DEFAULT TRUE,
    first_time_message TEXT NOT NULL DEFAULT '@{user} ¡es tu primera vez en el stream! Ya llevas {hours} hora(s) {minutes} minuto(s) — ¡bienvenido/a!',
    use_not_enough_time_message BOOLEAN NOT NULL DEFAULT TRUE,
    not_enough_time_message TEXT NOT NULL DEFAULT '@{user} aún llevas muy poco tiempo, ¡sigue viendo el stream!',
    use_offline_message BOOLEAN NOT NULL DEFAULT TRUE,
    offline_message TEXT NOT NULL DEFAULT '@{user} el stream no está en vivo ahora mismo',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Un solo config por streamer, igual que shoutout_configs / sound_alert_configs
CREATE UNIQUE INDEX IF NOT EXISTS uq_watchtime_command_configs_userid ON watchtime_command_configs(user_id);
