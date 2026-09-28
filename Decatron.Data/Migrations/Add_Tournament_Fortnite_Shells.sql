-- Modulo de Torneos — Fortnite F6: castigos (27-09-2026). Ver .dev/torneos/15-fortnite.md.
-- Idempotente. Reusa las tablas del motor de castigos de LoL (tournament_shell_*,
-- tournament_punishment_types); en Fortnite las fichas son del equipo y las guarda
-- un jugador del equipo (el de menor id entre los aprobados).
--
-- Condiciones nuevas de tournament_shell_triggers.condition_type para Fortnite:
--   fn_win          ganar una partida
--   fn_eliminations X o mas eliminaciones del equipo en una partida
--   fn_top_streak   quedar top N (threshold_value) en K partidas seguidas (streak_length)
--   fn_comeback     subir X puestos en la tabla en una sesion

BEGIN;

ALTER TABLE tournament_shell_triggers
    ADD COLUMN IF NOT EXISTS streak_length SMALLINT;

-- Para no evaluar dos veces la misma partida o sesion (se evalua al cerrarla).
ALTER TABLE tournament_fortnite_games
    ADD COLUMN IF NOT EXISTS shells_evaluated_at TIMESTAMP;
ALTER TABLE tournament_fortnite_sessions
    ADD COLUMN IF NOT EXISTS shells_evaluated_at TIMESTAMP;

COMMIT;
