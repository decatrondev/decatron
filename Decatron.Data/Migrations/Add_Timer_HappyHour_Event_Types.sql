-- Happy Hour: cada streamer elige a qué eventos se aplica el multiplicador.
-- NULL = a todos los eventos (lo que hacía siempre).
ALTER TABLE timer_happyhour ADD COLUMN IF NOT EXISTS event_types jsonb NULL;
ALTER TABLE timer_manual_happyhour ADD COLUMN IF NOT EXISTS event_types jsonb NULL;
