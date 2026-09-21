-- !ruleta: listas de usuarios protegidos (inmunes) y bloqueados (no pueden usar el comando) por canal
-- 2026-08-26

ALTER TABLE ruleta_command_configs ADD COLUMN IF NOT EXISTS protected_users jsonb NOT NULL DEFAULT '[]';
ALTER TABLE ruleta_command_configs ADD COLUMN IF NOT EXISTS blocked_users jsonb NOT NULL DEFAULT '[]';
