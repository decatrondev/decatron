-- Suma los tipos de gasto del TCG (sobres, upgrades) al CHECK de coin_transactions.type.
--
-- OJO: el constraint en produccion ya tenia 'gacha_purchase' ademas de los 8 tipos
-- originales de Add_DecaCoins_Economy.sql - alguien lo agrego directo en la base sin
-- dejar migracion en el repo. Esta migracion reconstruye el constraint reflejando lo
-- que realmente hay en produccion (los 9 valores existentes) mas los 2 nuevos, para
-- que el repo deje de estar desincronizado de la base real.

ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS chk_transaction_type;

ALTER TABLE coin_transactions ADD CONSTRAINT chk_transaction_type CHECK (type IN (
    'purchase', 'admin_gift', 'admin_remove',
    'transfer_in', 'transfer_out',
    'marketplace_buy', 'referral_bonus', 'coupon_bonus',
    'gacha_purchase',
    -- Nuevos para el TCG de cards coleccionables (.dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md)
    'tcg_sobre_purchase', 'tcg_upgrade_payment'
));
