-- Migración: Segunda bolsa de créditos — voz estándar (Piper, auto-alojada)
-- Fecha: 2026-07-27
-- Descripción: Piper corre en el propio servidor, así que su coste real es CPU y no
--              caracteres. Se le lleva cuenta igual que a Polly para poder frenar
--              abusos y enseñar una cifra honesta en el panel, pero con una cuota
--              muy holgada y en una bolsa aparte: si compartieran contador, el gasto
--              en voz estándar se comería los créditos premium que el streamer pagó.
--              Una bolsa mensual que se reinicia el día 1 y una comprada que no caduca.

ALTER TABLE tts_credit_balances
    ADD COLUMN IF NOT EXISTS standard_granted BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS standard_used    BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN tts_credit_balances.standard_granted IS
    'Cuota mensual de voz estándar (Piper). Se reinicia el día 1 junto a la premium.';
COMMENT ON COLUMN tts_credit_balances.standard_used IS
    'Caracteres de voz estándar consumidos en el periodo vigente.';

-- El libro mayor gana dos valores de bucket: standard y standard_granted.
-- La columna ya es VARCHAR(10) y se queda corta para 'standard_granted'.
ALTER TABLE tts_credit_ledger
    ALTER COLUMN bucket TYPE VARCHAR(20);

COMMENT ON COLUMN tts_credit_ledger.bucket IS
    'monthly · purchased · standard · none. Las tres primeras son bolsas reales.';

-- Nadie arranca el mes con la cuota estándar puesta: la asigna el servicio en el
-- primer uso, igual que hace con la premium. Dejar 0 aquí es lo correcto.
