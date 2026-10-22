-- Giveaways, F2 (.dev/plans/giveaways/PLAN.md): opciones configurables del streamer (mensajes del bot, topes de peso,
-- umbrales del anti-multi-cuenta, recordatorios, roles). JSON con valores por defecto en el código: {} = todo por defecto. 2026-10-22
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>   (ANTES de reiniciar el backend)
BEGIN;
ALTER TABLE giveaway_configs ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
