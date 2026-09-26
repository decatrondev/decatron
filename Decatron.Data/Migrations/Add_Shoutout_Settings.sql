-- Shoutout (rediseño, fase 2, 2026-09-26): comportamiento que no es diseño.
-- { clipMode: random|top|recent|days, clipDays, clipFallback, noClipSeconds }
-- Vacío = lo de siempre (clip al azar entre los 20 más vistos, 5 s sin clip).
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;
