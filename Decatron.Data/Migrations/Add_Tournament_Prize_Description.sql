-- Premios mas flexibles, no solo dinero (merch, skins, suscripciones, trofeo
-- fisico, etc.) — pedido del usuario 24-08-2026.

ALTER TABLE tournament_prize_tiers ADD COLUMN IF NOT EXISTS description TEXT;
