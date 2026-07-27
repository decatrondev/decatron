-- Ajusta defaults de !watchtime: Stream Offline desactivado por defecto, Mostrar Posición activado por defecto
-- 2026-07-22

ALTER TABLE watchtime_command_configs ALTER COLUMN use_offline_message SET DEFAULT FALSE;
ALTER TABLE watchtime_command_configs ALTER COLUMN show_position SET DEFAULT TRUE;

-- Alinear las filas existentes que aún no fueron personalizadas manualmente por el streamer
UPDATE watchtime_command_configs SET show_position = TRUE WHERE show_position = FALSE;
