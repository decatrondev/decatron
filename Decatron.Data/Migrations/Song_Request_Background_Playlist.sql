-- Song Request, etapa 3 fase 0b (.dev/plans/SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md): "respaldo" y "puesta a sonar"
-- pasan a ser una sola "playlist de fondo" (active_playlist_id). 2026-10-01
-- Quien tenía el respaldo encendido y nada puesto a sonar sigue oyendo lo mismo: su playlist de respaldo pasa a ser la de fondo.
-- is_fallback y settings.FallbackEnabled quedan en la base sin usarse.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
UPDATE song_request_configs c
SET active_playlist_id = p.id, updated_at = NOW()
FROM song_request_playlists p
WHERE p.user_id = c.user_id
  AND p.is_fallback
  AND c.active_playlist_id IS NULL
  AND COALESCE((c.settings::jsonb ->> 'FallbackEnabled')::boolean, false);
