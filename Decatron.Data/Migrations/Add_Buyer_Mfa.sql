-- Plataforma, Fase A (pieza F): 2FA (TOTP) opcional del comprador. Por tenant, con RLS. Idempotente; aplicar a mano en prod antes de reiniciar el backend.
-- El secreto va cifrado (SecretVault, ENC2); los codigos de recuperacion solo como hash. Requiere app_tenant_id() y la tabla tenants (Fase 1-3).
BEGIN;
CREATE TABLE IF NOT EXISTS tenant_buyer_mfa (
  tenant_id    bigint      NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  user_id      bigint      NOT NULL,
  secret_enc   text        NOT NULL,
  enabled      boolean     NOT NULL DEFAULT false,          -- false = configurando (aun no confirmo un codigo)
  enabled_at   timestamptz,
  last_step    bigint      NOT NULL DEFAULT 0,              -- ultimo paso TOTP aceptado: un codigo no se reutiliza
  failed_count int         NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE TABLE IF NOT EXISTS tenant_buyer_recovery_codes (
  id        bigserial   PRIMARY KEY,
  tenant_id bigint      NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  user_id   bigint      NOT NULL,
  code_hash varchar(64) NOT NULL,
  used_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_buyer_recovery_user ON tenant_buyer_recovery_codes (tenant_id, user_id);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_buyer_mfa','tenant_buyer_recovery_codes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()))', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_buyer_mfa, tenant_buyer_recovery_codes TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE tenant_buyer_recovery_codes_id_seq TO decatron_app;
COMMIT;
