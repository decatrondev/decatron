-- Migración: Sistema de créditos TTS
-- Fecha: 2026-07-26
-- Descripción: Cartera de créditos por canal con dos bolsas (mensual del tier y comprada)
--              más el libro mayor append-only de todos los movimientos.
--              Una bolsa mensual que se reinicia el día 1 y una comprada que no caduca.

-- ─────────────────────────────────────────────────────────────────────────────
-- Saldos: una fila por canal
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tts_credit_balances (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL,

    -- Bolsa mensual: se reinicia el día 1, lo no usado se pierde
    monthly_period    DATE   NOT NULL,               -- primer día del mes vigente
    monthly_granted   BIGINT NOT NULL DEFAULT 0,     -- cuota del mes (tier + transición)
    monthly_used      BIGINT NOT NULL DEFAULT 0,

    -- Bolsa comprada: no caduca. Puede quedar negativa tras un reembolso.
    purchased_balance BIGINT NOT NULL DEFAULT 0,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tts_credit_balances_user
ON tts_credit_balances(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Libro mayor: append-only, nunca se edita ni se borra
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tts_credit_ledger (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- consume | grant_monthly | grant_gift | purchase | refund | adjust
    type         VARCHAR(20) NOT NULL,

    -- Negativo en consumos, positivo en cargas
    credits      BIGINT NOT NULL,

    -- monthly | purchased | none (aciertos de caché)
    bucket       VARCHAR(10) NOT NULL DEFAULT 'none',

    -- speak_chat | event_alerts | tips | timer_alerts | tts_api | admin
    feature      VARCHAR(30),

    -- standard | neural | generative | longform | cache_hit
    engine       VARCHAR(20),

    chars        INTEGER,
    voice        VARCHAR(50),
    language     VARCHAR(20),

    -- Pasarela e id de transacción (compras y reembolsos)
    gateway      VARCHAR(20),
    external_id  VARCHAR(120),

    granted_by   BIGINT,          -- admin que otorgó, en regalos y ajustes
    note         TEXT
);

-- Idempotencia: un mismo pago no se acredita dos veces aunque la pasarela reintente
CREATE UNIQUE INDEX IF NOT EXISTS idx_tts_credit_ledger_external
ON tts_credit_ledger(gateway, external_id)
WHERE external_id IS NOT NULL;

-- Historial del dashboard
CREATE INDEX IF NOT EXISTS idx_tts_credit_ledger_user_date
ON tts_credit_ledger(user_id, created_at DESC);

-- Consumo por feature para las estadísticas
CREATE INDEX IF NOT EXISTS idx_tts_credit_ledger_feature
ON tts_credit_ledger(feature, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migración del consumo actual de speak_chat_usage
-- Crea el saldo del mes en curso reflejando lo ya consumido.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tts_credit_balances (user_id, monthly_period, monthly_granted, monthly_used, purchased_balance)
SELECT
    u.user_id,
    DATE_TRUNC('month', NOW())::date,
    0,                    -- lo recalcula el servicio en el primer uso
    u.chars_used,         -- 1 carácter standard = 1 crédito
    0
FROM speak_chat_usage u
WHERE u.year  = EXTRACT(YEAR  FROM NOW())::int
  AND u.month = EXTRACT(MONTH FROM NOW())::int
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO tts_credit_ledger (user_id, type, credits, bucket, feature, engine, chars, note)
SELECT
    u.user_id,
    'adjust',
    -u.chars_used,
    'monthly',
    'speak_chat',
    'standard',
    u.chars_used,
    'Migración desde speak_chat_usage'
FROM speak_chat_usage u
WHERE u.year  = EXTRACT(YEAR  FROM NOW())::int
  AND u.month = EXTRACT(MONTH FROM NOW())::int
  AND u.chars_used > 0;

COMMENT ON TABLE tts_credit_balances IS 'Saldo de créditos TTS por canal. 1 crédito = 1 carácter de voz standard.';
COMMENT ON TABLE tts_credit_ledger  IS 'Libro mayor append-only de movimientos de créditos TTS.';
