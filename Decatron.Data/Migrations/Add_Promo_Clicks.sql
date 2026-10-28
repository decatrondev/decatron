-- Overlay de Promociones: clics del QR / enlace corto, agregados por pieza (o tarjeta propia) y día, sin IP ni nada que identifique a quien hace clic. 2026-10-29
-- Mismas tablas y reglas de historial que las vistas (por canal 90 días con borrado diario; el global de piezas no se borra).
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;
ALTER TABLE promo_view_counts ADD COLUMN IF NOT EXISTS clicks INT NOT NULL DEFAULT 0;
ALTER TABLE promo_own_card_counts ADD COLUMN IF NOT EXISTS clicks INT NOT NULL DEFAULT 0;
ALTER TABLE promo_piece_daily ADD COLUMN IF NOT EXISTS clicks BIGINT NOT NULL DEFAULT 0;
COMMIT;
