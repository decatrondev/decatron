-- Fase 7.8: cobro automatico. La tarjeta guardada vive en Culqi (ids en tenant_billing_profile); aqui solo se agregan los datos para MOSTRARLA (nunca el numero). Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 5_cobro_auto.sql     Reverso: 5r_reverso.sql
BEGIN;
ALTER TABLE tenant_billing_profile
  ADD COLUMN IF NOT EXISTS card_last4 varchar(4),
  ADD COLUMN IF NOT EXISTS card_brand varchar(20);
COMMIT;
