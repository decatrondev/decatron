-- Solicitud de voz con muestra: la solicitud guarda el nombre y la muestra de la voz elegida en Fish
-- para que el admin la apruebe sin buscarla de nuevo. Idempotente.

ALTER TABLE tts_fish_voice_requests ADD COLUMN IF NOT EXISTS title      VARCHAR(200);
ALTER TABLE tts_fish_voice_requests ADD COLUMN IF NOT EXISTS sample_url TEXT;

-- Reverso:
--   ALTER TABLE tts_fish_voice_requests DROP COLUMN IF EXISTS title, DROP COLUMN IF EXISTS sample_url;
