-- Overlay de Promociones, ajustes de estilo por streamer (B2, PLAN.md §3.3c): el dueño declara en el diseño de cada plantilla qué
-- colores, textos fijos y tipografías puede cambiar el streamer (`slots`); aquí se guarda lo que eligió cada canal, por plantilla.
-- Borrar la fila = vuelve al valor del dueño. Tabla de tenant con RLS. 2026-10-28
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

CREATE TABLE IF NOT EXISTS promo_template_overrides (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT    NOT NULL,                              -- fila principal de la cuenta
    template_id BIGINT    NOT NULL REFERENCES promo_templates(id) ON DELETE CASCADE,
    style       TEXT      NOT NULL DEFAULT '{}',                 -- JSON {idDelAjuste: valor}, validado en el servidor
    updated_at  TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    tenant_id   BIGINT    NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
    UNIQUE (user_id, template_id)
);

ALTER TABLE promo_template_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON promo_template_overrides;
CREATE POLICY tenant_isolation ON promo_template_overrides USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON promo_template_overrides TO decatron_user, decatron_app;
GRANT USAGE, SELECT ON SEQUENCE promo_template_overrides_id_seq TO decatron_user, decatron_app;

COMMIT;
