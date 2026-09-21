-- ============================================
-- TCG — PERMITIR ARTE DE NIVEL 10 (2026-08-11)
-- ============================================
-- card_level_art solo aceptaba niveles del 1 al 9, de cuando el arte nuevo salía en los
-- milestones 3/6/9. Con el rediseño el ÚNICO nivel con ilustración propia es el 10, así
-- que la constraint dejaba fuera justo el único caso que ahora existe: al primer jugador
-- que sacara un 10, el INSERT del pedido de arte habría fallado.

ALTER TABLE card_level_art DROP CONSTRAINT IF EXISTS chk_cla_level;

ALTER TABLE card_level_art
    ADD CONSTRAINT chk_cla_level CHECK (level BETWEEN 1 AND 10);
