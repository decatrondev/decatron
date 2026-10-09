-- Editor de valores de diseño (/admin/estilo, .dev/plans/SISTEMA_DE_DISENO_PLAN.md, Fase 4). 2026-10-09
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
-- Sin fila publicada = el sitio usa los valores de fábrica que viven en el código (ClientApp/src/components/ds/tokens.ts).
CREATE TABLE IF NOT EXISTS design_versions (
    id           BIGSERIAL PRIMARY KEY,
    status       VARCHAR(12) NOT NULL CHECK (status IN ('draft','published','archived')),
    values_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
    note         VARCHAR(200) NOT NULL DEFAULT '',
    author_login VARCHAR(100) NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ NULL
);
-- A lo sumo un borrador y una versión publicada a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS ux_design_versions_draft ON design_versions ((status)) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS ux_design_versions_published ON design_versions ((status)) WHERE status = 'published';

GRANT SELECT, INSERT, UPDATE, DELETE ON design_versions TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE design_versions_id_seq TO decatron_user;
