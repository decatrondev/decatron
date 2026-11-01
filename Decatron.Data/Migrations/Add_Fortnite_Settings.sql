-- Fortnite Spirits: temporada actual elegida desde /admin/fortnite.
-- Antes vivía solo en appsettings.json (Fortnite:CurrentSeason), que sigue como respaldo
-- cuando la fila no existe o current_season está vacío. Tabla global de una sola fila, sin tenant_id.

CREATE TABLE IF NOT EXISTS fortnite_settings (
    id              INT PRIMARY KEY DEFAULT 1,
    current_season  TEXT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fortnite_settings_single_row CHECK (id = 1),
    CONSTRAINT fortnite_settings_season_len CHECK (current_season IS NULL OR char_length(current_season) BETWEEN 1 AND 100)
);
INSERT INTO fortnite_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- El backend corre con el rol decatron_app: las tablas creadas como postgres no se lo dan solas.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'decatron_app') THEN
        GRANT SELECT, INSERT, UPDATE ON fortnite_settings TO decatron_app;
    END IF;
END $$;
