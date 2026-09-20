-- Predicciones del chat sobre las partidas de LoL (Coach de LoL). 2026-09-20
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS lol_predictions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_key      VARCHAR(120) NOT NULL,
    champion      VARCHAR(40),
    opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closes_at     TIMESTAMPTZ NOT NULL,
    resolved_at   TIMESTAMPTZ,
    result        VARCHAR(10),
    pool_win      BIGINT NOT NULL DEFAULT 0,
    pool_loss     BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lol_predictions_user ON lol_predictions (user_id, resolved_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lol_predictions_game ON lol_predictions (user_id, game_key);

CREATE TABLE IF NOT EXISTS lol_prediction_bets (
    id             BIGSERIAL PRIMARY KEY,
    prediction_id  BIGINT NOT NULL REFERENCES lol_predictions(id) ON DELETE CASCADE,
    viewer         VARCHAR(100) NOT NULL,
    side           VARCHAR(5) NOT NULL,
    amount         INT NOT NULL,
    payout         BIGINT NOT NULL DEFAULT 0,
    placed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id, viewer)
);

CREATE TABLE IF NOT EXISTS lol_prediction_points (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewer     VARCHAR(100) NOT NULL,
    points     BIGINT NOT NULL DEFAULT 0,
    correct    INT NOT NULL DEFAULT 0,
    total      INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, viewer)
);

ALTER TABLE lol_coach_settings
    ADD COLUMN IF NOT EXISTS predictions_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS prediction_start_points INT NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS prediction_close_minutes INT NOT NULL DEFAULT 5;

ALTER TABLE lol_predictions OWNER TO decatron_user; ALTER SEQUENCE lol_predictions_id_seq OWNER TO decatron_user;
ALTER TABLE lol_prediction_bets OWNER TO decatron_user; ALTER SEQUENCE lol_prediction_bets_id_seq OWNER TO decatron_user;
ALTER TABLE lol_prediction_points OWNER TO decatron_user; ALTER SEQUENCE lol_prediction_points_id_seq OWNER TO decatron_user;
