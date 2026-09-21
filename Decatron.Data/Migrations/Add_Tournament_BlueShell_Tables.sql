-- Modulo de Torneos - Milestone 1: motor Blue Shell / Aegis.
-- Plan: .dev/torneos/04-motor-blue-shell-aegis.md

-- ============================================================
-- TOURNAMENT_PUNISHMENT_TYPES (catalogo de castigos, por edicion)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_punishment_types (
    id                    BIGSERIAL PRIMARY KEY,
    tournament_edition_id BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    name                  VARCHAR(150) NOT NULL,
    description           VARCHAR(500),
    allows_reverse        BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_punishment_types_edition ON tournament_punishment_types(tournament_edition_id);

-- ============================================================
-- TOURNAMENT_SHELL_TRIGGERS (catalogo de como se consiguen, por edicion)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_shell_triggers (
    id                    BIGSERIAL PRIMARY KEY,
    tournament_edition_id BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    name                  VARCHAR(150) NOT NULL,
    -- 'stat_threshold' | 'streak_wins' | 'perfect_kda' | 'match_duration_min' | 'champion_variety' | 'win_with_active_punishment'
    -- (ComebackGold y StealOnWin quedan fuera de Milestone 1 — el snapshot de partida no
    -- guarda oro ni identidad del rival, ver nota en TournamentBlueShellEngine)
    condition_type        VARCHAR(40)  NOT NULL,
    -- que campo del snapshot mira 'stat_threshold': 'kills' | 'assists' | 'deaths'
    stat_field             VARCHAR(20),
    threshold_value        DECIMAL(10,2) NOT NULL DEFAULT 0,
    shells_granted          SMALLINT     NOT NULL DEFAULT 1,
    is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at                TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_shell_triggers_edition ON tournament_shell_triggers(tournament_edition_id, is_active);

-- ============================================================
-- TOURNAMENT_BLUE_SHELL_RULES (una fila por edicion)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_blue_shell_rules (
    id                          BIGSERIAL PRIMARY KEY,
    tournament_edition_id       BIGINT   NOT NULL UNIQUE REFERENCES tournament_editions(id) ON DELETE CASCADE,
    -- jsonb: [{"minRank":1,"maxRank":1,"cooldownHours":0}, ...]
    cooldown_by_rank             JSONB    NOT NULL DEFAULT '[]',
    -- jsonb: [{"minRank":1,"maxRank":1,"reverseChancePercent":1}, ...]
    reverse_chance_by_rank        JSONB    NOT NULL DEFAULT '[]',
    max_inventory                 SMALLINT NOT NULL DEFAULT 3,
    throw_block_window_minutes     SMALLINT NOT NULL DEFAULT 15,
    disable_last_n_hours           SMALLINT NOT NULL DEFAULT 48,
    daily_drop_enabled              BOOLEAN  NOT NULL DEFAULT FALSE,
    daily_drop_challenge_template    VARCHAR(500),
    created_at                        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TOURNAMENT_SHELL_INVENTORIES (una fila por participante)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_shell_inventories (
    id                         BIGSERIAL PRIMARY KEY,
    tournament_participant_id  BIGINT   NOT NULL UNIQUE REFERENCES tournament_participants(id) ON DELETE CASCADE,
    count                      SMALLINT NOT NULL DEFAULT 0,
    total_obtained              INTEGER  NOT NULL DEFAULT 0,
    total_thrown                 INTEGER  NOT NULL DEFAULT 0,
    total_received                INTEGER  NOT NULL DEFAULT 0,
    total_stolen                   INTEGER  NOT NULL DEFAULT 0,
    updated_at                      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TOURNAMENT_SHELL_EVENTS (log — alimenta auditoria y panel "Blue Shell" del jugador)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_shell_events (
    id                       BIGSERIAL PRIMARY KEY,
    tournament_edition_id    BIGINT      NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    -- 'obtained' | 'thrown' | 'received' | 'fulfilled' | 'stolen'
    type                     VARCHAR(20) NOT NULL,
    source_participant_id     BIGINT      NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
    target_participant_id      BIGINT      REFERENCES tournament_participants(id) ON DELETE CASCADE,
    trigger_id                  BIGINT      REFERENCES tournament_shell_triggers(id),
    punishment_type_id           BIGINT      REFERENCES tournament_punishment_types(id),
    was_reverse                   BOOLEAN     NOT NULL DEFAULT FALSE,
    was_lost_full                  BOOLEAN     NOT NULL DEFAULT FALSE,
    fulfilled_at                    TIMESTAMP,
    fulfilled_by_staff_id             BIGINT      REFERENCES users(id),
    created_at                         TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_shell_events_edition ON tournament_shell_events(tournament_edition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_shell_events_source ON tournament_shell_events(source_participant_id);
CREATE INDEX IF NOT EXISTS idx_tournament_shell_events_target ON tournament_shell_events(target_participant_id);

-- ============================================================
-- Marca que snapshots ya fueron evaluados por el motor (evita re-evaluar en cada resync)
-- ============================================================
ALTER TABLE tournament_lp_snapshots ADD COLUMN IF NOT EXISTS blue_shell_evaluated_at TIMESTAMP;
