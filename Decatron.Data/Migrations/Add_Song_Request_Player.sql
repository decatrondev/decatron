-- Song Request fase 2 (.dev/plans/SONG_REQUEST_PLAN.md): reproductor y volumen. 2026-09-25
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>

-- Clave del reproductor: va en la URL del overlay que suena (OBS no puede iniciar sesión).
-- Sin ella nadie puede avanzar la cola haciéndose pasar por el reproductor.
ALTER TABLE song_request_configs
    ADD COLUMN IF NOT EXISTS player_key VARCHAR(64),
    ADD COLUMN IF NOT EXISTS volume INT NOT NULL DEFAULT 50;
