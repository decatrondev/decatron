-- Plataforma: correos aprobados para registrarse como comprador (Platform:SignupMode = approval). Global, sin tenant_id ni RLS.
-- Idempotente. Aplicar a mano antes de reiniciar el backend. Reverso: DROP TABLE platform_approved_emails;
CREATE TABLE IF NOT EXISTS platform_approved_emails (
  email       varchar(254) PRIMARY KEY,                 -- siempre en minusculas
  approved_at timestamptz  NOT NULL DEFAULT now(),
  approved_by varchar(100) NOT NULL DEFAULT '',
  note        varchar(200)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_approved_emails TO decatron_app;
