-- Modulo de Torneos - cierre de Milestone 4: formatos de bracket que faltaban
-- (double_elimination, round_robin, swiss). Plan: .dev/torneos/02-motor-de-torneo-formatos.md
--
-- bracket_side solo lo usa double_elimination (dos arboles: winners/losers, mas la
-- gran final) — null para los otros 3 formatos, que no tienen esa nocion.

ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS bracket_side VARCHAR(20);
