-- Modulo de Torneos — Fortnite F2: formato por puntos (27-09-2026).
-- Ver .dev/torneos/15-fortnite.md. Se corre a mano contra Postgres como el resto
-- de Decatron.Data/Migrations/*.sql. Idempotente.
--
-- Tabla de puntos, desempates, grupos (cuando no entran todos en un lobby),
-- sesiones y partidas. Los resultados de cada partida llegan en F4.

BEGIN;

-- Una fila por edicion de Fortnite: como se cuentan los puntos.
CREATE TABLE IF NOT EXISTS tournament_fortnite_configs (
    id                        BIGSERIAL PRIMARY KEY,
    tournament_edition_id     BIGINT      NOT NULL UNIQUE REFERENCES tournament_editions(id) ON DELETE CASCADE,
    -- [{"from":1,"to":1,"points":25}, {"from":2,"to":2,"points":20}, ...]
    placement_points          JSONB       NOT NULL DEFAULT '[]',
    points_per_elimination    INTEGER     NOT NULL DEFAULT 1,
    -- Orden de desempate: wins | eliminations | avg_placement | last_game_placement
    tiebreakers               TEXT[]      NOT NULL DEFAULT '{wins,eliminations,avg_placement,last_game_placement}',
    max_players_per_lobby     SMALLINT    NOT NULL DEFAULT 100,
    -- true = los que se inscriben solos se sortean para completar equipos
    fill_solos_randomly       BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Opcional: al llegar a estos puntos el equipo queda "en match point" y gana
    -- el torneo si gana una partida. NULL = sin match point.
    match_point_threshold     INTEGER,
    created_at                TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Grupos de la fase de grupos y la final.
CREATE TABLE IF NOT EXISTS tournament_fortnite_groups (
    id                        BIGSERIAL PRIMARY KEY,
    tournament_edition_id     BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    name                      VARCHAR(60)  NOT NULL,
    sort_order                SMALLINT     NOT NULL DEFAULT 0,
    is_final                  BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Cuantos equipos de este grupo pasan a la final (NULL en la final).
    qualify_count             SMALLINT,
    created_at                TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_fortnite_groups_edition ON tournament_fortnite_groups (tournament_edition_id, sort_order);

-- Que equipos juegan en cada grupo. Un equipo puede estar en su grupo y en la final.
CREATE TABLE IF NOT EXISTS tournament_fortnite_group_teams (
    id                        BIGSERIAL PRIMARY KEY,
    group_id                  BIGINT      NOT NULL REFERENCES tournament_fortnite_groups(id) ON DELETE CASCADE,
    team_id                   BIGINT      NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    created_at                TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_fortnite_group_teams_team ON tournament_fortnite_group_teams (team_id);

-- Sesiones (dias de juego). group_id NULL = todos juegan en un solo lobby.
CREATE TABLE IF NOT EXISTS tournament_fortnite_sessions (
    id                        BIGSERIAL PRIMARY KEY,
    tournament_edition_id     BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    group_id                  BIGINT       REFERENCES tournament_fortnite_groups(id) ON DELETE CASCADE,
    name                      VARCHAR(80)  NOT NULL,
    scheduled_at              TIMESTAMP,
    -- scheduled | in_progress | finished
    status                    VARCHAR(20)  NOT NULL DEFAULT 'scheduled',
    sort_order                SMALLINT     NOT NULL DEFAULT 0,
    created_at                TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_fortnite_sessions_edition ON tournament_fortnite_sessions (tournament_edition_id, sort_order);

-- Partidas de cada sesion. El codigo de la personalizada y el flujo de estados
-- (codigo revelado, en juego, reporte) llegan en F3.
CREATE TABLE IF NOT EXISTS tournament_fortnite_games (
    id                        BIGSERIAL PRIMARY KEY,
    session_id                BIGINT       NOT NULL REFERENCES tournament_fortnite_sessions(id) ON DELETE CASCADE,
    game_number               SMALLINT     NOT NULL,
    status                    VARCHAR(20)  NOT NULL DEFAULT 'waiting',
    created_at                TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, game_number)
);

COMMIT;
