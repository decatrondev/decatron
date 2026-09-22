-- Mascotas fase 2: quién ya escribió en cada canal, para el saludo a nuevos (PETS_PLAN.md D5). 2026-09-21
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS pet_seen_chatters (
    channel_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chatter_login   VARCHAR(100) NOT NULL,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_user_id, chatter_login)
);
