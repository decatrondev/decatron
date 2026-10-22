-- Giveaways F3b (.dev/plans/giveaways/PLAN.md): registro auditable del sorteo. Por cada ganador elegido se guarda su peso,
-- su probabilidad y el total en ese momento, para poder explicar el resultado. NULL = sorteos anteriores. 2026-10-22
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>   (ANTES de reiniciar el backend)
BEGIN;
ALTER TABLE giveaway_sessions ADD COLUMN IF NOT EXISTS draw_audit jsonb;
COMMIT;
