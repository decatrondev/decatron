-- ============================================================
-- RUEDA DE LA SUERTE - Fase 2
-- Disparadores del giro y topes anti-farmeo.
-- Ver .dev/plans/RUEDA_DE_LA_SUERTE_PLAN.md, secciones 6.2 y "Fase 2".
-- ============================================================
--
-- La seccion 5 del plan definio el modelo de datos pero no estas columnas: los
-- disparadores y los limites aparecen recien en 6.2, y sin ellos la Fase 2 no se
-- puede construir. Van en `wheels` y no en visual_config porque son reglas de
-- funcionamiento, no aspecto.

ALTER TABLE wheels
    -- Comando de chat para girar. Configurable y validado contra los reservados.
    ADD COLUMN IF NOT EXISTS spin_command          VARCHAR(30) NOT NULL DEFAULT '!dgirar',
    -- Comando para consultar el saldo de la billetera.
    ADD COLUMN IF NOT EXISTS balance_command       VARCHAR(30) NOT NULL DEFAULT '!dcreditos',
    -- El streamer puede apagar los comandos del todo y girar solo desde el panel.
    ADD COLUMN IF NOT EXISTS command_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Auto-girar: apenas el saldo alcanza el precio, la rueda gira sola.
    ADD COLUMN IF NOT EXISTS auto_spin             BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Anti-farmeo. NULL o 0 = sin tope.
    ADD COLUMN IF NOT EXISTS spin_cooldown_seconds INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_spins_per_stream  INTEGER,
    -- Techo de coins que la rueda puede repartir por hora. Es el freno que evita
    -- que una mala config de pesos vacie la economia del canal en una tarde.
    ADD COLUMN IF NOT EXISTS max_coins_per_hour    INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wheels_spin_command') THEN
        ALTER TABLE wheels
            ADD CONSTRAINT chk_wheels_spin_command    CHECK (spin_command    ~ '^![a-zA-Z0-9_-]+$'),
            ADD CONSTRAINT chk_wheels_balance_command CHECK (balance_command ~ '^![a-zA-Z0-9_-]+$'),
            ADD CONSTRAINT chk_wheels_cooldown        CHECK (spin_cooldown_seconds >= 0),
            ADD CONSTRAINT chk_wheels_max_spins       CHECK (max_spins_per_stream IS NULL OR max_spins_per_stream > 0),
            ADD CONSTRAINT chk_wheels_max_coins       CHECK (max_coins_per_hour   IS NULL OR max_coins_per_hour   > 0),
            -- Los dos comandos de una misma rueda no pueden ser el mismo.
            ADD CONSTRAINT chk_wheels_commands_differ CHECK (spin_command <> balance_command);
    END IF;
END $$;

ALTER TABLE wheel_wallets
    -- Giros gastados en el stream actual. Se pone en cero con stream.online, que es
    -- el unico momento en que "por stream" significa algo verificable; contar por
    -- ventanas de tiempo daria topes distintos segun la hora a la que se prenda.
    ADD COLUMN IF NOT EXISTS spins_this_stream INTEGER NOT NULL DEFAULT 0,
    -- Para el cooldown entre giros del mismo espectador.
    ADD COLUMN IF NOT EXISTS last_spin_at      TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wheel_wallets_spins_stream') THEN
        ALTER TABLE wheel_wallets
            ADD CONSTRAINT chk_wheel_wallets_spins_stream CHECK (spins_this_stream >= 0);
    END IF;
END $$;

-- Los giros de la ultima hora, para el techo de coins. Sin este indice el chequeo
-- recorre todo el historial de la rueda en cada giro.
CREATE INDEX IF NOT EXISTS idx_wheel_spins_recent ON wheel_spins (wheel_id, created_at DESC);
