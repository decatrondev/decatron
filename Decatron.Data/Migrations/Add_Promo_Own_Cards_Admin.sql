-- Overlay de Promociones, Fase 3b: el dueño ve y oculta las tarjetas propias de TODOS los canales. promo_own_cards tiene RLS por tenant y el
-- admin corre como tenant 1, así que la lectura y el cambio cruzan tenants solo por estas dos funciones (mismo patrón que platform_payments_all).
-- Solo cambian hidden_by_admin; no leen ni escriben nada más. 2026-10-29
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

CREATE OR REPLACE FUNCTION promo_own_cards_all()
RETURNS TABLE(id bigint, user_id bigint, login text, tenant_id bigint, title text, body text, icon text, link_url text, show_qr boolean,
              zone text, is_enabled boolean, hidden_by_admin boolean, created_at timestamp)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.id, c.user_id, COALESCE(u.login, '')::text, c.tenant_id, c.title::text, c.body::text, c.icon::text, c.link_url::text, c.show_qr,
         c.zone::text, c.is_enabled, c.hidden_by_admin, c.created_at
  FROM promo_own_cards c LEFT JOIN users u ON u.id = c.user_id
  ORDER BY c.hidden_by_admin DESC, c.id DESC
$$;

CREATE OR REPLACE FUNCTION promo_own_card_set_hidden(p_id bigint, p_hidden boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE promo_own_cards SET hidden_by_admin = p_hidden, updated_at = (now() AT TIME ZONE 'utc') WHERE id = p_id;
  RETURN FOUND;
END
$$;

REVOKE ALL ON FUNCTION promo_own_cards_all() FROM PUBLIC;
REVOKE ALL ON FUNCTION promo_own_card_set_hidden(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promo_own_cards_all() TO decatron_user, decatron_app;
GRANT EXECUTE ON FUNCTION promo_own_card_set_hidden(bigint, boolean) TO decatron_user, decatron_app;

COMMIT;
