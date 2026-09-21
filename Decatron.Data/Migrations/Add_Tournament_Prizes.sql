-- Modulo de Torneos - Milestone 1: premios.
-- Plan: .dev/torneos/06-premios-pagos-sponsors.md
--
-- Simplificacion deliberada de Milestone 1 vs. el diseno completo: una sola tabla
-- (tournament_prize_tiers) cubre premios por puesto, por rol y por metrica, en vez
-- de separar TournamentPrizeTier / TournamentPrizeSpecial / TournamentMetricDefinition
-- como catalogo aparte. El set de metricas es un enum fijo resuelto en codigo
-- (TournamentPrizeService), no una tabla de catalogo editable — alcanza para las
-- metricas que ya se pueden calcular con los datos que guarda el poller
-- (TournamentLpSnapshot). Fuera de Milestone 1: sponsors, records de partida,
-- pagos — ver .dev/torneos/ESTADO.md para el detalle de que quedo afuera.

CREATE TABLE IF NOT EXISTS tournament_prize_tiers (
    id                       BIGSERIAL PRIMARY KEY,
    tournament_edition_id     BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    tournament_division_id     BIGINT       REFERENCES tournament_divisions(id),
    name                        VARCHAR(150) NOT NULL,
    amount                       DECIMAL(12,2),
    amount_hidden                 BOOLEAN      NOT NULL DEFAULT FALSE,
    -- 'by_rank' | 'by_role' | 'by_metric'
    scope                         VARCHAR(20)  NOT NULL DEFAULT 'by_rank',
    rank                           SMALLINT,
    -- 'top' | 'jungle' | 'mid' | 'adc' | 'support' (solo si scope='by_role')
    role                            VARCHAR(20),
    -- 'most_kills' | 'most_assists' | 'most_wins' | 'best_kda' | 'longest_win_streak' (solo si scope='by_metric')
    metric_key                       VARCHAR(40),
    sort_order                        SMALLINT     NOT NULL DEFAULT 0,
    created_at                          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_prize_tiers_edition ON tournament_prize_tiers(tournament_edition_id, sort_order);
