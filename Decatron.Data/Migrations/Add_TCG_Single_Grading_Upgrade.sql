-- Rediseno del upgrade del TCG: una sola carta tiene UN SOLO intento en toda su vida
-- (no mas subir de a un nivel las veces que quiera), y el resultado no sale al toque
-- - hay 24h de "en gradeo" antes de saber si salio nivel 1-10 o se destruyo, y DESPUES
-- de eso las 24h de pago que ya existian. Dos ventanas de 24h seguidas, no una.
--
-- Reemplaza el modelo anterior (intentos repetibles 0->1->2...->9) que se habia
-- construido mal — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md seccion 6.

ALTER TABLE player_card_instances ADD COLUMN IF NOT EXISTS upgrade_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE player_card_instances ADD COLUMN IF NOT EXISTS attempt_started_at TIMESTAMP;

ALTER TABLE player_card_instances DROP CONSTRAINT IF EXISTS chk_pci_status;
ALTER TABLE player_card_instances ADD CONSTRAINT chk_pci_status
    CHECK (status IN ('active', 'grading_in_progress', 'frozen_pending_payment', 'destroyed'));

-- Nivel maximo pasa de 9 a 10.
ALTER TABLE player_card_instances DROP CONSTRAINT IF EXISTS chk_pci_level;
ALTER TABLE player_card_instances ADD CONSTRAINT chk_pci_level CHECK (level BETWEEN 0 AND 10);

ALTER TABLE player_card_instances DROP CONSTRAINT IF EXISTS chk_pci_pending_level;
ALTER TABLE player_card_instances ADD CONSTRAINT chk_pci_pending_level
    CHECK (pending_target_level IS NULL OR pending_target_level BETWEEN 1 AND 10);

-- El log ya no registra una transicion "de X a X+1" sino un resultado de tirada unica
-- (0 = sin resolver todavia / fail, 1-10 = nivel que salio).
ALTER TABLE upgrade_attempt_log DROP CONSTRAINT IF EXISTS chk_ual_from_level;
ALTER TABLE upgrade_attempt_log ADD CONSTRAINT chk_ual_from_level CHECK (from_level = 0);

ALTER TABLE upgrade_attempt_log DROP CONSTRAINT IF EXISTS chk_ual_to_level;
ALTER TABLE upgrade_attempt_log ADD CONSTRAINT chk_ual_to_level CHECK (to_level BETWEEN 0 AND 10);
