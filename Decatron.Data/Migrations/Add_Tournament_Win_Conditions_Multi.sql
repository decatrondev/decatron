-- Modulo de Torneos — la condicion de victoria ARAM pasa de "una por edicion" a
-- catalogo combinable (N filas activas por edicion, igual patron que
-- tournament_shell_triggers): gana el equipo que cumpla PRIMERO cualquiera de las
-- condiciones activas. Pedido del usuario 24-08-2026.

ALTER TABLE tournament_win_conditions DROP CONSTRAINT tournament_win_conditions_tournament_edition_id_key;

ALTER TABLE tournament_win_conditions ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tournament_win_conditions_edition
    ON tournament_win_conditions (tournament_edition_id, is_active);
