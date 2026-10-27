-- Overlay de Promociones (plan .dev/plans/overlay-promo/PLAN.md, Fase 1). 2026-10-27
-- Catálogo global de piezas y plantillas, administrado desde /admin por el dueño. Sin tenant_id: no son datos de un canal
-- (igual que game_overlay_promos, que es otro sistema y no se toca). Las tarjetas propias del streamer y las vistas por canal
-- llegan en fases siguientes, con su tenant_id.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -f <este archivo>   (y lo mismo en decatron_schema)
BEGIN;

CREATE TABLE IF NOT EXISTS promo_templates (
    id          BIGSERIAL PRIMARY KEY,
    key         VARCHAR(40)  NOT NULL UNIQUE,
    name_es     VARCHAR(80)  NOT NULL DEFAULT '',
    name_en     VARCHAR(80)  NOT NULL DEFAULT '',
    layout      VARCHAR(16)  NOT NULL DEFAULT 'card'   CHECK (layout IN ('card', 'compact', 'bar')),
    zone        VARCHAR(16)  NOT NULL DEFAULT 'corner' CHECK (zone IN ('corner', 'banner')),
    theme       VARCHAR(16)  NOT NULL DEFAULT 'graphite' CHECK (theme IN ('graphite', 'blue', 'light')),
    animation   VARCHAR(16)  NOT NULL DEFAULT 'slide'  CHECK (animation IN ('slide', 'fade', 'pop', 'none')),
    is_enabled  BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_pieces (
    id               BIGSERIAL PRIMARY KEY,
    kind             VARCHAR(24)  NOT NULL DEFAULT 'news'
                     CHECK (kind IN ('commands', 'module', 'qr', 'news', 'credits', 'community', 'emergency')),
    origin           VARCHAR(12)  NOT NULL DEFAULT 'bot' CHECK (origin IN ('bot', 'tercero')),
    title_es         VARCHAR(120) NOT NULL DEFAULT '',
    title_en         VARCHAR(120) NOT NULL DEFAULT '',
    body_es          VARCHAR(300) NOT NULL DEFAULT '',
    body_en          VARCHAR(300) NOT NULL DEFAULT '',
    link_url         VARCHAR(500),
    show_qr          BOOLEAN      NOT NULL DEFAULT FALSE,
    image_url        VARCHAR(500),
    icon             VARCHAR(40),
    template_id      BIGINT REFERENCES promo_templates(id) ON DELETE SET NULL,
    zone             VARCHAR(16)  NOT NULL DEFAULT 'corner' CHECK (zone IN ('corner', 'banner')),
    priority         INT          NOT NULL DEFAULT 0,
    weight           INT          NOT NULL DEFAULT 1,
    duration_seconds INT          NOT NULL DEFAULT 8,
    starts_at        TIMESTAMPTZ,
    ends_at          TIMESTAMPTZ,
    platforms        VARCHAR(8)   NOT NULL DEFAULT 'all' CHECK (platforms IN ('all', 'twitch', 'kick')),
    only_channels    VARCHAR(500),
    status           VARCHAR(12)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    sort_order       INT          NOT NULL DEFAULT 0,
    created_by       BIGINT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_promo_pieces_status ON promo_pieces (status, sort_order);

-- Una sola fila (id = 1): topes de cuidado del espectador. El streamer puede ser más discreto que esto, nunca más insistente.
CREATE TABLE IF NOT EXISTS promo_settings (
    id                 BIGINT PRIMARY KEY,
    min_gap_seconds    INT NOT NULL DEFAULT 60,
    hourly_cap_seconds INT NOT NULL DEFAULT 600,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO promo_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Plantillas de partida (el dueño las edita o agrega más desde /admin).
INSERT INTO promo_templates (key, name_es, name_en, layout, zone, theme, animation, sort_order) VALUES
 ('tarjeta',  'Tarjeta',  'Card',    'card',    'corner', 'graphite', 'slide', 0),
 ('compacta', 'Compacta', 'Compact', 'compact', 'corner', 'graphite', 'fade',  1),
 ('barra',    'Barra',    'Bar',     'bar',     'banner', 'blue',     'slide', 2)
ON CONFLICT (key) DO NOTHING;

-- Dos piezas de ejemplo en borrador (nada se muestra hasta que el dueño las publique y exista el overlay).
INSERT INTO promo_pieces (kind, title_es, title_en, body_es, body_en, template_id, zone, status, sort_order)
SELECT 'commands', 'Comandos del canal', 'Channel commands', 'Escribe en el chat: {{commands}}', 'Type in chat: {{commands}}',
       (SELECT id FROM promo_templates WHERE key = 'tarjeta'), 'corner', 'draft', 0
WHERE NOT EXISTS (SELECT 1 FROM promo_pieces);
INSERT INTO promo_pieces (kind, title_es, title_en, body_es, body_en, link_url, show_qr, template_id, zone, status, sort_order)
SELECT 'qr', 'Decatron', 'Decatron', 'Overlays, comandos y sorteos para tu stream', 'Overlays, commands and giveaways for your stream',
       'https://decatron.net', TRUE, (SELECT id FROM promo_templates WHERE key = 'barra'), 'banner', 'draft', 1
WHERE (SELECT COUNT(*) FROM promo_pieces) = 1;

-- Módulo de plan: incluido en todo plan de pago (nivel semilla, sort 20), sin precio suelto. Sandbox cuenta como semilla; el interno lo tiene todo.
INSERT INTO capabilities (key, kind, group_key, default_value, meter, description, active, sort)
VALUES ('module.ov_promo', 'flag', 'modulos', 1, 'none', 'Promociones (overlay de piezas y tarjetas propias)', true, 527)
ON CONFLICT (key) DO NOTHING;

INSERT INTO plan_entitlements (plan_id, capability_key, value)
SELECT p.id, 'module.ov_promo', 1 FROM plans p
WHERE p.is_internal OR (CASE WHEN p.key = 'sandbox' THEN 20 ELSE p.sort END) >= 20
ON CONFLICT DO NOTHING;

-- El backend corre con el rol decatron_app: las tablas creadas como postgres no se lo dan solas.
GRANT SELECT, INSERT, UPDATE, DELETE ON promo_templates, promo_pieces, promo_settings TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE promo_templates_id_seq, promo_pieces_id_seq TO decatron_app;

COMMIT;
