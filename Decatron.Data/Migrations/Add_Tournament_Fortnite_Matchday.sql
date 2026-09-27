-- Modulo de Torneos — Fortnite F3: dia de partida (27-09-2026).
-- Ver .dev/torneos/15-fortnite.md. Se corre a mano contra Postgres como el resto
-- de Decatron.Data/Migrations/*.sql. Idempotente.
--
-- Check-in por sesion y codigo de la partida personalizada por partida. El codigo
-- solo lo ven el organizador y los jugadores con check-in; nunca va a endpoints
-- publicos, al chat ni al overlay.
--
-- Estados de sesion: scheduled | check_in | in_progress | finished
-- Estados de partida: waiting | revealed | playing | reporting | closed

BEGIN;

ALTER TABLE tournament_fortnite_games
    ADD COLUMN IF NOT EXISTS custom_code  VARCHAR(60),
    ADD COLUMN IF NOT EXISTS revealed_at  TIMESTAMP,
    ADD COLUMN IF NOT EXISTS started_at   TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ended_at     TIMESTAMP;

CREATE TABLE IF NOT EXISTS tournament_fortnite_session_checkins (
    id                BIGSERIAL PRIMARY KEY,
    session_id        BIGINT       NOT NULL REFERENCES tournament_fortnite_sessions(id) ON DELETE CASCADE,
    participant_id    BIGINT       NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
    -- 'self' = lo hizo el jugador | 'staff' = lo marco el organizador
    checked_in_by     VARCHAR(10)  NOT NULL DEFAULT 'self',
    checked_in_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, participant_id)
);
ALTER TABLE tournament_fortnite_session_checkins OWNER TO decatron_user;

COMMIT;
