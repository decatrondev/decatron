-- Página personal, subfase 5.5: estadísticas de visitas y clics por día, sin datos personales (no se guarda IP, navegador
-- ni quién visitó). Se guardan 12 meses. Plan: .dev/plans/pagina-personal/PLAN.md §13. Idempotente y aditiva.
BEGIN;

CREATE TABLE IF NOT EXISTS personal_page_daily_stats (
    page_id bigint NOT NULL REFERENCES personal_pages(id) ON DELETE CASCADE,
    day date NOT NULL,
    visits integer NOT NULL DEFAULT 0 CHECK (visits >= 0),
    PRIMARY KEY (page_id, day)
);

CREATE TABLE IF NOT EXISTS personal_page_click_stats (
    page_id bigint NOT NULL REFERENCES personal_pages(id) ON DELETE CASCADE,
    day date NOT NULL,
    target varchar(60) NOT NULL,
    clicks integer NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    PRIMARY KEY (page_id, day, target)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON personal_page_daily_stats, personal_page_click_stats TO decatron_user;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'decatron_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON personal_page_daily_stats, personal_page_click_stats TO decatron_app;
    END IF;
END $$;

COMMIT;
