-- Overlay de Promociones, Fase 6 (terceros): datos del anunciante en la pieza y interruptor del canal «Aceptar publicidad de terceros» (nace APAGADO).
-- Plan: .dev/plans/overlay-promo/PLAN.md §11. 2026-10-29
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;
ALTER TABLE promo_pieces ADD COLUMN IF NOT EXISTS advertiser_name VARCHAR(80);
ALTER TABLE promo_pieces ADD COLUMN IF NOT EXISTS advertiser_note VARCHAR(500);
ALTER TABLE promo_channel_settings ADD COLUMN IF NOT EXISTS accept_third_party BOOLEAN NOT NULL DEFAULT FALSE;
COMMIT;
