-- ============================================================
-- Rueda de la Suerte — Fase 3
-- Motivo por el que una entrega quedo pendiente.
-- ============================================================
-- La bandeja ya guardaba QUE premio quedo sin entregar, pero no POR QUE. Con los
-- handlers de Fase 3 los motivos dejan de ser uno solo ("es manual"): el timer
-- estaba detenido, el bot no es moderador, el gachapon no tiene items, el
-- espectador no tiene cuenta. Sin el motivo el streamer ve una lista de premios
-- pendientes y no sabe si tiene que arreglar algo o solo entregarlos a mano.
--
-- 'notes' NO sirve para esto: es el campo del streamer, lo escribe el al resolver.
-- 'reason' lo escribe el bot y es de solo lectura para el panel.

ALTER TABLE wheel_pending_deliveries
    ADD COLUMN IF NOT EXISTS reason VARCHAR(200);

COMMENT ON COLUMN wheel_pending_deliveries.reason IS
    'Por que el bot no pudo entregar el premio. Lo escribe el bot, no el streamer.';
