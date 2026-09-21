-- Game Overlays — Fase 0 (18-09-2026). Ver .dev/plans/GAME_OVERLAYS_PLAN.md §2.
-- Se corre a mano contra Postgres como el resto de Decatron.Data/Migrations/*.sql.
-- Idempotente: se puede correr dos veces sin romper nada.

BEGIN;

-- 1. Cuentas de juego de la PERSONA (account_id). Reemplaza user_riot_accounts.
CREATE TABLE IF NOT EXISTS linked_game_accounts (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    game VARCHAR(32) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    display_name VARCHAR(100) NOT NULL DEFAULT '',
    external_name VARCHAR(100) NOT NULL,
    external_tag VARCHAR(20),
    external_id VARCHAR(120) NOT NULL DEFAULT '',
    region VARCHAR(10),
    verification_challenge_icon_id INTEGER,
    verification_started_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    manual_rank JSONB,
    manual_updated_at TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_linked_game_accounts_account ON linked_game_accounts(account_id, game);
-- Una persona no vincula dos veces la misma cuenta externa para el mismo juego.
-- Las cuentas manuales tienen external_id vacio, asi que quedan fuera del unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_game_accounts_unique_external
    ON linked_game_accounts(account_id, game, provider, external_id) WHERE external_id <> '';
-- Dos personas distintas no pueden estar ambas "verificadas" sobre el mismo id
-- externo del mismo proveedor (mismo criterio que user_riot_accounts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_game_accounts_verified_external
    ON linked_game_accounts(provider, game, external_id) WHERE verified_at IS NOT NULL AND external_id <> '';

-- 1b. Migracion de datos: user_riot_accounts -> linked_game_accounts (game=lol),
-- CONSERVANDO el id para que tournament_participants.linked_riot_account_id siga
-- valido sin tocar nada. Solo inserta las que no existan todavia.
INSERT INTO linked_game_accounts (id, account_id, game, provider, display_name, external_name, external_tag, external_id, region,
                                  verification_challenge_icon_id, verification_started_at, verified_at, created_at, updated_at)
SELECT r.id, r.account_id, 'lol', 'riot', '', r.riot_id, r.riot_tag_line, r.puuid, r.region,
       r.verification_challenge_icon_id, r.verification_started_at, r.verified_at, r.created_at, r.created_at
FROM user_riot_accounts r
WHERE NOT EXISTS (SELECT 1 FROM linked_game_accounts l WHERE l.id = r.id);

SELECT setval('linked_game_accounts_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM linked_game_accounts), 1));

-- user_riot_accounts queda como respaldo hasta verificar en produccion que todo
-- (Settings -> cuentas de Riot, inscripcion a torneos) funciona con la tabla nueva.
-- Borrarla despues con: DROP TABLE user_riot_accounts;

-- 2. Instancias de overlay, por canal.
CREATE TABLE IF NOT EXISTS game_overlay_configs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug VARCHAR(40) NOT NULL DEFAULT 'main',
    name VARCHAR(60) NOT NULL DEFAULT 'Principal',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    detection_mode VARCHAR(16) NOT NULL DEFAULT 'auto',
    forced_game VARCHAR(32),
    idle_behavior VARCHAR(16) NOT NULL DEFAULT 'hide',
    canvas JSONB NOT NULL DEFAULT '{"width":1920,"height":1080}'::jsonb,
    games_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, slug)
);

-- 3. Catalogo categoria de plataforma -> juego interno (semilla abajo).
CREATE TABLE IF NOT EXISTS game_category_mappings (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(10) NOT NULL,
    category_id VARCHAR(40) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    game VARCHAR(32) NOT NULL,
    UNIQUE (platform, category_id)
);

-- 4. Sesiones por stream.
CREATE TABLE IF NOT EXISTS game_session_snapshots (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linked_account_id BIGINT NOT NULL REFERENCES linked_game_accounts(id) ON DELETE CASCADE,
    game VARCHAR(32) NOT NULL,
    stream_started_at TIMESTAMPTZ NOT NULL,
    stream_ended_at TIMESTAMPTZ,
    start_rank JSONB,
    current_rank JSONB,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    matches_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_session_snapshots_channel ON game_session_snapshots(user_id, game, stream_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_session_snapshots_account ON game_session_snapshots(linked_account_id, stream_started_at DESC);

-- 5. Cache compartida de proveedores.
CREATE TABLE IF NOT EXISTS game_data_cache (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    external_id VARCHAR(120) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE (provider, external_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_game_data_cache_expires ON game_data_cache(expires_at);

-- Semilla de categorias de Twitch (game_id de Helix, verificados con la API).
-- Kick se agrega cuando se conecte su webhook (Fase 2); sus ids salen de su API.
INSERT INTO game_category_mappings (platform, category_id, category_name, game) VALUES
    ('twitch', '21779',      'League of Legends',            'lol'),
    ('twitch', '513143',     'Teamfight Tactics',            'tft'),
    ('twitch', '516575',     'VALORANT',                     'valorant'),
    ('twitch', '1264310518', 'Marvel Rivals',                'marvel_rivals'),
    ('twitch', '32399',      'Counter-Strike',               'cs2'),
    ('twitch', '33214',      'Fortnite',                     'fortnite'),
    ('twitch', '30921',      'Rocket League',                'rocket_league'),
    ('twitch', '512710',     'Call of Duty: Warzone',        'warzone')
ON CONFLICT (platform, category_id) DO NOTHING;

COMMIT;
