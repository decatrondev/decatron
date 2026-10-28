-- Overlay de Promociones, ajustes por streamer (PLAN.md §3.3c): el dueño fija el valor por defecto y los LIMITES; el streamer guarda
-- lo suyo aparte (duración, plantilla y escala por pieza; ancla y márgenes por zona) y puede volver al valor del dueño borrando la fila.
-- Las dos tablas nuevas llevan tenant_id y RLS como el resto de las configuraciones por canal. 2026-10-28
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

ALTER TABLE promo_settings
    ADD COLUMN IF NOT EXISTS min_duration_seconds INT NOT NULL DEFAULT 5   CHECK (min_duration_seconds BETWEEN 1 AND 300),
    ADD COLUMN IF NOT EXISTS max_duration_seconds INT NOT NULL DEFAULT 60  CHECK (max_duration_seconds BETWEEN 1 AND 300),
    ADD COLUMN IF NOT EXISTS min_scale_percent    INT NOT NULL DEFAULT 60  CHECK (min_scale_percent BETWEEN 20 AND 300),
    ADD COLUMN IF NOT EXISTS max_scale_percent    INT NOT NULL DEFAULT 150 CHECK (max_scale_percent BETWEEN 20 AND 300),
    ADD COLUMN IF NOT EXISTS max_zone_margin      INT NOT NULL DEFAULT 600 CHECK (max_zone_margin BETWEEN 0 AND 1000);

CREATE TABLE IF NOT EXISTS promo_piece_overrides (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT    NOT NULL,                          -- fila principal de la cuenta
    piece_id         BIGINT    NOT NULL REFERENCES promo_pieces(id) ON DELETE CASCADE,
    duration_seconds INT       CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 300),
    template_id      BIGINT    REFERENCES promo_templates(id) ON DELETE SET NULL,
    scale_percent    INT       CHECK (scale_percent IS NULL OR scale_percent BETWEEN 20 AND 300),
    updated_at       TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    tenant_id        BIGINT    NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
    UNIQUE (user_id, piece_id)
);

CREATE TABLE IF NOT EXISTS promo_zone_overrides (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL,
    zone_key   VARCHAR(40) NOT NULL,
    anchor     VARCHAR(16) NOT NULL,
    margin_x   INT         NOT NULL CHECK (margin_x BETWEEN 0 AND 1000),
    margin_y   INT         NOT NULL CHECK (margin_y BETWEEN 0 AND 1000),
    updated_at TIMESTAMP   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    tenant_id  BIGINT      NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
    UNIQUE (user_id, zone_key)
);

ALTER TABLE promo_piece_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON promo_piece_overrides;
CREATE POLICY tenant_isolation ON promo_piece_overrides USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));
ALTER TABLE promo_zone_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON promo_zone_overrides;
CREATE POLICY tenant_isolation ON promo_zone_overrides USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON promo_piece_overrides, promo_zone_overrides TO decatron_user, decatron_app;
GRANT USAGE, SELECT ON SEQUENCE promo_piece_overrides_id_seq, promo_zone_overrides_id_seq TO decatron_user, decatron_app;

COMMIT;
