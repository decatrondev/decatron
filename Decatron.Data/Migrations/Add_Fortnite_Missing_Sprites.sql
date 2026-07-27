-- ============================================================
-- Fortnite Spirit Tracker — Sprites faltantes + correcciones
-- Fuente: staticvacant.github.io/fnsprites
-- ============================================================

-- ─── 1. Insertar sprites faltantes ───────────────────────────

INSERT INTO fortnite_sprites (sprite_key, name, character, theme, rarity, image_url, is_unreleased) VALUES
-- Rift variants faltantes
('earth_rift',    'Rift Earth',    'Earth',    'Rift',  'Special', 'https://staticvacant.github.io/fnsprites/sprites/earth_rift.png',    true),
('fire_rift',     'Rift Fire',     'Fire',     'Rift',  'Special', 'https://staticvacant.github.io/fnsprites/sprites/fire_rift.png',     true),
('fishy_rift',    'Rift Fishy',    'Fishy',    'Rift',  'Special', 'https://staticvacant.github.io/fnsprites/sprites/fishy_rift.png',    true),
('boss_rift',     'Rift Boss',     'Boss',     'Rift',  'Special', 'https://staticvacant.github.io/fnsprites/sprites/boss_rift.png',     true),
('grim_rift',     'Rift Grim',     'Grim',     'Rift',  'Special', 'https://staticvacant.github.io/fnsprites/sprites/grim_rift.png',     true),
-- Batman (personaje nuevo completo)
('batman_basic',    'Batman',          'Batman', 'Basic',    'Mythic',  'https://staticvacant.github.io/fnsprites/sprites/batman_basic.png',    false),
('batman_gold',     'Gold Batman',     'Batman', 'Gold',     'Special', 'https://staticvacant.github.io/fnsprites/sprites/batman_gold.png',     false),
('batman_candy',    'Gummy Batman',    'Batman', 'Candy',    'Special', 'https://staticvacant.github.io/fnsprites/sprites/batman_candy.png',    false),
('batman_galaxy',   'Galaxy Batman',   'Batman', 'Galaxy',   'Special', 'https://staticvacant.github.io/fnsprites/sprites/batman_galaxy.png',   false),
('batman_holofoil', 'Holofoil Batman', 'Batman', 'Holofoil', 'Special', 'https://staticvacant.github.io/fnsprites/sprites/batman_holofoil.png', false),
('batman_rift',     'Rift Batman',     'Batman', 'Rift',     'Special', 'https://staticvacant.github.io/fnsprites/sprites/batman_rift.png',     true),
-- Nuevos personajes únicos
('pollo_basic', 'Pollo',    'Pollo',    'Basic', 'Mythic', 'https://staticvacant.github.io/fnsprites/sprites/pollo_basic.png', true),
('vini_basic',  'Vini Jr.', 'Vini Jr.', 'Basic', 'Mythic', 'https://staticvacant.github.io/fnsprites/sprites/vini_basic.png',  false)
ON CONFLICT (sprite_key) DO NOTHING;

-- ─── 2. Corregir is_unreleased (ya lanzados en fnsprites) ────

UPDATE fortnite_sprites SET is_unreleased = false, updated_at = NOW()
WHERE sprite_key IN (
    -- Holofoils que ya salieron
    'water_holofoil',
    'fire_holofoil',
    'ghost_holofoil',
    'king_holofoil',
    'striker_holofoil',
    -- Air (todos lanzados)
    'air_basic',
    'air_gold',
    'air_candy',
    'air_galaxy',
    'air_holofoil',
    -- Seven (todos lanzados)
    'seven_basic',
    'seven_gold',
    'seven_candy',
    'seven_galaxy',
    'seven_holofoil'
);
