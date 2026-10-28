-- Overlay de Promociones: comando de chat del streamer (PLAN.md §9.3). Nace APAGADO; el streamer lo activa y elige el nombre.
-- Columnas nuevas en promo_channel_settings (ya con tenant_id y RLS). 2026-10-28
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y en decatron_schema; ANTES de reiniciar el backend)
BEGIN;

ALTER TABLE promo_channel_settings
    ADD COLUMN IF NOT EXISTS cmd_enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cmd_name             VARCHAR(20) NOT NULL DEFAULT 'dpromo',
    ADD COLUMN IF NOT EXISTS cmd_cooldown_seconds INT         NOT NULL DEFAULT 10 CHECK (cmd_cooldown_seconds BETWEEN 0 AND 600),
    ADD COLUMN IF NOT EXISTS cmd_min_role         VARCHAR(12) NOT NULL DEFAULT 'moderator' CHECK (cmd_min_role IN ('moderator','vip','subscriber','everyone'));

COMMIT;
