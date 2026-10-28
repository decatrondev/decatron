-- Overlay de Promociones, Fase 4: estadísticas. 2026-10-29
--  · seconds (tiempo en pantalla = duración de cada entrega) en los dos contadores que ya existen.
--  · promo_own_card_counts: entregas de las tarjetas propias por canal y día (tabla de tenant con RLS; se borra con la tarjeta).
--  · promo_purge_old_views(dias): borra el historial por canal con más de N días (el global, promo_piece_daily, no se borra nunca).
--  · promo_disabled_counts(): en cuántos canales está apagada cada pieza; cruza tenants solo por esta función (patrón promo_own_cards_all).
-- Solo agregados: no se guarda IP, espectador ni nada que identifique a una persona.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

ALTER TABLE promo_view_counts ADD COLUMN IF NOT EXISTS seconds INT NOT NULL DEFAULT 0;
ALTER TABLE promo_piece_daily ADD COLUMN IF NOT EXISTS seconds BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS promo_own_card_counts (
    id        BIGSERIAL PRIMARY KEY,
    user_id   BIGINT NOT NULL,                                   -- fila principal de la cuenta
    card_id   BIGINT NOT NULL REFERENCES promo_own_cards(id) ON DELETE CASCADE,
    day       DATE   NOT NULL,                                   -- UTC
    views     INT    NOT NULL DEFAULT 0,
    seconds   INT    NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
    UNIQUE (user_id, card_id, day)
);
CREATE INDEX IF NOT EXISTS ix_promo_own_card_counts_user_day ON promo_own_card_counts (user_id, day);
ALTER TABLE promo_own_card_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON promo_own_card_counts;
CREATE POLICY tenant_isolation ON promo_own_card_counts USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON promo_own_card_counts TO decatron_user, decatron_app;
GRANT USAGE, SELECT ON SEQUENCE promo_own_card_counts_id_seq TO decatron_user, decatron_app;

CREATE OR REPLACE FUNCTION promo_purge_old_views(p_days integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE n integer; m integer;
BEGIN
  DELETE FROM promo_view_counts WHERE day < ((now() AT TIME ZONE 'utc')::date - p_days);
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM promo_own_card_counts WHERE day < ((now() AT TIME ZONE 'utc')::date - p_days);
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END
$$;

CREATE OR REPLACE FUNCTION promo_disabled_counts()
RETURNS TABLE(piece_id bigint, channels integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (e.value)::bigint, COUNT(*)::integer
  FROM promo_channel_settings s, jsonb_array_elements_text(s.disabled_pieces) e
  GROUP BY 1
$$;

REVOKE ALL ON FUNCTION promo_purge_old_views(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION promo_disabled_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promo_purge_old_views(integer) TO decatron_user, decatron_app;
GRANT EXECUTE ON FUNCTION promo_disabled_counts() TO decatron_user, decatron_app;

COMMIT;
