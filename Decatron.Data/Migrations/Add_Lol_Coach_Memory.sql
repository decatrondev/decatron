-- Coach de LoL: memoria del coach en la base. 2026-09-23
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
-- Lo que el coach ya dijo y ya comentó (historial, lobby, tilt check, aviso de saldo) vivía en
-- memoria: cada reinicio del backend o reconexión del Desktop lo borraba y el coach actuaba
-- como si el streamer recién empezara (repetía el comentario del lobby, el panel quedaba vacío).
ALTER TABLE lol_coach_settings
    ADD COLUMN IF NOT EXISTS coach_memory TEXT NOT NULL DEFAULT '';
