-- Overlay de Promociones, Fase 2 (.dev/plans/overlay-promo/PLAN.md): lo que cada streamer decide sobre el catálogo del dueño.
-- Una fila por cuenta (user_id = fila principal): pausar todo, apagar piezas concretas y ser MÁS discreto que los topes globales
-- (nunca más insistente: el servidor toma el mayor mínimo entre piezas y el menor tope por hora). Con tenant_id y RLS como el resto
-- de las configuraciones por canal. 2026-10-28
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

CREATE TABLE IF NOT EXISTS promo_channel_settings (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT      NOT NULL UNIQUE,                 -- fila principal de la cuenta (AccountChannels.Principal)
    paused             BOOLEAN     NOT NULL DEFAULT FALSE,
    disabled_pieces    JSONB       NOT NULL DEFAULT '[]'::jsonb,    -- ids de promo_pieces que este streamer apagó
    min_gap_seconds    INT         CHECK (min_gap_seconds IS NULL OR min_gap_seconds BETWEEN 0 AND 3600),
    hourly_cap_seconds INT         CHECK (hourly_cap_seconds IS NULL OR hourly_cap_seconds BETWEEN 0 AND 3600),
    updated_at         TIMESTAMP   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    tenant_id          BIGINT      NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id)
);

ALTER TABLE promo_channel_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON promo_channel_settings;
CREATE POLICY tenant_isolation ON promo_channel_settings USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON promo_channel_settings TO decatron_user, decatron_app;
GRANT USAGE, SELECT ON SEQUENCE promo_channel_settings_id_seq TO decatron_user, decatron_app;

COMMIT;
