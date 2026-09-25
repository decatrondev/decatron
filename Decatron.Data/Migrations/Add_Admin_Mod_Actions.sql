-- Admin → Mod en canales (2026-09-25). Registro de cada vez que desde admin se dio o quitó mod
-- al bot o al dueño de Decatron en un canal, usando el token del streamer.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>

CREATE TABLE IF NOT EXISTS admin_mod_actions (
    id              BIGSERIAL PRIMARY KEY,
    -- El canal (fila de users del streamer) y su login al momento del cambio
    channel_user_id BIGINT NOT NULL REFERENCES users(id),
    channel_login   VARCHAR(100) NOT NULL,
    -- bot | owner
    target          VARCHAR(20) NOT NULL,
    target_login    VARCHAR(100) NOT NULL,
    -- add | remove
    action          VARCHAR(10) NOT NULL,
    success         BOOLEAN NOT NULL,
    -- Lo que respondió Twitch cuando falló
    error           VARCHAR(500),
    admin_user_id   BIGINT NOT NULL REFERENCES users(id),
    admin_login     VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_admin_mod_actions_created ON admin_mod_actions (created_at DESC);

GRANT SELECT, INSERT ON admin_mod_actions TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE admin_mod_actions_id_seq TO decatron_user;
