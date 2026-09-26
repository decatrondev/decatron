-- Now Playing (fase 4): fecha en que se pidió el cupo de Spotify. Ordena la lista de espera
-- dentro de cada tier. A los pedidos que ya existían se les pone la fecha de esta migración.
ALTER TABLE now_playing_configs ADD COLUMN IF NOT EXISTS spotify_slot_requested_at timestamptz NULL;

UPDATE now_playing_configs
SET spotify_slot_requested_at = NOW()
WHERE spotify_slot_requested = true AND spotify_slot_requested_at IS NULL;
