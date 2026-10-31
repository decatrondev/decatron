-- Happy Hour por progreso del timer: se activa cuando el timer lleva X de tiempo corriendo (sin contar pausas).
-- mode 'schedule' = por horario (lo de siempre; todas las filas existentes quedan asi).
-- Solo lo usan las filas con mode = 'progress'; en ellas start_time/end_time se guardan en 00:00 y no cuentan.
ALTER TABLE timer_happyhour ADD COLUMN IF NOT EXISTS mode varchar(16) NOT NULL DEFAULT 'schedule';
ALTER TABLE timer_happyhour ADD COLUMN IF NOT EXISTS start_after_seconds integer NULL;
ALTER TABLE timer_happyhour ADD COLUMN IF NOT EXISTS end_after_seconds integer NULL;
ALTER TABLE timer_happyhour ADD COLUMN IF NOT EXISTS duration_seconds integer NULL;
ALTER TABLE timer_happyhour ADD COLUMN IF NOT EXISTS repeat_every_seconds integer NULL;
