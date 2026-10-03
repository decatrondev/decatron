-- Song Request: "detener" (!srstop) — el reproductor se calla y el overlay se oculta; al reanudar (!srresume) se ve de nuevo
-- y suena donde se quedó. Es distinto de pausar (is_paused), donde el overlay sigue a la vista. 2026-10-03
-- Detener = is_stopped + is_paused; reanudar apaga las dos.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
ALTER TABLE song_request_configs ADD COLUMN IF NOT EXISTS is_stopped BOOLEAN NOT NULL DEFAULT FALSE;
