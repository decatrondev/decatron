-- Contador de correos de la lista de espera para el tope diario (PLATAFORMA_PLAN.md, Fase L). 2026-10-14
-- Solo agrega una tabla nueva. Aplicar como postgres ANTES de desplegar el backend (primero staging):
--   sudo -u postgres psql -d decatron_staging -f <este archivo>
--   sudo -u postgres psql -d decatron_prod    -f <este archivo>
-- Marcha atrás: DROP TABLE platform_waitlist_emails;
CREATE TABLE IF NOT EXISTS platform_waitlist_emails (
    id      BIGSERIAL PRIMARY KEY,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_platform_waitlist_emails_sent ON platform_waitlist_emails (sent_at);
GRANT SELECT, INSERT, DELETE ON platform_waitlist_emails TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE platform_waitlist_emails_id_seq TO decatron_user;
