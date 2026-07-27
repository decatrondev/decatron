-- =====================================================
-- Actualización de tabla shoutout_configs
-- Agregar columnas para animaciones, efectos y listas
-- =====================================================

-- Animaciones
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS animation_type VARCHAR(50) NOT NULL DEFAULT 'none';
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS animation_speed VARCHAR(50) NOT NULL DEFAULT 'normal';

-- Efectos visuales (contorno de texto)
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS text_outline_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS text_outline_color VARCHAR(50) NOT NULL DEFAULT '#000000';
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS text_outline_width INTEGER NOT NULL DEFAULT 2;

-- Borde del contenedor
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS container_border_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS container_border_color VARCHAR(50) NOT NULL DEFAULT '#ffffff';
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS container_border_width INTEGER NOT NULL DEFAULT 3;

-- Listas de control
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS blacklist JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shoutout_configs ADD COLUMN IF NOT EXISTS whitelist JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Verificar las columnas agregadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'shoutout_configs'
ORDER BY ordinal_position;
