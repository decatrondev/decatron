-- Now Playing: estado real de la conexion con Spotify.
-- spotify_authorized_at: cuando autorizo la cuenta; Spotify vence la autorizacion a los 6 meses y no expone la fecha.
--   Las conexiones viejas quedan en NULL (fecha desconocida), no se inventa.
-- spotify_status: ok | reauth (Spotify pide autorizar de nuevo, no se reintenta) | forbidden (Spotify rechaza la cuenta).
ALTER TABLE now_playing_configs ADD COLUMN IF NOT EXISTS spotify_authorized_at timestamptz NULL;
ALTER TABLE now_playing_configs ADD COLUMN IF NOT EXISTS spotify_status varchar(20) NOT NULL DEFAULT 'ok';
