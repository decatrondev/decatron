-- Tokens de espectador de la traducción en vivo (.dev/plans/TRADUCCION_ACCESO_PLAN.md, Fase 2). 2026-10-12
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
-- Un token de espectador lleva la «época» de su dueño; para cerrar la sesión de la extensión en todos los navegadores se sube la
-- época y los tokens anteriores dejan de valer. Sin fila, la época es 0.
CREATE TABLE IF NOT EXISTS viewer_token_epoch (
    user_id    BIGINT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    epoch      INTEGER     NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON viewer_token_epoch TO decatron_user;
