-- ============================================================
-- RUEDA DE LA SUERTE - varias recompensas de puntos por rueda
-- ============================================================
--
-- El modelo original guardaba UNA fila por (rueda, fuente), asi que una rueda solo
-- podia escuchar una recompensa de puntos de canal. En la practica el streamer crea
-- variantes -- "100 fichas", "500 fichas", "tirada premium" -- y cada una tiene que
-- dar una cantidad distinta de creditos.
--
-- Se cambia la unicidad para que incluya la recompensa. Las otras cuatro fuentes
-- (bits, subs, donaciones, deca coins) siguen siendo una sola fila por rueda porque
-- su reward_id es NULL y COALESCE lo colapsa a la cadena vacia.

ALTER TABLE wheel_wallet_sources
    DROP CONSTRAINT IF EXISTS uq_wheel_wallet_sources;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wheel_wallet_sources
    ON wheel_wallet_sources (wheel_id, source, COALESCE(channel_points_reward_id, ''));

-- Nombre de la recompensa tal como la ve el streamer. Se copia de Twitch al elegirla
-- para poder mostrarla en el panel sin volver a pedir la lista, y para que siga
-- diciendo algo si la recompensa se borra del canal.
ALTER TABLE wheel_wallet_sources
    ADD COLUMN IF NOT EXISTS channel_points_reward_title VARCHAR(150);

-- Una fila de puntos de canal sin recompensa elegida no puede acreditar nada:
-- aceptaria cualquier canje del canal. Se exige la referencia.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wheel_sources_reward') THEN
        ALTER TABLE wheel_wallet_sources
            ADD CONSTRAINT chk_wheel_sources_reward
            CHECK (source <> 'channel_points' OR NOT is_enabled OR channel_points_reward_id IS NOT NULL);
    END IF;
END $$;
