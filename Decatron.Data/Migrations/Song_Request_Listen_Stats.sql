-- Song Request, etapa 3 fase 4 (.dev/plans/SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md): estadísticas anónimas de quien escucha
-- las playlists en /sr/{canal}/p/{código}. 2026-10-03
-- Anónimo: el navegador tiene un id aleatorio propio; no se guarda IP, cuenta ni nada que identifique a la persona.
-- No hay eventos crudos: cada evento suma directo a los totales por día (días en UTC).
-- Lo único que se borra con el tiempo es song_request_listen_visitors (a los 100 días); los totales ocupan poco y se conservan.
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
BEGIN;

-- Totales por playlist y día
CREATE TABLE IF NOT EXISTS song_request_listen_daily (
    playlist_id  BIGINT NOT NULL REFERENCES song_request_playlists(id) ON DELETE CASCADE,
    day          DATE   NOT NULL,
    listens      INT    NOT NULL DEFAULT 0,   -- canciones reproducidas al menos 30 s
    seconds      BIGINT NOT NULL DEFAULT 0,   -- tiempo escuchado
    web_requests INT    NOT NULL DEFAULT 0,   -- "Pedir al stream" desde la web
    PRIMARY KEY (playlist_id, day)
);

-- Quién escuchó cada día (id aleatorio del navegador): da los oyentes únicos de cualquier rango
CREATE TABLE IF NOT EXISTS song_request_listen_visitors (
    playlist_id BIGINT      NOT NULL REFERENCES song_request_playlists(id) ON DELETE CASCADE,
    day         DATE        NOT NULL,
    visitor_id  VARCHAR(36) NOT NULL,
    PRIMARY KEY (playlist_id, day, visitor_id)
);
CREATE INDEX IF NOT EXISTS idx_song_request_listen_visitors_day ON song_request_listen_visitors(day);

-- Escuchas por canción y día (las más escuchadas)
CREATE TABLE IF NOT EXISTS song_request_listen_tracks (
    playlist_id BIGINT NOT NULL REFERENCES song_request_playlists(id) ON DELETE CASCADE,
    track_id    BIGINT NOT NULL,
    day         DATE   NOT NULL,
    listens     INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (playlist_id, track_id, day)
);

-- Canciones que YouTube no deja reproducir fuera de su sitio (avisan los navegadores de los oyentes)
CREATE TABLE IF NOT EXISTS song_request_listen_unplayable (
    playlist_id   BIGINT      NOT NULL REFERENCES song_request_playlists(id) ON DELETE CASCADE,
    track_id      BIGINT      NOT NULL,
    reports       INT         NOT NULL DEFAULT 1,
    first_reported TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reported  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (playlist_id, track_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON song_request_listen_daily, song_request_listen_visitors,
    song_request_listen_tracks, song_request_listen_unplayable TO decatron_user;

COMMIT;
