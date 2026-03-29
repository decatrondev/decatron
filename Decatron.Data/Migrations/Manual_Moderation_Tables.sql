-- =====================================================
-- DECATRON V2 - CHAT MODERATION SYSTEM
-- Manual PostgreSQL Migration
-- =====================================================
-- Este script crea las 4 tablas necesarias para el sistema de moderación:
-- 1. banned_words: Palabras/frases prohibidas por canal
-- 2. moderation_configs: Configuración de inmunidad y strikes por canal
-- 3. user_strikes: Registro de strikes de usuarios
-- 4. moderation_logs: Logs de acciones de moderación
-- =====================================================

-- =====================================================
-- 1. TABLA: banned_words
-- Almacena las palabras y frases prohibidas por canal
-- Soporta wildcards con asterisco (*spam*)
-- =====================================================
CREATE TABLE IF NOT EXISTS banned_words (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    word VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'leve',
    detections INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_severity CHECK (severity IN ('leve', 'medio', 'severo')),

    -- Indexes
    CONSTRAINT idx_banned_word_channel_word UNIQUE (channel_name, word)
);

-- Índice adicional para búsquedas por canal
CREATE INDEX IF NOT EXISTS idx_banned_word_channel ON banned_words(channel_name);

-- Comentarios
COMMENT ON TABLE banned_words IS 'Palabras y frases prohibidas por canal con soporte para wildcards';
COMMENT ON COLUMN banned_words.word IS 'Palabra o frase prohibida. Puede contener wildcards con asterisco (ej: *spam*)';
COMMENT ON COLUMN banned_words.severity IS 'Nivel de severidad: leve (escalamiento), medio (timeout directo), severo (ban directo)';
COMMENT ON COLUMN banned_words.detections IS 'Número de veces que se ha detectado esta palabra';

-- =====================================================
-- 2. TABLA: moderation_configs
-- Configuración del sistema de moderación por canal
-- =====================================================
CREATE TABLE IF NOT EXISTS moderation_configs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    vip_immunity VARCHAR(20) NOT NULL DEFAULT 'escalamiento',
    sub_immunity VARCHAR(20) NOT NULL DEFAULT 'escalamiento',
    whitelist_users JSONB NOT NULL DEFAULT '[]',
    warning_message VARCHAR(500) NOT NULL DEFAULT '⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5',
    strike_expiration VARCHAR(20) NOT NULL DEFAULT '15min',
    strike1_action VARCHAR(20) NOT NULL DEFAULT 'warning',
    strike2_action VARCHAR(20) NOT NULL DEFAULT 'timeout_1m',
    strike3_action VARCHAR(20) NOT NULL DEFAULT 'timeout_5m',
    strike4_action VARCHAR(20) NOT NULL DEFAULT 'timeout_10m',
    strike5_action VARCHAR(20) NOT NULL DEFAULT 'ban',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_vip_immunity CHECK (vip_immunity IN ('total', 'escalamiento')),
    CONSTRAINT chk_sub_immunity CHECK (sub_immunity IN ('total', 'escalamiento')),
    CONSTRAINT chk_strike_expiration CHECK (strike_expiration IN ('5min', '10min', '15min', '30min', '1hour', 'never')),
    CONSTRAINT chk_strike_actions CHECK (
        strike1_action IN ('warning', 'delete', 'timeout_30s', 'timeout_1m', 'timeout_5m', 'timeout_10m', 'timeout_30m', 'timeout_1h', 'ban') AND
        strike2_action IN ('warning', 'delete', 'timeout_30s', 'timeout_1m', 'timeout_5m', 'timeout_10m', 'timeout_30m', 'timeout_1h', 'ban') AND
        strike3_action IN ('warning', 'delete', 'timeout_30s', 'timeout_1m', 'timeout_5m', 'timeout_10m', 'timeout_30m', 'timeout_1h', 'ban') AND
        strike4_action IN ('warning', 'delete', 'timeout_30s', 'timeout_1m', 'timeout_5m', 'timeout_10m', 'timeout_30m', 'timeout_1h', 'ban') AND
        strike5_action IN ('warning', 'delete', 'timeout_30s', 'timeout_1m', 'timeout_5m', 'timeout_10m', 'timeout_30m', 'timeout_1h', 'ban')
    ),

    -- Un canal solo puede tener una configuración
    CONSTRAINT idx_moderation_config_channel UNIQUE (channel_name)
);

