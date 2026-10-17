-- Fase A-B1: solicitudes pendientes de registro del comprador (global, sin tenant_id ni RLS). Ver .dev/scripts/fasea2/4_signups.sql
CREATE TABLE IF NOT EXISTS platform_signups (
  id           bigserial PRIMARY KEY,
  email        varchar(254) NOT NULL,
  slug         varchar(30)  NOT NULL,
  project_name varchar(80)  NOT NULL,
  locale       varchar(5)   NOT NULL DEFAULT 'es',
  token_hash   varchar(64)  NOT NULL,
  ip_hash      varchar(64)  NOT NULL,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  expires_at   timestamptz  NOT NULL,
  used_at      timestamptz,
  tenant_id    bigint REFERENCES tenants(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_platform_signups_token ON platform_signups (token_hash);
CREATE INDEX IF NOT EXISTS ix_platform_signups_email ON platform_signups (email, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_platform_signups_ip ON platform_signups (ip_hash, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_signups TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE platform_signups_id_seq TO decatron_app;

ALTER TABLE platform_signups ADD COLUMN IF NOT EXISTS purpose varchar(10) NOT NULL DEFAULT 'signup', ADD COLUMN IF NOT EXISTS user_id bigint; -- purpose: signup | login
