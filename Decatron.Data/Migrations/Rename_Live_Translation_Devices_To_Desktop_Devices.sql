-- Decatron Desktop es la app de escritorio general (traducción en vivo es su primer
-- módulo, después asistente de LoL, etc.). La vinculación pasa a ser de la app, no
-- del módulo. 2026-09-19
ALTER TABLE IF EXISTS live_translation_devices RENAME TO desktop_devices;
ALTER INDEX IF EXISTS ix_live_translation_devices_user RENAME TO ix_desktop_devices_user;
ALTER TABLE desktop_devices ADD COLUMN IF NOT EXISTS app_version VARCHAR(30);
ALTER TABLE desktop_devices ADD COLUMN IF NOT EXISTS platform VARCHAR(20);