-- Comentarios
COMMENT ON TABLE moderation_configs IS 'Configuración del sistema de moderación y strikes por canal';
COMMENT ON COLUMN moderation_configs.vip_immunity IS 'Inmunidad de VIPs: total (sin sanciones) o escalamiento (entran en sistema de strikes)';
COMMENT ON COLUMN moderation_configs.sub_immunity IS 'Inmunidad de Suscriptores: total o escalamiento';
COMMENT ON COLUMN moderation_configs.whitelist_users IS 'Array JSON de usuarios con inmunidad total permanente';
COMMENT ON COLUMN moderation_configs.warning_message IS 'Mensaje personalizado de advertencia. Variables: $(user), $(strike), $(word)';
COMMENT ON COLUMN moderation_configs.strike_expiration IS 'Tiempo para que un strike baje 1 nivel sin infracciones';

-- =====================================================
-- 3. TABLA: user_strikes
-- Registro de strikes de moderación por usuario
-- =====================================================
CREATE TABLE IF NOT EXISTS user_strikes (
    id BIGSERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    strike_level INTEGER NOT NULL DEFAULT 1,
    last_infraction_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_strike_level CHECK (strike_level >= 0 AND strike_level <= 5),

    -- Un usuario solo puede tener un registro de strike por canal
    CONSTRAINT idx_user_strike_channel_user UNIQUE (channel_name, username)
);

-- Índice adicional para búsquedas por canal
CREATE INDEX IF NOT EXISTS idx_user_strike_channel ON user_strikes(channel_name);

-- Comentarios
COMMENT ON TABLE user_strikes IS 'Registro de niveles de strike de usuarios por canal';
COMMENT ON COLUMN user_strikes.strike_level IS 'Nivel actual de strike (0-5). 0 = sin strikes, 5 = máximo';
COMMENT ON COLUMN user_strikes.last_infraction_at IS 'Timestamp de la última infracción';
COMMENT ON COLUMN user_strikes.expires_at IS 'Fecha en que el strike expira y baja 1 nivel';

-- =====================================================
-- 4. TABLA: moderation_logs
-- Log de todas las detecciones y acciones de moderación
-- =====================================================
CREATE TABLE IF NOT EXISTS moderation_logs (
    id BIGSERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    detected_word VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    action_taken VARCHAR(50) NOT NULL,
    strike_level INTEGER NOT NULL DEFAULT 0,
    full_message TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_log_severity CHECK (severity IN ('leve', 'medio', 'severo'))
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_moderation_log_channel ON moderation_logs(channel_name);
CREATE INDEX IF NOT EXISTS idx_moderation_log_date ON moderation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_log_channel_date ON moderation_logs(channel_name, created_at);

-- Comentarios
COMMENT ON TABLE moderation_logs IS 'Registro de todas las acciones de moderación para análisis y estadísticas';
COMMENT ON COLUMN moderation_logs.detected_word IS 'Palabra que disparó la detección';
COMMENT ON COLUMN moderation_logs.action_taken IS 'Acción ejecutada: warning, delete, timeout_Xs, ban';
COMMENT ON COLUMN moderation_logs.strike_level IS 'Nivel de strike del usuario al momento de la infracción';
COMMENT ON COLUMN moderation_logs.full_message IS 'Mensaje completo (opcional, para análisis)';

-- =====================================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- Descomenta si quieres datos de prueba
-- =====================================================

/*
-- Ejemplo: Configuración por defecto para un canal
INSERT INTO moderation_configs (
    user_id,
    channel_name,
    vip_immunity,
    sub_immunity,
    whitelist_users,
    warning_message,
    strike_expiration,
    strike1_action,
    strike2_action,
    strike3_action,
    strike4_action,
    strike5_action
) VALUES (
    1, -- Reemplazar con el user_id real
    'tu_canal', -- Reemplazar con el nombre del canal
    'escalamiento',
    'escalamiento',
    '[]',
    '⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5',
    '15min',
    'warning',
    'timeout_1m',
    'timeout_5m',
    'timeout_10m',
    'ban'
);

-- Ejemplo: Algunas palabras prohibidas
INSERT INTO banned_words (user_id, channel_name, word, severity) VALUES
    (1, 'tu_canal', '*spam*', 'leve'),
    (1, 'tu_canal', 'insulto', 'medio'),
    (1, 'tu_canal', 'palabra_grave', 'severo');
*/

-- =====================================================
-- VERIFICACIÓN
-- Ejecuta estas queries para verificar la creación
-- =====================================================

-- Verificar tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('banned_words', 'moderation_configs', 'user_strikes', 'moderation_logs')
ORDER BY table_name;

-- Verificar índices
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('banned_words', 'moderation_configs', 'user_strikes', 'moderation_logs')
ORDER BY tablename, indexname;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
