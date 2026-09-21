-- Corrige el diseno de vinculacion de Riot: en vez de verificar por-torneo
-- (Add_Tournament_Riot_Verification.sql, 15-08-2026), se vincula a nivel de cuenta
-- de plataforma en Settings, una sola vez, reutilizable en cualquier torneo — y
-- soporta varias cuentas de Riot por persona (smurfs, otro server). El participante
-- elige cual usar recien al inscribirse a una edicion puntual.
CREATE TABLE IF NOT EXISTS user_riot_accounts (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    riot_id VARCHAR(64) NOT NULL,
    riot_tag_line VARCHAR(16) NOT NULL,
    region VARCHAR(8) NOT NULL,
    puuid VARCHAR(128) NOT NULL,
    verification_challenge_icon_id INTEGER,
    verification_started_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_riot_accounts_account_id ON user_riot_accounts(account_id);
-- Evita que dos personas distintas terminen ambas "verificadas" sobre el mismo PUUID.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_riot_accounts_puuid_verified ON user_riot_accounts(puuid) WHERE verified_at IS NOT NULL;

-- Las columnas de verificacion por-torneo quedan obsoletas (la verificacion ahora
-- vive en user_riot_accounts) — se borran en vez de dejarlas sin usar, el feature
-- nunca llego a tener datos reales de un participante externo.
ALTER TABLE tournament_participants DROP COLUMN IF EXISTS riot_verification_challenge_icon_id;
ALTER TABLE tournament_participants DROP COLUMN IF EXISTS riot_verification_started_at;
ALTER TABLE tournament_participants DROP COLUMN IF EXISTS riot_verified_at;

ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS linked_riot_account_id BIGINT;
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS smurf_flag_note TEXT;
