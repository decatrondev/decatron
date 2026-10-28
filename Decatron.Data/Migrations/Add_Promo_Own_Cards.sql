-- Overlay de Promociones, Fase 3a: tarjetas propias del streamer (solo texto, sin subir archivos). Cada una sale solo en SU canal, usa una
-- plantilla del dueño y entra a la rotación después de una pieza del bot (promo_settings.bot_per_own = cuántas del bot por cada propia).
-- hidden_by_admin: el dueño puede ocultar una tarjeta que no cumpla las reglas. Tabla de tenant con RLS. 2026-10-29
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

ALTER TABLE promo_settings
    ADD COLUMN IF NOT EXISTS bot_per_own INT NOT NULL DEFAULT 1 CHECK (bot_per_own BETWEEN 1 AND 10),
    ADD COLUMN IF NOT EXISTS own_min_interval_minutes INT NOT NULL DEFAULT 5 CHECK (own_min_interval_minutes BETWEEN 1 AND 240);

CREATE TABLE IF NOT EXISTS promo_own_cards (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT       NOT NULL,                       -- fila principal de la cuenta
    title            VARCHAR(80)  NOT NULL DEFAULT '',
    body             VARCHAR(200) NOT NULL DEFAULT '',
    icon             VARCHAR(40),
    link_url         VARCHAR(500),
    show_qr          BOOLEAN      NOT NULL DEFAULT FALSE,
    zone             VARCHAR(40)  NOT NULL DEFAULT 'corner',
    template_id      BIGINT       REFERENCES promo_templates(id) ON DELETE SET NULL,
    duration_seconds INT          NOT NULL DEFAULT 8 CHECK (duration_seconds BETWEEN 3 AND 60),
    interval_minutes INT          NOT NULL DEFAULT 10 CHECK (interval_minutes BETWEEN 1 AND 240),
    is_enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    hidden_by_admin  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at       TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    tenant_id        BIGINT       NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS ix_promo_own_cards_user ON promo_own_cards (user_id);

ALTER TABLE promo_own_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON promo_own_cards;
CREATE POLICY tenant_isolation ON promo_own_cards USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON promo_own_cards TO decatron_user, decatron_app;
GRANT USAGE, SELECT ON SEQUENCE promo_own_cards_id_seq TO decatron_user, decatron_app;

COMMIT;
