-- !ruleta: mensajes pasan de un string fijo a una lista de variantes (jsonb),
-- el bot elige una al azar en cada disparo. Migra el valor existente a un array de 1 elemento.
-- 2026-08-25

ALTER TABLE ruleta_command_configs ADD COLUMN IF NOT EXISTS hit_messages jsonb;
ALTER TABLE ruleta_command_configs ADD COLUMN IF NOT EXISTS miss_messages jsonb;
ALTER TABLE ruleta_command_configs ADD COLUMN IF NOT EXISTS self_hit_messages jsonb;
ALTER TABLE ruleta_command_configs ADD COLUMN IF NOT EXISTS self_miss_messages jsonb;

UPDATE ruleta_command_configs SET hit_messages = jsonb_build_array(hit_message) WHERE hit_messages IS NULL;
UPDATE ruleta_command_configs SET miss_messages = jsonb_build_array(miss_message) WHERE miss_messages IS NULL;
UPDATE ruleta_command_configs SET self_hit_messages = jsonb_build_array(self_hit_message) WHERE self_hit_messages IS NULL;
UPDATE ruleta_command_configs SET self_miss_messages = jsonb_build_array(self_miss_message) WHERE self_miss_messages IS NULL;

ALTER TABLE ruleta_command_configs ALTER COLUMN hit_messages SET NOT NULL;
ALTER TABLE ruleta_command_configs ALTER COLUMN miss_messages SET NOT NULL;
ALTER TABLE ruleta_command_configs ALTER COLUMN self_hit_messages SET NOT NULL;
ALTER TABLE ruleta_command_configs ALTER COLUMN self_miss_messages SET NOT NULL;

ALTER TABLE ruleta_command_configs ALTER COLUMN hit_messages SET DEFAULT '["🔫💥 BANG! @{shooter} le disparó a @{target} — {seconds}s de timeout"]';
ALTER TABLE ruleta_command_configs ALTER COLUMN miss_messages SET DEFAULT '["🔫 *click* @{shooter} apuntó a @{target}... y sobrevivió"]';
ALTER TABLE ruleta_command_configs ALTER COLUMN self_hit_messages SET DEFAULT '["🔫💥 @{shooter} se apuntó a sí mismo... BANG! {seconds}s de timeout"]';
ALTER TABLE ruleta_command_configs ALTER COLUMN self_miss_messages SET DEFAULT '["🔫 @{shooter} se apuntó a sí mismo... *click* sobrevivió de milagro"]';

ALTER TABLE ruleta_command_configs DROP COLUMN IF EXISTS hit_message;
ALTER TABLE ruleta_command_configs DROP COLUMN IF EXISTS miss_message;
ALTER TABLE ruleta_command_configs DROP COLUMN IF EXISTS self_hit_message;
ALTER TABLE ruleta_command_configs DROP COLUMN IF EXISTS self_miss_message;
