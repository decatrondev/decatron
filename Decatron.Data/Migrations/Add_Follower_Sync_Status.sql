-- Seguidores: estado de la última sincronización con la plataforma, por canal (para mostrar «Última sincronización» real
-- en la pantalla aunque se recargue, y si fue manual o automática). Por tenant, con RLS como el resto. Idempotente.
-- Una fila por (tenant, plataforma, canal); se actualiza en cada intento.
BEGIN;
CREATE TABLE IF NOT EXISTS follower_sync_status (
  id               bigserial    PRIMARY KEY,
  tenant_id        bigint       NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  platform         varchar(10)  NOT NULL DEFAULT 'twitch',
  broadcaster_id   varchar(50)  NOT NULL,
  last_attempt_at  timestamptz  NOT NULL DEFAULT now(),
  last_success_at  timestamptz,                                  -- último intento que pudo leer la lista (aunque haya omitido unfollows)
  last_source      varchar(10)  NOT NULL DEFAULT 'manual',       -- manual | auto
  last_result      varchar(24)  NOT NULL DEFAULT 'ok',           -- ok | unfollows_skipped | fetch_failed | skipped_large
  last_detail      varchar(40),                                  -- motivo (p. ej. SuspiciousDrop, http_401)
  new_count        int          NOT NULL DEFAULT 0,
  returned_count   int          NOT NULL DEFAULT 0,
  unfollowed_count int          NOT NULL DEFAULT 0,
  renamed_count    int          NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_follower_sync_status ON follower_sync_status (tenant_id, platform, broadcaster_id);
ALTER TABLE follower_sync_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON follower_sync_status;
CREATE POLICY tenant_isolation ON follower_sync_status USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON follower_sync_status TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE follower_sync_status_id_seq TO decatron_app;
COMMIT;
