-- Modulo de Torneos - Milestone 4: equipos (ARAM N vs N, Clash 5v5) + bracket.
-- Plan: .dev/torneos/02-motor-de-torneo-formatos.md
--
-- Cobertura real de este corte (documentado, no silenciado): generador de bracket
-- 'single_elimination' unicamente — es el unico formato observado en un ejemplo real
-- (LoL Classic del audit: cuartos/semis BO1, final BO3). 'double_elimination',
-- 'round_robin' y 'swiss' quedan sin implementar — el campo bracket_format de
-- tournament_editions ya los admite como valor, pero el generador solo reacciona a
-- 'single_elimination' por ahora (ver TournamentBracketService).

ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS join_code VARCHAR(12);
ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS seed_locked BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_teams_join_code ON tournament_teams(join_code) WHERE join_code IS NOT NULL;

-- ============================================================
-- TOURNAMENT_MATCHES (un enfrentamiento del bracket, serie BO-X)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_matches (
    id                      BIGSERIAL PRIMARY KEY,
    tournament_edition_id    BIGINT      NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    round_number               SMALLINT    NOT NULL,
    bracket_position             SMALLINT    NOT NULL,
    team_a_id                     BIGINT      REFERENCES tournament_teams(id),
    team_b_id                       BIGINT      REFERENCES tournament_teams(id),
    winner_team_id                    BIGINT      REFERENCES tournament_teams(id),
    -- 'scheduled' | 'in_progress' | 'finished' | 'walkover'
    status                              VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    scheduled_at                          TIMESTAMP,
    created_at                              TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at                                TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_edition ON tournament_matches(tournament_edition_id, round_number);

-- ============================================================
-- TOURNAMENT_GAMES (cada partida individual dentro de la serie BO-X de un match)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_games (
    id                    BIGSERIAL PRIMARY KEY,
    tournament_match_id    BIGINT   NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
    game_number              SMALLINT NOT NULL,
    winner_team_id             BIGINT   REFERENCES tournament_teams(id),
    riot_match_id                 VARCHAR(50),
    created_at                      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tournament_games_match_number UNIQUE (tournament_match_id, game_number)
);
