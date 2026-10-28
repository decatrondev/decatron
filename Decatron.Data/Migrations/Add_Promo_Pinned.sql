-- Overlay de Promociones: piezas «fijas». El dueño marca una pieza como fija; mientras el canal tenga tarjetas propias en uso, el streamer no puede
-- apagarla ni acortarla/achicarla por debajo del valor del dueño (el resto, posición y tope por hora, sigue igual). Sin tarjetas propias nada cambia. 2026-10-29
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;
ALTER TABLE promo_pieces ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
COMMIT;
