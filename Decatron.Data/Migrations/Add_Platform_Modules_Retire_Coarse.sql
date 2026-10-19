-- Modulos: retira las 3 claves gruesas (module.commands, module.moderation, module.overlays), ya reemplazadas por las finas (MODULOS.md).
-- Aplicar DESPUES de desplegar el backend y el front que ya no las usan. Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 2_retiro_gruesas.sql     Reverso: 2r_reverso.sql
BEGIN;
DELETE FROM tenant_addons WHERE capability_key IN ('module.commands','module.moderation','module.overlays');
DELETE FROM addon_prices  WHERE capability_key IN ('module.commands','module.moderation','module.overlays');
DELETE FROM capabilities  WHERE key            IN ('module.commands','module.moderation','module.overlays');  -- cascada en plan_entitlements
COMMIT;
