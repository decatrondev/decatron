-- Modulo de Torneos — Fortnite F5: ranking en vivo (27-09-2026).
-- Ver .dev/torneos/15-fortnite.md. Idempotente.
--
-- La tabla de posiciones se calcula al vuelo desde tournament_fortnite_results; lo
-- unico nuevo es si el streamer deja ver las capturas en la pagina publica.

BEGIN;

ALTER TABLE tournament_fortnite_configs
    ADD COLUMN IF NOT EXISTS public_screenshots BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
