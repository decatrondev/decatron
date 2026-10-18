-- Fase 7.8: intentos de cobro automatico. Una fila por intento y por vencimiento: evita cobrar dos veces el mismo periodo (aunque el servicio se reinicie a mitad de un cobro)
-- y lleva la cuenta de los 3 intentos (dia 0, +2, +4). Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 6_cobro_auto_intentos.sql     Reverso: 6r_reverso.sql
BEGIN;
CREATE TABLE IF NOT EXISTS tenant_autopay_attempts (
  tenant_id  bigint      NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  cycle_ends timestamptz NOT NULL,                        -- el vencimiento que se esta renovando
  attempt    smallint    NOT NULL CHECK (attempt BETWEEN 1 AND 3),
  status     varchar(8)  NOT NULL CHECK (status IN ('started','paid','failed','review')),
  error      varchar(200),
  payment_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, cycle_ends, attempt)
);
ALTER TABLE tenant_autopay_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_autopay_attempts;
CREATE POLICY tenant_isolation ON tenant_autopay_attempts USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_autopay_attempts TO decatron_app;
COMMIT;
