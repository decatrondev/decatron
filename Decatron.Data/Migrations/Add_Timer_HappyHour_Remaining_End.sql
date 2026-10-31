-- Happy Hour por tiempo restante: cómo termina y estado guardado.
-- end_mode: 'above' (se apaga al subir sobre el umbral; lo de siempre), 'rise_to' (se mantiene hasta que el tiempo restante
-- suba a end_after_seconds), 'fall_to' (se apaga al bajar a end_after_seconds), 'duration' (dura duration_seconds de timer).
-- latched_elapsed_seconds: estado de las opciones con memoria (rise_to y duration). NULL = esperando el umbral;
-- >= 0 = activa desde ese tiempo transcurrido del timer; -1 = ya cumplió su duración (se rearma al subir sobre el umbral).
ALTER TABLE timer_happyhour ADD COLUMN IF NOT EXISTS end_mode varchar(16) NOT NULL DEFAULT 'above';
ALTER TABLE timer_happyhour ADD COLUMN IF NOT EXISTS latched_elapsed_seconds bigint NULL;
