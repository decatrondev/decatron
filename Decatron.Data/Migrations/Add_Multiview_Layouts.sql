-- Layouts guardados del Multi-view (.dev/plans/MULTIVIEW_PLAN.md, Fase 5). 2026-10-12
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS multiview_layouts (
    id            BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT       NOT NULL,
    name          VARCHAR(60)  NOT NULL,
    slots         VARCHAR(600) NOT NULL,
    layout        VARCHAR(10)  NOT NULL DEFAULT 'grid',
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_multiview_layouts_owner_name ON multiview_layouts (owner_user_id, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON multiview_layouts TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE multiview_layouts_id_seq TO decatron_user;
