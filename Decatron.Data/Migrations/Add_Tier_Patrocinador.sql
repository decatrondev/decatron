-- Rango nuevo «patrocinador» (entre premium y fundador). Idempotente.
-- Fundador pasa a ser solo por invitación (se asigna a mano); el rango público de 25 USD/mes y 100 USD
-- permanente es Patrocinador. Los créditos del permanente (bono único) los acredita TtsCreditService.

ALTER TABLE user_subscription_tiers DROP CONSTRAINT IF EXISTS chk_valid_tier;
ALTER TABLE user_subscription_tiers ADD CONSTRAINT chk_valid_tier
    CHECK (tier IN ('free','supporter','premium','patrocinador','fundador','admin'));

-- Reverso (solo si ningún usuario tiene 'patrocinador'):
--   ALTER TABLE user_subscription_tiers DROP CONSTRAINT chk_valid_tier;
--   ALTER TABLE user_subscription_tiers ADD CONSTRAINT chk_valid_tier
--       CHECK (tier IN ('free','supporter','premium','fundador','admin'));
