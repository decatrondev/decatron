-- Overlay de Promociones: interruptor del dueño «una pieza a la vez entre todas las zonas». Encendido por defecto: el overlay no abruma el stream
-- aunque el streamer coloque dos zonas una encima de la otra. 2026-10-29
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;
ALTER TABLE promo_settings ADD COLUMN IF NOT EXISTS one_at_a_time BOOLEAN NOT NULL DEFAULT TRUE;
COMMIT;
