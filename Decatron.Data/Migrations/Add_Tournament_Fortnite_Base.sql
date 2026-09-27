-- Modulo de Torneos — Fortnite F0/F1 (27-09-2026). Ver .dev/torneos/15-fortnite.md.
-- Se corre a mano contra Postgres como el resto de Decatron.Data/Migrations/*.sql.
-- Idempotente: se puede correr dos veces sin romper nada.
--
-- tournament_editions.game ya existia (fijo en 'lol'); no hace falta tocarla.
-- Las ediciones de Fortnite usan mode = 'fortnite_points' y region = region de
-- servidor de Fortnite (nae, nac, naw, eu, br, asia, me, oce).
--
-- Cuenta de juego del participante para juegos que no son de Riot (hoy solo
-- Fortnite). Los campos riot_* se quedan para LoL como estaban, para no tocar el
-- sync, los standings ni el ranking que ya los leen directo.

BEGIN;

ALTER TABLE tournament_participants
    ADD COLUMN IF NOT EXISTS game_account_id BIGINT NULL REFERENCES linked_game_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS game_account_name VARCHAR(100) NULL,
    -- true solo cuando la cuenta se verifico con el login oficial de Epic. Mientras
    -- Epic no apruebe la app, las cuentas son sin verificar (decision 27-09-2026).
    ADD COLUMN IF NOT EXISTS game_account_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- La misma cuenta de Epic no puede estar dos veces en la misma edicion. Los
-- nombres de Epic son unicos sin distinguir mayusculas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_participants_edition_game_account
    ON tournament_participants (tournament_edition_id, lower(game_account_name))
    WHERE game_account_name IS NOT NULL;

COMMIT;
