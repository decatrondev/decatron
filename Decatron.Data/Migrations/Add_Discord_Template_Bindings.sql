-- Cargador de la plantilla del servidor de Discord (.dev/plans/DISCORD_SERVIDOR_PLAN.md). 2026-10-11
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS discord_template_bindings (
    id           BIGSERIAL PRIMARY KEY,
    guild_id     VARCHAR(32)  NOT NULL,
    template_key VARCHAR(100) NOT NULL,
    object_key   VARCHAR(200) NOT NULL,
    discord_id   VARCHAR(32)  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_discord_template_bindings UNIQUE (guild_id, template_key, object_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON discord_template_bindings TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE discord_template_bindings_id_seq TO decatron_user;
