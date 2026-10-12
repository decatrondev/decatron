-- Modo de pruebas de la traducción en vivo: registra en el log del servidor el texto y los tiempos de cada frase. 2026-10-12
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
ALTER TABLE live_translation_settings ADD COLUMN IF NOT EXISTS record_phrases BOOLEAN NOT NULL DEFAULT FALSE;
