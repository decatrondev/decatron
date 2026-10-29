-- Overlay de Promociones: ids de las cuentas que aceptan publicidad de terceros, de todos los tenants (para el admin del dueño).
-- SECURITY DEFINER por la misma razón que promo_disabled_counts(): promo_channel_settings tiene RLS por tenant.
CREATE OR REPLACE FUNCTION promo_third_party_channels() RETURNS TABLE(user_id bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT s.user_id FROM promo_channel_settings s WHERE s.accept_third_party
$$;
