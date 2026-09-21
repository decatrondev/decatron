-- Anuncios de Decatron para Game Overlays, administrados desde /admin (no por el streamer). 2026-09-21
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS game_overlay_promos (
    id               BIGSERIAL PRIMARY KEY,
    is_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    weight           INT NOT NULL DEFAULT 1,
    sort_order       INT NOT NULL DEFAULT 0,
    title_es         VARCHAR(120) NOT NULL DEFAULT '',
    title_en         VARCHAR(120) NOT NULL DEFAULT '',
    line_es          VARCHAR(300) NOT NULL DEFAULT '',
    line_en          VARCHAR(300) NOT NULL DEFAULT '',
    image_url        VARCHAR(500),
    duration_seconds INT NOT NULL DEFAULT 8,
    games            VARCHAR(200),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_overlay_promo_settings (
    id            BIGINT PRIMARY KEY,
    every_seconds INT NOT NULL DEFAULT 180,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO game_overlay_promo_settings (id, every_seconds) VALUES (1, 180) ON CONFLICT (id) DO NOTHING;

-- Los cuatro mensajes que antes estaban fijos en el front (slides.ts), como punto de partida.
INSERT INTO game_overlay_promos (weight, sort_order, title_es, title_en, line_es, line_en)
SELECT 1, 0, 'Consigue Decatron gratis en', 'Get Decatron for free at', 'Overlays de rango, comandos de chat y sorteos para tu stream', 'Rank overlays, chat commands and giveaways for your stream'
WHERE NOT EXISTS (SELECT 1 FROM game_overlay_promos);
INSERT INTO game_overlay_promos (weight, sort_order, title_es, title_en, line_es, line_en)
SELECT 1, 1, 'Consigue Decatron gratis en', 'Get Decatron for free at', 'Traducción en vivo: tus viewers te escuchan en su idioma', 'Live translation: your viewers hear you in their language'
WHERE (SELECT COUNT(*) FROM game_overlay_promos) = 1;
INSERT INTO game_overlay_promos (weight, sort_order, title_es, title_en, line_es, line_en)
SELECT 1, 2, 'Consigue Decatron gratis en', 'Get Decatron for free at', 'Gacha, colecciones y TCG para que tu chat se enganche', 'Gacha, collections and a TCG to keep your chat hooked'
WHERE (SELECT COUNT(*) FROM game_overlay_promos) = 2;
INSERT INTO game_overlay_promos (weight, sort_order, title_es, title_en, line_es, line_en)
SELECT 1, 3, 'Consigue Decatron gratis en', 'Get Decatron for free at', 'Timers, alertas con voz y mucho más para Twitch y Kick', 'Timers, voice alerts and much more for Twitch and Kick'
WHERE (SELECT COUNT(*) FROM game_overlay_promos) = 3;
