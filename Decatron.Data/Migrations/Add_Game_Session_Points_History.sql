-- Grafico de LP de la sesion (Game Overlays, fase "LoL enriquecido"). 2026-09-19
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
ALTER TABLE game_session_snapshots ADD COLUMN IF NOT EXISTS points_history_json JSONB NOT NULL DEFAULT '[]'::jsonb;
