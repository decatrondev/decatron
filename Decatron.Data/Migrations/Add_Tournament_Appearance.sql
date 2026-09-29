-- Modulo de Torneos — rediseño de la vista publica, R0 Apariencia (29-09-2026).
-- Cada torneo lleva la marca del streamer: logo, portada, 2 colores y fondo claro u
-- oscuro. logo_url, primary_color y secondary_color ya existian (sin UI). Idempotente.

BEGIN;

ALTER TABLE tournament_editions
    ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500),
    -- dark | light
    ADD COLUMN IF NOT EXISTS theme      VARCHAR(10) NOT NULL DEFAULT 'dark';

COMMIT;
