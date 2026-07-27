-- ============================================================
-- Fortnite Spirit Tracker
-- Tablas: fortnite_sprites, user_fortnite_sprites
-- Seed: 97 sprites desde fnsprites
-- ============================================================

-- Tabla catálogo de sprites
CREATE TABLE IF NOT EXISTS fortnite_sprites (
    id SERIAL PRIMARY KEY,
    sprite_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    character VARCHAR(100) NOT NULL,
    theme VARCHAR(50) NOT NULL,
    rarity VARCHAR(50) NOT NULL,
    image_url VARCHAR(500),
    is_unreleased BOOLEAN NOT NULL DEFAULT FALSE,
    season VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla colección por usuario
CREATE TABLE IF NOT EXISTS user_fortnite_sprites (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sprite_id INTEGER NOT NULL REFERENCES fortnite_sprites(id) ON DELETE CASCADE,
    obtained_at TIMESTAMP NOT NULL DEFAULT NOW(),
    platform VARCHAR(20) NOT NULL DEFAULT 'web',
    UNIQUE(user_id, sprite_id)
);

CREATE INDEX IF NOT EXISTS idx_user_fortnite_sprites_user_id ON user_fortnite_sprites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fortnite_sprites_sprite_id ON user_fortnite_sprites(sprite_id);

-- ============================================================
-- SEED: Sprites desde fnsprites (staticvacant/fnsprites)
-- ============================================================

INSERT INTO fortnite_sprites (sprite_key, name, character, theme, rarity, is_unreleased) VALUES
-- Water
('water_basic',     'Water',            'Water',      'Basic',    'Rare',      false),
('water_gold',      'Gold Water',       'Water',      'Gold',     'Special',   false),
('water_candy',     'Gummy Water',      'Water',      'Candy',    'Special',   false),
('water_galaxy',    'Galaxy Water',     'Water',      'Galaxy',   'Special',   false),
('water_gem',       'Gem Water',        'Water',      'Gem',      'Special',   true),
('water_holofoil',  'Holofoil Water',   'Water',      'Holofoil', 'Special',   true),
-- Earth
('earth_basic',     'Earth',            'Earth',      'Basic',    'Rare',      false),
('earth_gold',      'Gold Earth',       'Earth',      'Gold',     'Special',   false),
('earth_candy',     'Gummy Earth',      'Earth',      'Candy',    'Special',   false),
('earth_galaxy',    'Galaxy Earth',     'Earth',      'Galaxy',   'Special',   false),
('earth_gem',       'Gem Earth',        'Earth',      'Gem',      'Special',   true),
-- Fire
('fire_basic',      'Fire',             'Fire',       'Basic',    'Rare',      false),
('fire_gold',       'Gold Fire',        'Fire',       'Gold',     'Special',   false),
('fire_candy',      'Gummy Fire',       'Fire',       'Candy',    'Special',   false),
('fire_galaxy',     'Galaxy Fire',      'Fire',       'Galaxy',   'Special',   false),
('fire_holofoil',   'Holofoil Fire',    'Fire',       'Holofoil', 'Special',   true),
-- Duck
('duck_basic',      'Duck',             'Duck',       'Basic',    'Epic',      false),
('duck_gold',       'Gold Duck',        'Duck',       'Gold',     'Special',   false),
('duck_candy',      'Gummy Duck',       'Duck',       'Candy',    'Special',   false),
('duck_galaxy',     'Galaxy Duck',      'Duck',       'Galaxy',   'Special',   false),
('duck_gem',        'Gem Duck',         'Duck',       'Gem',      'Special',   true),
-- Ghost
('ghost_basic',     'Ghost',            'Ghost',      'Basic',    'Epic',      false),
('ghost_gold',      'Gold Ghost',       'Ghost',      'Gold',     'Special',   false),
('ghost_candy',     'Gummy Ghost',      'Ghost',      'Candy',    'Special',   false),
('ghost_galaxy',    'Galaxy Ghost',     'Ghost',      'Galaxy',   'Special',   false),
('ghost_holofoil',  'Holofoil Ghost',   'Ghost',      'Holofoil', 'Special',   true),
-- Dream
('dream_basic',     'Dream',            'Dream',      'Basic',    'Legendary', false),
('dream_gold',      'Gold Dream',       'Dream',      'Gold',     'Special',   false),
('dream_candy',     'Gummy Dream',      'Dream',      'Candy',    'Special',   false),
('dream_galaxy',    'Galaxy Dream',     'Dream',      'Galaxy',   'Special',   false),
('dream_rift',      'Rift Dream',       'Dream',      'Rift',     'Special',   true),
-- Demon
('demon_basic',     'Demon',            'Demon',      'Basic',    'Epic',      false),
('demon_gold',      'Gold Demon',       'Demon',      'Gold',     'Special',   false),
('demon_candy',     'Gummy Demon',      'Demon',      'Candy',    'Special',   false),
('demon_galaxy',    'Galaxy Demon',     'Demon',      'Galaxy',   'Special',   false),
('demon_gem',       'Gem Demon',        'Demon',      'Gem',      'Special',   true),
-- Punk
('punk_basic',      'Punk',             'Punk',       'Basic',    'Legendary', false),
('punk_gold',       'Gold Punk',        'Punk',       'Gold',     'Special',   false),
('punk_candy',      'Gummy Punk',       'Punk',       'Candy',    'Special',   false),
('punk_galaxy',     'Galaxy Punk',      'Punk',       'Galaxy',   'Special',   false),
('punk_gem',        'Gem Punk',         'Punk',       'Gem',      'Special',   true),
('punk_rift',       'Rift Punk',        'Punk',       'Rift',     'Special',   true),
-- King
('king_basic',      'King',             'King',       'Basic',    'Epic',      false),
('king_gold',       'Gold King',        'King',       'Gold',     'Special',   false),
('king_candy',      'Gummy King',       'King',       'Candy',    'Special',   false),
('king_galaxy',     'Galaxy King',      'King',       'Galaxy',   'Special',   false),
('king_holofoil',   'Holofoil King',    'King',       'Holofoil', 'Special',   true),
-- Zero Point
('zeropoint_basic',     'Zero Point',          'Zero Point', 'Basic',    'Mythic',    false),
('zeropoint_gold',      'Gold Zero Point',     'Zero Point', 'Gold',     'Special',   false),
('zeropoint_candy',     'Gummy Zero Point',    'Zero Point', 'Candy',    'Special',   false),
('zeropoint_galaxy',    'Galaxy Zero Point',   'Zero Point', 'Galaxy',   'Special',   false),
('zeropoint_gem',       'Gem Zero Point',      'Zero Point', 'Gem',      'Special',   true),
('zeropoint_holofoil',  'Quack Zero Point',    'Zero Point', 'Holofoil', 'Special',   true),
-- Burnt Peanut
('theburntpeanut_basic', 'Burnt Peanut',       'Burnt Peanut', 'Basic',  'Mythic',    false),
-- Fishy
('fishy_basic',     'Fishy',            'Fishy',      'Basic',    'Rare',      false),
('fishy_gold',      'Gold Fishy',       'Fishy',      'Gold',     'Special',   false),
('fishy_candy',     'Gummy Fishy',      'Fishy',      'Candy',    'Special',   false),
('fishy_galaxy',    'Galaxy Fishy',     'Fishy',      'Galaxy',   'Special',   false),
-- Striker
('striker_basic',   'Striker',          'Striker',    'Basic',    'Epic',      false),
('striker_gold',    'Gold Striker',     'Striker',    'Gold',     'Special',   false),
('striker_candy',   'Gummy Striker',    'Striker',    'Candy',    'Special',   false),
('striker_galaxy',  'Galaxy Striker',   'Striker',    'Galaxy',   'Special',   false),
('striker_holofoil','Holofoil Striker', 'Striker',    'Holofoil', 'Special',   true),
-- Aura
('aura_basic',      'Aura',             'Aura',       'Basic',    'Epic',      false),
('aura_gold',       'Gold Aura',        'Aura',       'Gold',     'Special',   false),
('aura_candy',      'Gummy Aura',       'Aura',       'Candy',    'Special',   false),
('aura_galaxy',     'Galaxy Aura',      'Aura',       'Galaxy',   'Special',   false),
('aura_gem',        'Gem Aura',         'Aura',       'Gem',      'Special',   true),
-- Boss
('boss_basic',      'Boss',             'Boss',       'Basic',    'Legendary', false),
('boss_gold',       'Gold Boss',        'Boss',       'Gold',     'Special',   false),
('boss_candy',      'Gummy Boss',       'Boss',       'Candy',    'Special',   false),
('boss_galaxy',     'Galaxy Boss',      'Boss',       'Galaxy',   'Special',   false),
-- Grim
('grim_basic',      'Grim',             'Grim',       'Basic',    'Mythic',    false),
('grim_gold',       'Gold Grim',        'Grim',       'Gold',     'Special',   false),
('grim_candy',      'Gummy Grim',       'Grim',       'Candy',    'Special',   false),
('grim_galaxy',     'Galaxy Grim',      'Grim',       'Galaxy',   'Special',   false),
-- Air (all unreleased)
('air_basic',       'Air',              'Air',        'Basic',    'Rare',      true),
('air_gold',        'Gold Air',         'Air',        'Gold',     'Special',   true),
('air_candy',       'Gummy Air',        'Air',        'Candy',    'Special',   true),
('air_galaxy',      'Galaxy Air',       'Air',        'Galaxy',   'Special',   true),
('air_holofoil',    'Holofoil Air',     'Air',        'Holofoil', 'Special',   true),
-- Seven (all unreleased)
('seven_basic',     'Seven',            'Seven',      'Basic',    'Legendary', true),
('seven_gold',      'Gold Seven',       'Seven',      'Gold',     'Special',   true),
('seven_candy',     'Gummy Seven',      'Seven',      'Candy',    'Special',   true),
('seven_galaxy',    'Galaxy Seven',     'Seven',      'Galaxy',   'Special',   true),
('seven_holofoil',  'Holofoil Seven',   'Seven',      'Holofoil', 'Special',   true),
-- John Wick (unreleased)
('wick_basic',      'John Wick',        'John Wick',  'Basic',    'Mythic',    true)
ON CONFLICT (sprite_key) DO NOTHING;
