-- Correo de la plataforma: selector Resend / correo propio (SMTP) y cambio de capacidades (quota.emails_month fuera, byo.email dentro). Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 7_correo.sql     Reverso: 7r_reverso.sql
BEGIN;
CREATE TABLE IF NOT EXISTS platform_mail_settings (
  id         int         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider   varchar(10) NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend','smtp')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(254)
);
INSERT INTO platform_mail_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, INSERT, UPDATE ON platform_mail_settings TO decatron_app;

-- Los correos de los clientes salen con la llave de Resend del propio cliente: ya no hay cuota de correos de Decatron.
DELETE FROM usage_counters WHERE capability_key = 'quota.emails_month';
DELETE FROM capabilities WHERE key = 'quota.emails_month';   -- plan_entitlements cae en cascada
INSERT INTO capabilities (key, kind, unit, group_key, default_value, meter, period, description, active, sort)
VALUES ('byo.email', 'flag', NULL, 'byo', 1, 'none', NULL, 'Llave propia de correo (Resend del cliente; sin llave, la funcion queda apagada)', true, 340)
ON CONFLICT (key) DO NOTHING;
INSERT INTO plan_entitlements (plan_id, capability_key, value)
SELECT plan_id, 'byo.email', value FROM plan_entitlements WHERE capability_key = 'byo.tts'
ON CONFLICT DO NOTHING;
COMMIT;
