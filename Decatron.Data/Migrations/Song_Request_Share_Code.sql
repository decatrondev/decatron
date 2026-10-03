-- Song Request, etapa 3 fase 1 (.dev/plans/SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md): código de enlace por playlist
-- para "solo con enlace" (visibility = 'unlisted') y /sr/{canal}/p/{código}. 2026-10-02
-- Los ids son números seguidos: con ellos cualquiera adivinaría una playlist que no está en ninguna lista.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
BEGIN;
ALTER TABLE song_request_playlists ADD COLUMN IF NOT EXISTS share_code varchar(16);

-- 10 caracteres del alfabeto sin i, l, o, 0, 1 (el mismo que genera el backend)
UPDATE song_request_playlists p
SET share_code = (
    SELECT string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
    FROM generate_series(1, 10) WHERE p.id IS NOT NULL
)
WHERE share_code IS NULL;

ALTER TABLE song_request_playlists ALTER COLUMN share_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_song_request_playlists_share_code ON song_request_playlists (share_code);
COMMIT;
