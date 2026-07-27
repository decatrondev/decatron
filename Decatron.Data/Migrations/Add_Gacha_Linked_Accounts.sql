-- Migración: Crear tabla gacha_linked_accounts
-- Fecha: 2025-01-13
-- Descripción: Tabla para vincular cuentas de GachaVerse (MySQL) con cuentas de Twitch (PostgreSQL)

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS gacha_linked_accounts (
    id BIGSERIAL PRIMARY KEY,
    gacha_user_id INTEGER NOT NULL,
    gacha_username VARCHAR(100) NOT NULL,
    twitch_user_id BIGINT NOT NULL,
    twitch_username VARCHAR(100) NOT NULL,
    linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice único: Un usuario de Gacha solo puede vincular una cuenta de Twitch activa
CREATE UNIQUE INDEX IF NOT EXISTS idx_gacha_linked_accounts_gacha_user_active
ON gacha_linked_accounts(gacha_user_id)
WHERE is_active = true;

-- Índice único: Una cuenta de Twitch solo puede estar vinculada a un usuario de Gacha activo
CREATE UNIQUE INDEX IF NOT EXISTS idx_gacha_linked_accounts_twitch_user_active
ON gacha_linked_accounts(twitch_user_id)
WHERE is_active = true;

-- Índice para búsquedas por username de Gacha
CREATE INDEX IF NOT EXISTS idx_gacha_linked_accounts_gacha_username
ON gacha_linked_accounts(gacha_username);

-- Índice para búsquedas por username de Twitch
CREATE INDEX IF NOT EXISTS idx_gacha_linked_accounts_twitch_username
ON gacha_linked_accounts(twitch_username);

-- Índice para búsquedas por estado activo
CREATE INDEX IF NOT EXISTS idx_gacha_linked_accounts_is_active
ON gacha_linked_accounts(is_active);

-- Comentarios de la tabla
COMMENT ON TABLE gacha_linked_accounts IS 'Vinculación entre cuentas de GachaVerse (MySQL) y Twitch (PostgreSQL)';
COMMENT ON COLUMN gacha_linked_accounts.gacha_user_id IS 'ID del usuario en la base de datos MySQL de GachaVerse';
COMMENT ON COLUMN gacha_linked_accounts.gacha_username IS 'Username del usuario en GachaVerse (para referencia)';
COMMENT ON COLUMN gacha_linked_accounts.twitch_user_id IS 'ID del usuario en la base de datos PostgreSQL de Decatron';
COMMENT ON COLUMN gacha_linked_accounts.twitch_username IS 'Username de Twitch (para referencia)';
COMMENT ON COLUMN gacha_linked_accounts.linked_at IS 'Fecha y hora de vinculación';
COMMENT ON COLUMN gacha_linked_accounts.is_active IS 'Indica si la vinculación está activa (permite desvinculación)';
COMMENT ON COLUMN gacha_linked_accounts.last_used_at IS 'Última vez que el usuario usó la integración';

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Tabla gacha_linked_accounts creada exitosamente';
END $$;
