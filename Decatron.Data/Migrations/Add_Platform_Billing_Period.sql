-- Fase 7.5: el pago pendiente recuerda lo que se compro (complementos, periodo, pais) para aplicarlo al confirmarse. Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 3_pagos_periodo.sql     Reverso: 3r_reverso.sql
BEGIN;
ALTER TABLE tenant_payments ADD COLUMN IF NOT EXISTS addons       text[]      NOT NULL DEFAULT '{}';
ALTER TABLE tenant_payments ADD COLUMN IF NOT EXISTS period_starts timestamptz;
ALTER TABLE tenant_payments ADD COLUMN IF NOT EXISTS period_ends   timestamptz;
ALTER TABLE tenant_payments ADD COLUMN IF NOT EXISTS tax_country  varchar(2);
COMMIT;
