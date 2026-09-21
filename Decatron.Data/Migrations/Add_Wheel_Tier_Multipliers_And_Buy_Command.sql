-- Rueda de la Suerte — pendientes sueltos
--
-- 1) Multiplicador de créditos por tier de sub.
--
-- Un Tier 3 aporta más que un Tier 1 y hasta ahora daba lo mismo. El dato del tier
-- llega SOLO por el payload de EventSub de `channel.subscription.gift`: por el chat
-- no llega — el badge `subscriber` trae los meses de sub, no el tier.
--
-- Van en `wheel_wallet_sources` y no en `wheels` porque son parte de la tasa de
-- conversión de una fuente, igual que el numerador y el denominador. El Tier 1 es la
-- base y siempre vale 1: no tiene columna porque no hay nada que configurar.
--
-- 2) Comando de compra de créditos con deca coins.
--
-- `deca_coins` no es un aporte que llega sino una compra, así que necesita quien la
-- dispare. Lleva su propio comando configurable, como el de girar y el de saldo.

ALTER TABLE wheel_wallet_sources
    ADD COLUMN IF NOT EXISTS tier2_multiplier numeric(5,2) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS tier3_multiplier numeric(5,2) NOT NULL DEFAULT 1;

COMMENT ON COLUMN wheel_wallet_sources.tier2_multiplier IS
    'Multiplica los créditos de un aporte de Tier 2. Solo aplica a gift_sub.';
COMMENT ON COLUMN wheel_wallet_sources.tier3_multiplier IS
    'Multiplica los créditos de un aporte de Tier 3. Solo aplica a gift_sub.';

ALTER TABLE wheels
    ADD COLUMN IF NOT EXISTS buy_command varchar(50) NOT NULL DEFAULT '!dcomprar';

-- El mismo patrón que los otros dos comandos. No se comprueba acá que los tres sean
-- distintos entre sí: eso lo valida el controlador, que es quien puede decirle al
-- streamer cuál repitió en vez de devolverle un error de base.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wheels_buy_command') THEN
        ALTER TABLE wheels
            ADD CONSTRAINT chk_wheels_buy_command CHECK (buy_command ~ '^![a-zA-Z0-9_-]+$');
    END IF;
END $$;

-- 3) Un tipo de transacción propio para la compra de créditos.
--
-- `coin_transactions.type` tiene un CHECK con la lista cerrada de tipos, y la compra
-- de créditos de la Rueda no encajaba en ninguno. Meterla en `marketplace_buy` habría
-- funcionado y habría ensuciado los informes de la economía: dos cosas distintas
-- contadas como la misma. Se agrega el tipo en vez de reciclar uno ajeno.

ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS chk_transaction_type;

ALTER TABLE coin_transactions
    ADD CONSTRAINT chk_transaction_type CHECK (type = ANY (ARRAY[
        'purchase', 'admin_gift', 'admin_remove', 'transfer_in', 'transfer_out',
        'marketplace_buy', 'referral_bonus', 'coupon_bonus', 'gacha_purchase',
        'tcg_sobre_purchase', 'tcg_upgrade_payment',
        'wheel_credits'
    ]));
