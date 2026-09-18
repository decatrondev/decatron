-- Happy Hour manual (el que el streamer activa desde el panel con un multiplicador y
-- una duracion).
--
-- Hasta ahora vivia en un ConcurrentDictionary estatico dentro del proceso: cada
-- reinicio del backend lo borraba sin avisar y sin dejar rastro, en medio del stream.
-- Como en produccion NO hay ni un happy hour programado, el 100% del uso real pasaba
-- por esa via volatil.
--
-- Una fila por canal como maximo: activar de nuevo pisa la anterior (UPSERT por
-- channel_name). Las filas vencidas se limpian solas desde el watcher.

CREATE TABLE IF NOT EXISTS timer_manual_happyhour (
    id           SERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Login del canal en minusculas. Es por donde se busca en caliente durante los
    -- eventos, por eso es UNIQUE y no el user_id.
    channel_name VARCHAR(100) NOT NULL UNIQUE,

    multiplier   DOUBLE PRECISION NOT NULL DEFAULT 2.0,

    -- Se escribe con la convencion del resto del proyecto (TimerDateTimeHelper.NowForDb,
    -- o sea hora de Lima) y se compara en memoria tras normalizar a UTC, nunca en SQL.
    expires_at   TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timer_manual_happyhour_expires
    ON timer_manual_happyhour (expires_at);
