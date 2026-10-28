-- Overlay de Promociones, Fase 3b: disparadores del streamer (inicio de directo y raid). Cada uno: encendido, pieza que sale (id del bot > 0,
-- tarjeta propia < 0, NULL = la siguiente de la rotación) y segundos de espera antes de que salga. 2026-10-29
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

ALTER TABLE promo_channel_settings
    ADD COLUMN IF NOT EXISTS trigger_start_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trigger_start_piece_id BIGINT,
    ADD COLUMN IF NOT EXISTS trigger_start_delay_seconds INT NOT NULL DEFAULT 10 CHECK (trigger_start_delay_seconds BETWEEN 0 AND 120),
    ADD COLUMN IF NOT EXISTS trigger_raid_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trigger_raid_piece_id BIGINT,
    ADD COLUMN IF NOT EXISTS trigger_raid_delay_seconds INT NOT NULL DEFAULT 10 CHECK (trigger_raid_delay_seconds BETWEEN 0 AND 120);

COMMIT;
