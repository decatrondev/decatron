-- "accounts": la persona real, separada del canal. Paso 1 (bajo riesgo, aditivo)
-- del plan de unificacion multiplataforma — ver
-- .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 4.3 y 8.6.
--
-- Cada fila de "users" (Twitch o Kick, cada una su propio canal) sigue siendo
-- su propia unidad de config — esto NO cambia. Lo unico que "accounts" agrega
-- es la capacidad de decir "estas N filas de canal son la misma persona".
--
-- account_id es NULLABLE a proposito: no se fuerza NOT NULL para no arriesgar
-- romper algun camino de creacion de usuario que no se haya encontrado. Una
-- fila con account_id NULL simplemente no aparece vinculada a nada — estado
-- inofensivo, no un error.

CREATE TABLE IF NOT EXISTS accounts (
    id BIGINT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill: cada usuario existente hoy recibe una cuenta con el MISMO id que
-- su propia fila — mnemonico simple ("mi account_id es mi id de siempre") y
-- evita tener que inventar un mapeo. Las cuentas nuevas de acá en adelante
-- (via el secuencial propio) usan ids que arrancan despues del mayor id de
-- usuario existente, para no pisarse con este backfill.
INSERT INTO accounts (id, created_at)
SELECT id, created_at FROM users
ON CONFLICT (id) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id);
UPDATE users SET account_id = id WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_account_id ON users (account_id);

CREATE SEQUENCE IF NOT EXISTS accounts_id_seq;
SELECT setval('accounts_id_seq', GREATEST(
    (SELECT COALESCE(MAX(id), 0) FROM accounts),
    (SELECT COALESCE(MAX(id), 0) FROM users)
));
ALTER TABLE accounts ALTER COLUMN id SET DEFAULT nextval('accounts_id_seq');
ALTER SEQUENCE accounts_id_seq OWNED BY accounts.id;
