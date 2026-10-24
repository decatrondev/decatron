-- Lista de espera de la plataforma (decatron.top, .dev/plans/plataforma/PLATAFORMA_PLAN.md, Fase L). 2026-10-14
-- Solo agrega una tabla nueva: no toca nada existente. Aplicar como postgres, ANTES de reiniciar el backend:
--   sudo -u postgres psql -d decatron_staging -f <este archivo>    (primero staging)
--   sudo -u postgres psql -d decatron_prod    -f <este archivo>
-- Marcha atrás: DROP TABLE platform_waitlist;
CREATE TABLE IF NOT EXISTS platform_waitlist (
    id                 BIGSERIAL PRIMARY KEY,
    email              VARCHAR(254) NOT NULL,
    use_case           VARCHAR(24)  NOT NULL DEFAULT 'other',
    platform           VARCHAR(12)  NOT NULL DEFAULT '',
    locale             VARCHAR(5)   NOT NULL DEFAULT 'es',
    confirm_token_hash VARCHAR(64)  NOT NULL DEFAULT '',
    confirmed_at       TIMESTAMPTZ  NULL,
    last_email_at      TIMESTAMPTZ  NULL,
    ip_hash            VARCHAR(64)  NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_platform_waitlist_email ON platform_waitlist (email);
CREATE INDEX IF NOT EXISTS ix_platform_waitlist_token ON platform_waitlist (confirm_token_hash) WHERE confirm_token_hash <> '';
CREATE INDEX IF NOT EXISTS ix_platform_waitlist_ip ON platform_waitlist (ip_hash, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_waitlist TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE platform_waitlist_id_seq TO decatron_user;
