-- Fase 4, paso 1: tablas de credenciales por tenant. ADITIVO: no cambia ninguna tabla existente salvo columnas nuevas con valor por defecto.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 1_credenciales.sql     Reverso: 1r_reverso.sql
BEGIN;
SET LOCAL lock_timeout = '3s';

-- Clave de datos por tenant, envuelta con la clave maestra (que vive fuera de la BD).
CREATE TABLE IF NOT EXISTS tenant_keys (
  tenant_id   bigint      NOT NULL REFERENCES tenants(id),
  version     integer     NOT NULL DEFAULT 1,
  wrapped_key text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version)
);

-- Un secreto por (tenant, proveedor, tipo). secret_enc en formato ENC2 (AES-GCM, dato asociado tenant|provider|kind).
CREATE TABLE IF NOT EXISTS tenant_credentials (
  id                bigserial   PRIMARY KEY,
  tenant_id         bigint      NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  provider          varchar(40) NOT NULL,   -- twitch_app | twitch_bot | kick_app | kick_bot | discord_bot
  kind              varchar(40) NOT NULL,   -- client_secret | access_token | refresh_token | webhook_secret | bot_token ...
  secret_enc        text        NOT NULL,
  key_version       integer     NOT NULL DEFAULT 1,
  hint              varchar(8),             -- ultimos caracteres para mostrar «configurado»; nunca el secreto
  status            varchar(16) NOT NULL DEFAULT 'pending',  -- pending | ok | invalid
  last_validated_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_credentials_uq UNIQUE (tenant_id, provider, kind)
);

-- Datos no secretos de cada proveedor (client_id, usernames, redirect_uri, guild ids...). Legible por el panel.
CREATE TABLE IF NOT EXISTS tenant_provider_config (
  tenant_id  bigint      NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  provider   varchar(40) NOT NULL,
  config     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, provider)
);

-- Auditoria de accesos: solo insercion para el rol de la app.
CREATE TABLE IF NOT EXISTS credential_access_log (
  id        bigserial   PRIMARY KEY,
  tenant_id bigint      NOT NULL DEFAULT app_tenant_id(),
  provider  varchar(40) NOT NULL,
  kind      varchar(40),
  action    varchar(16) NOT NULL,   -- read | write | validate | rotate
  actor     varchar(100),
  purpose   varchar(100),
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_credential_access_log_tenant_at ON credential_access_log (tenant_id, at DESC);

-- Modo de proveedor por tenant: legacy (appsettings/bot_tokens, como hoy) o store (tenant_credentials). El #1 queda en legacy.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS credentials_mode varchar(10) NOT NULL DEFAULT 'legacy';

-- bot_tokens es global (una fila): se le da dueño sin cambiar la fila existente (queda en el tenant 1).
ALTER TABLE bot_tokens ADD COLUMN IF NOT EXISTS tenant_id bigint NOT NULL DEFAULT 1;

-- RLS en las tablas nuevas (misma politica que las 216 existentes).
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_keys','tenant_credentials','tenant_provider_config','credential_access_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()))', t);
  END LOOP;
END $$;

-- Permisos del rol de la app. El log de acceso es solo lectura+insercion (no se puede editar ni borrar).
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_keys, tenant_credentials, tenant_provider_config TO decatron_app;
GRANT SELECT, INSERT ON credential_access_log TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE tenant_credentials_id_seq, credential_access_log_id_seq TO decatron_app;
GRANT SELECT, UPDATE (credentials_mode) ON tenants TO decatron_app;
COMMIT;
