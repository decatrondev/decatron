-- Fase A-Equipo: invitaciones de admins del tenant (FASE_A_EQUIPO_DISENO.md). Por tenant, con RLS como el resto. Solo el hash del token. Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 6_equipo.sql     Reverso: 6r_reverso.sql
BEGIN;
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id               bigserial    PRIMARY KEY,
  tenant_id        bigint       NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  email            varchar(254) NOT NULL,
  role             varchar(12)  NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),   -- roles intermedios nuevos: fuera de alcance
  token_hash       varchar(64)  NOT NULL,
  locale           varchar(5)   NOT NULL DEFAULT 'es',
  invited_by       bigint       NOT NULL,                                          -- users.id del owner (sin FK: la fila de auditoria sobrevive al usuario)
  created_at       timestamptz  NOT NULL DEFAULT now(),
  expires_at       timestamptz  NOT NULL,
  used_at          timestamptz,
  accepted_user_id bigint,
  cancelled_at     timestamptz
);
CREATE INDEX IF NOT EXISTS ix_tenant_invitations_token ON tenant_invitations (token_hash);
CREATE INDEX IF NOT EXISTS ix_tenant_invitations_tenant ON tenant_invitations (tenant_id, created_at DESC);
-- Una sola invitacion viva por correo y tenant (viva = sin usar ni cancelar; si vencio, se cancela o se reemplaza al reinvitar).
CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_invitations_live ON tenant_invitations (tenant_id, lower(email)) WHERE used_at IS NULL AND cancelled_at IS NULL;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_invitations;
CREATE POLICY tenant_isolation ON tenant_invitations USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_invitations TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE tenant_invitations_id_seq TO decatron_app;
COMMIT;
