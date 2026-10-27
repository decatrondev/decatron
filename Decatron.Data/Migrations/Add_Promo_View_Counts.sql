-- Overlay de Promociones, Fase 2: contador de vistas, agregado y sin identificar personas. 2026-10-28
-- Dos tablas: promo_view_counts (por cuenta, pieza y día; con tenant_id y RLS) para que el streamer vea cuántas veces salió cada pieza en su canal,
-- y promo_piece_daily (global, por pieza y día, sin canal) para que el dueño vea el total. Solo se cuenta "pieza entregada al overlay";
-- no se guarda IP, espectador ni nada que identifique a una persona.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

CREATE TABLE IF NOT EXISTS promo_view_counts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,                                   -- fila principal de la cuenta
    piece_id   BIGINT NOT NULL REFERENCES promo_pieces(id) ON DELETE CASCADE,
    day        DATE   NOT NULL,                                   -- UTC
    views      INT    NOT NULL DEFAULT 0,
    tenant_id  BIGINT NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
    UNIQUE (user_id, piece_id, day)
);
CREATE INDEX IF NOT EXISTS ix_promo_view_counts_user_day ON promo_view_counts (user_id, day);
ALTER TABLE promo_view_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON promo_view_counts;
CREATE POLICY tenant_isolation ON promo_view_counts USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));

CREATE TABLE IF NOT EXISTS promo_piece_daily (
    piece_id BIGINT NOT NULL REFERENCES promo_pieces(id) ON DELETE CASCADE,
    day      DATE   NOT NULL,
    views    INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (piece_id, day)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON promo_view_counts, promo_piece_daily TO decatron_user, decatron_app;
GRANT USAGE, SELECT ON SEQUENCE promo_view_counts_id_seq TO decatron_user, decatron_app;

COMMIT;
