-- Overlay de Promociones, motor de diseño (plan .dev/plans/overlay-promo/PLAN.md §3.3c). 2026-10-27
-- * La plantilla pasa de 4 listas desplegables (forma, zona, tema, animación) a un DISEÑO guardado como JSON (lienzo + elementos).
-- * Las zonas dejan de ser dos valores fijos: se crean y editan desde /admin/promo (tabla promo_zones).
-- * Se descartan las 9 plantillas de la primera versión (rechazadas); las nuevas se arman en el editor.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y lo mismo en decatron_schema)
BEGIN;

CREATE TABLE IF NOT EXISTS promo_zones (
    id          BIGSERIAL PRIMARY KEY,
    key         VARCHAR(40)  NOT NULL UNIQUE,
    name_es     VARCHAR(80)  NOT NULL DEFAULT '',
    name_en     VARCHAR(80)  NOT NULL DEFAULT '',
    anchor      VARCHAR(16)  NOT NULL DEFAULT 'top-right'
                CHECK (anchor IN ('top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right')),
    margin_x    INT          NOT NULL DEFAULT 96,
    margin_y    INT          NOT NULL DEFAULT 54,
    is_enabled  BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- Posición inicial de cada zona en el lienzo de 1920×1080 (el streamer las mueve en su panel).
INSERT INTO promo_zones (key, name_es, name_en, anchor, margin_x, margin_y, sort_order) VALUES
 ('corner', 'Esquina',         'Corner',        'top-right',     96, 54, 0),
 ('banner', 'Banner inferior', 'Bottom banner', 'bottom-center', 96, 54, 1)
ON CONFLICT (key) DO NOTHING;

-- La zona ahora es la clave de una fila de promo_zones (lo valida el servicio), no una lista cerrada.
ALTER TABLE promo_pieces DROP CONSTRAINT IF EXISTS promo_pieces_zone_check;
ALTER TABLE promo_pieces ALTER COLUMN zone TYPE VARCHAR(40);
ALTER TABLE promo_templates DROP CONSTRAINT IF EXISTS promo_templates_zone_check;
ALTER TABLE promo_templates ALTER COLUMN zone TYPE VARCHAR(40);

-- El diseño de la plantilla.
ALTER TABLE promo_templates ADD COLUMN IF NOT EXISTS design JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE promo_templates DROP COLUMN IF EXISTS layout;
ALTER TABLE promo_templates DROP COLUMN IF EXISTS theme;
ALTER TABLE promo_templates DROP COLUMN IF EXISTS animation;

-- Fuera las 9 de la primera versión (las piezas que las usaban quedan sin plantilla). Solo las que siguen sin diseño propio.
DELETE FROM promo_templates WHERE design = '{}'::jsonb;

GRANT SELECT, INSERT, UPDATE, DELETE ON promo_zones TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE promo_zones_id_seq TO decatron_app;

COMMIT;
