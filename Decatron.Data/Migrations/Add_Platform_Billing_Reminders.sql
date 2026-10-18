-- Fase 7.4: recordatorios de vencimiento (FASE7_DISENO.md §6). Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 2_recordatorios.sql     Reverso: 2r_reverso.sql
BEGIN;
-- Un recordatorio por vencimiento y umbral: no se repite aunque el servicio se reinicie.
CREATE TABLE IF NOT EXISTS tenant_billing_reminders (
  id         bigserial   PRIMARY KEY,
  tenant_id  bigint      NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  ends_at    timestamptz NOT NULL,                       -- el vencimiento al que se refiere
  kind       varchar(8)  NOT NULL CHECK (kind IN ('d7','d3','d1','grace')),
  sent_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ends_at, kind)
);
ALTER TABLE tenant_billing_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_billing_reminders;
CREATE POLICY tenant_isolation ON tenant_billing_reminders USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));
GRANT SELECT, INSERT, DELETE ON tenant_billing_reminders TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE tenant_billing_reminders_id_seq TO decatron_app;

-- Contador global y propio de correos de cobro (sin RLS, solo cuenta): no compite con la cuota de la lista de espera y los enlaces de entrada.
CREATE TABLE IF NOT EXISTS platform_billing_emails (
  id        bigserial   PRIMARY KEY,
  tenant_id bigint      NOT NULL,
  sent_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_platform_billing_emails_sent ON platform_billing_emails (sent_at);
GRANT SELECT, INSERT, DELETE ON platform_billing_emails TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE platform_billing_emails_id_seq TO decatron_app;
COMMIT;
