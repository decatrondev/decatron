-- Fase 7.5b: avisos (webhooks) de Culqi. Solo se guarda lo recibido y lo que se hizo con ello; nada de esto se usa como verdad (cada aviso dispara una consulta del cargo a Culqi). Sin RLS: no lleva datos de un tenant. Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 7_webhooks.sql     Reverso: 7r_reverso.sql
BEGIN;
CREATE TABLE IF NOT EXISTS platform_webhook_events (
  id          bigserial   PRIMARY KEY,
  provider    varchar(12) NOT NULL DEFAULT 'culqi',
  received_at timestamptz NOT NULL DEFAULT now(),
  body        text        NOT NULL,                       -- recortado a 8000 caracteres
  result      varchar(200)                                -- que se hizo: confirmed_missing, refund_recorded, ok, ignored:..., error:...
);
CREATE INDEX IF NOT EXISTS ix_platform_webhook_events_received ON platform_webhook_events (received_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_webhook_events TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE platform_webhook_events_id_seq TO decatron_app;
COMMIT;
