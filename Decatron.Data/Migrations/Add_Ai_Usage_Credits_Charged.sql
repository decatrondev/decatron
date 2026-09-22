-- Créditos unificados, fase 1 (.dev/plans/CREDITOS_UNIFICADOS_PLAN.md):
-- cuántos créditos se le descontaron al canal por cada llamada a la IA.
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS credits_charged BIGINT NULL;
