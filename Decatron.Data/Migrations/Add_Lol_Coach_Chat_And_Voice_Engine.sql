-- Coach de LoL: publicar en el chat y voz estándar (Piper) o premium (Deepgram). 2026-09-23
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
ALTER TABLE lol_coach_settings
    ADD COLUMN IF NOT EXISTS chat_kinds VARCHAR(60) NOT NULL DEFAULT 'final,postgame',
    ADD COLUMN IF NOT EXISTS voice_engine VARCHAR(20) NOT NULL DEFAULT 'standard';

-- Quien ya tenía la voz prendida venía oyendo Deepgram: se queda con esa voz en vez de
-- cambiarle a Piper sin avisar. Las filas nuevas nacen en 'standard' (gratis).
UPDATE lol_coach_settings SET voice_engine = 'premium' WHERE voice_enabled AND voice_engine = 'standard';
