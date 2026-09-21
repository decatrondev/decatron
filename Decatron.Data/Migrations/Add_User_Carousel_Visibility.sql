-- Carrusel de canales en la landing (decatron.net): permite ocultar canales
-- puntuales del carrusel público sin desactivar la cuenta (IsActive).
-- 2026-08-26

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_hidden_from_carousel boolean NOT NULL DEFAULT false;
