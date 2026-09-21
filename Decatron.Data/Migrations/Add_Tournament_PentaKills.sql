-- Corrige un bug real: el trigger "Pentakill" del seed de castigos comparaba
-- kills>=5 en la partida (cualquier buena partida), no un pentakill de verdad
-- (5 asesinatos seguidos, campo propio de Riot). Se agrega la columna que faltaba.
ALTER TABLE tournament_lp_snapshots ADD COLUMN IF NOT EXISTS penta_kills SMALLINT NOT NULL DEFAULT 0;
