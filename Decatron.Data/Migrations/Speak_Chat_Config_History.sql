-- Speak Chat, F0 (.dev/plans/speak-chat/PLAN.md): historial de cambios de la configuración.
-- Dos veces no se pudo confirmar por qué sonaron mensajes sin comando (pixipnj, el_donss) porque nadie guardaba quién cambió qué y cuándo.
-- Cada guardado de la config escribe una fila con las diferencias (campo, antes, después) y quién lo hizo. Sin llaves ni datos de pago.
-- Se conservan las últimas 100 filas por canal (la poda la hace el backend). 2026-10-20
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>   (ANTES de reiniciar el backend)
BEGIN;

CREATE TABLE IF NOT EXISTS speak_chat_config_history (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT       NOT NULL,           -- dueño del canal (speak_chat_configs.user_id)
    channel_name       VARCHAR(100) NOT NULL,
    changed_by_user_id BIGINT       NOT NULL DEFAULT 0, -- quien hizo el cambio (puede ser un editor del canal)
    changed_by_login   VARCHAR(100) NOT NULL DEFAULT '',
    changes            JSONB        NOT NULL DEFAULT '[]'::jsonb, -- [{path, before, after}]
    created_at         TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    tenant_id          BIGINT       NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id)
);
-- Si la tabla ya existía sin tenant_id (primera versión de este archivo), se completa aquí
ALTER TABLE speak_chat_config_history ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_speak_chat_config_history_user ON speak_chat_config_history(user_id, created_at DESC);

-- Igual que speak_chat_configs: una fila es de un tenant y solo ese tenant la ve
ALTER TABLE speak_chat_config_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON speak_chat_config_history;
CREATE POLICY tenant_isolation ON speak_chat_config_history USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));

GRANT SELECT, INSERT, DELETE ON speak_chat_config_history TO decatron_user, decatron_app;
GRANT USAGE, SELECT ON SEQUENCE speak_chat_config_history_id_seq TO decatron_user, decatron_app;

COMMIT;
