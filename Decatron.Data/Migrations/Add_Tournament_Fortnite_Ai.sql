-- Modulo de Torneos — Fortnite F8: lectura de capturas con IA (27-09-2026).
-- Ver .dev/torneos/15-fortnite.md. Idempotente.
--
-- Apagada por defecto; la activa el streamer y se cobra de los creditos de su canal
-- (mismo sistema que el resto de la IA). La lectura prellena el reporte, el jugador
-- confirma, y el organizador ve si lo reportado no coincide con lo que leyo la IA.

BEGIN;

ALTER TABLE tournament_fortnite_configs
    ADD COLUMN IF NOT EXISTS ai_screenshot_reading BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tournament_fortnite_files
    ADD COLUMN IF NOT EXISTS ai_placement    SMALLINT,
    ADD COLUMN IF NOT EXISTS ai_eliminations SMALLINT,
    -- Aviso de la IA, ej. "no parece la pantalla final de la partida"
    ADD COLUMN IF NOT EXISTS ai_note         VARCHAR(200),
    ADD COLUMN IF NOT EXISTS ai_read_at      TIMESTAMP;

COMMIT;
