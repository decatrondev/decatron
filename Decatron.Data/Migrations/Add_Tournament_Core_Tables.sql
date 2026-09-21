-- Modulo de Torneos - Milestone 0 (cimientos)
-- Crea las tablas nucleo del modo SoloQ Climb: ediciones, divisiones, equipos,
-- participantes, snapshots de LP (alimentados por el poller de Riot API) y la
-- config de Riot API key por canal (tenant).
--
-- Plan completo: .dev/torneos/ (ver 01-modelo-de-datos.md y 03-riot-api-integracion.md)
-- Convencion de tenancy: channel_owner_id BIGINT REFERENCES users(id), igual que
-- el resto de tablas ya migradas de channel_name a user_id (ver Add_UserId_FK_To_All_Tables.sql).

-- ============================================================
-- TOURNAMENT_EDITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_editions (
    id                    BIGSERIAL PRIMARY KEY,
    channel_owner_id      BIGINT       NOT NULL REFERENCES users(id),
    name                  VARCHAR(255) NOT NULL,
    slug                  VARCHAR(100) NOT NULL,
    short_label           VARCHAR(50),

    -- 'solo_q_climb' | 'aram_teams' | 'clash_5v5'
    mode                  VARCHAR(30)  NOT NULL DEFAULT 'solo_q_climb',
    -- 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | NULL (modos continuos)
    bracket_format        VARCHAR(30),

    -- 'draft' | 'registration_open' | 'check_in' | 'in_progress' | 'finished' | 'archived'
    status                VARCHAR(30)  NOT NULL DEFAULT 'draft',

    -- fijo 'lol' en Milestone 0-4, ver seam multi-juego en 03-riot-api-integracion.md #7
    game                  VARCHAR(30)  NOT NULL DEFAULT 'lol',
    region                VARCHAR(20)  NOT NULL DEFAULT 'euw1',

    starts_at             TIMESTAMP,
    ends_at               TIMESTAMP,
    check_in_opens_at     TIMESTAMP,
    check_in_closes_at    TIMESTAMP,

    team_size             SMALLINT,
    best_of               SMALLINT,

    logo_url              VARCHAR(500),
    primary_color         VARCHAR(20),
    secondary_color       VARCHAR(20),
    prize_pool_total      DECIMAL(12,2),

    meta_title            VARCHAR(200),
    meta_description      VARCHAR(500),

    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tournament_editions_channel_slug UNIQUE (channel_owner_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tournament_editions_channel ON tournament_editions(channel_owner_id);
CREATE INDEX IF NOT EXISTS idx_tournament_editions_status ON tournament_editions(channel_owner_id, status);

-- ============================================================
-- TOURNAMENT_DIVISIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_divisions (
    id                    BIGSERIAL PRIMARY KEY,
    tournament_edition_id BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    name                  VARCHAR(100) NOT NULL DEFAULT 'General',
    sort_order            SMALLINT     NOT NULL DEFAULT 0,
    min_lp_threshold      INTEGER,
    max_lp_threshold      INTEGER,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_divisions_edition ON tournament_divisions(tournament_edition_id);

-- ============================================================
-- TOURNAMENT_TEAMS (solo se usa si team_size > 1, vacio en SoloQ Climb)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_teams (
    id                    BIGSERIAL PRIMARY KEY,
    tournament_edition_id BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    name                  VARCHAR(150) NOT NULL,
    logo_url              VARCHAR(500),
    seed                  SMALLINT,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_teams_edition ON tournament_teams(tournament_edition_id);

-- ============================================================
-- TOURNAMENT_PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_participants (
    id                     BIGSERIAL PRIMARY KEY,
    tournament_edition_id  BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    tournament_division_id BIGINT       REFERENCES tournament_divisions(id),
    account_id             BIGINT       REFERENCES accounts(id),
    discord_user_id        VARCHAR(30),

    display_name           VARCHAR(150) NOT NULL,
    riot_id                VARCHAR(50),
    riot_tag_line          VARCHAR(10),
    riot_puuid             VARCHAR(100),

    -- 'top' | 'jungle' | 'mid' | 'adc' | 'support'
    primary_role           VARCHAR(20),
    nationality             VARCHAR(5),
    twitch_channel         VARCHAR(100),
    kick_channel           VARCHAR(100),
    twitter_handle         VARCHAR(100),

    team_id                BIGINT       REFERENCES tournament_teams(id),
    is_captain             BOOLEAN      NOT NULL DEFAULT FALSE,

    eligibility_flags      TEXT[]       NOT NULL DEFAULT '{}',

    -- 'pending_approval' | 'approved' | 'rejected' | 'checked_in' | 'active' | 'eliminated' | 'withdrawn'
    status                  VARCHAR(30)  NOT NULL DEFAULT 'pending_approval',
    -- 'web' | 'discord_bot'
    registered_via          VARCHAR(20)  NOT NULL DEFAULT 'web',

    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    approved_at              TIMESTAMP,

    CONSTRAINT uq_tournament_participants_edition_puuid UNIQUE (tournament_edition_id, riot_puuid)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_participants_edition_account
    ON tournament_participants(tournament_edition_id, account_id) WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_participants_edition ON tournament_participants(tournament_edition_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_status ON tournament_participants(tournament_edition_id, status);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_discord ON tournament_participants(discord_user_id);

-- ============================================================
-- TOURNAMENT_LP_SNAPSHOTS (una fila por partida trackeada del poller de Riot API)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_lp_snapshots (
    id                        BIGSERIAL PRIMARY KEY,
    tournament_participant_id BIGINT       NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
    riot_match_id             VARCHAR(50)  NOT NULL,
    occurred_at                TIMESTAMP    NOT NULL,

    lp_before                  INTEGER,
    lp_after                    INTEGER,
    -- 'win' | 'loss'
    result                      VARCHAR(10)  NOT NULL,

    champion                    VARCHAR(50),
    kills                       SMALLINT     NOT NULL DEFAULT 0,
    deaths                      SMALLINT     NOT NULL DEFAULT 0,
    assists                     SMALLINT     NOT NULL DEFAULT 0,
    cs_per_min                  DECIMAL(5,2),
    damage_dealt                INTEGER,
    vision_score                SMALLINT,
    duration_seconds            INTEGER      NOT NULL DEFAULT 0,

    -- lo calcula el motor de Aegis al insertar el snapshot (fase 4, no se implementa en Milestone 0)
    aegis_triggered              BOOLEAN      NOT NULL DEFAULT FALSE,

    created_at                   TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tournament_lp_snapshots_participant_match UNIQUE (tournament_participant_id, riot_match_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_lp_snapshots_participant ON tournament_lp_snapshots(tournament_participant_id, occurred_at);

-- ============================================================
-- TOURNAMENT_RIOT_CONFIGS (una por canal, la key la trae cada tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_riot_configs (
    id                   BIGSERIAL PRIMARY KEY,
    channel_owner_id     BIGINT       NOT NULL REFERENCES users(id),
    -- cifrada con EncryptedStringConverter a nivel EF Core, columna plana en DB (ver 03-riot-api-integracion.md #1)
    api_key              VARCHAR(500) NOT NULL,
    -- 'development' | 'production'
    key_type             VARCHAR(20)  NOT NULL DEFAULT 'development',
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    last_validated_at      TIMESTAMP,
    last_error_at           TIMESTAMP,
    last_error_message      VARCHAR(500),
    created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tournament_riot_configs_channel UNIQUE (channel_owner_id)
);
