-- Overlay de Promociones, Fase 5: imagen opcional en las tarjetas propias. 2026-10-29
-- La imagen (ya reprocesada a WebP) se registra en la biblioteca de medios (timer_media_files, categoría «promo») para que cuente contra la cuota
-- de almacenamiento del plan. image_media_id se pone en NULL solo si alguien borra el archivo desde la biblioteca; image_url es la ruta pública.
-- promo_own_card_clear_image: el dueño quita la imagen de una tarjeta de cualquier canal (RLS cruzada solo por esta función, patrón promo_own_cards_all);
-- devuelve la ruta del archivo para que el backend lo borre del disco.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

ALTER TABLE promo_own_cards
    ADD COLUMN IF NOT EXISTS image_media_id INT REFERENCES timer_media_files(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(300);

DROP FUNCTION IF EXISTS promo_own_cards_all();
CREATE FUNCTION promo_own_cards_all()
RETURNS TABLE(id bigint, user_id bigint, login text, tenant_id bigint, title text, body text, icon text, link_url text, show_qr boolean,
              zone text, is_enabled boolean, hidden_by_admin boolean, created_at timestamp, image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.id, c.user_id, COALESCE(u.login, '')::text, c.tenant_id, c.title::text, c.body::text, c.icon::text, c.link_url::text, c.show_qr,
         c.zone::text, c.is_enabled, c.hidden_by_admin, c.created_at, CASE WHEN c.image_media_id IS NULL THEN NULL ELSE c.image_url END::text
  FROM promo_own_cards c LEFT JOIN users u ON u.id = c.user_id
  ORDER BY c.hidden_by_admin DESC, c.id DESC
$$;

CREATE OR REPLACE FUNCTION promo_own_card_clear_image(p_id bigint)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_media int; v_path text;
BEGIN
  SELECT image_media_id INTO v_media FROM promo_own_cards WHERE id = p_id;
  IF v_media IS NOT NULL THEN
    SELECT file_path INTO v_path FROM timer_media_files WHERE id = v_media;
    DELETE FROM timer_media_files WHERE id = v_media;
  END IF;
  UPDATE promo_own_cards SET image_media_id = NULL, image_url = NULL, updated_at = (now() AT TIME ZONE 'utc') WHERE id = p_id;
  RETURN v_path;
END
$$;

REVOKE ALL ON FUNCTION promo_own_cards_all() FROM PUBLIC;
REVOKE ALL ON FUNCTION promo_own_card_clear_image(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promo_own_cards_all() TO decatron_user, decatron_app;
GRANT EXECUTE ON FUNCTION promo_own_card_clear_image(bigint) TO decatron_user, decatron_app;

COMMIT;
