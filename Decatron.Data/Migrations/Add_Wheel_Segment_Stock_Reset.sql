-- Rueda de la Suerte — Fase 7
--
-- Cuándo se abrió la ventana de stock que está corriendo ahora.
--
-- Las columnas de stock existen desde la Fase 0 (`stock_total`, `stock_remaining`,
-- `stock_per_viewer`, `stock_window`), pero guardaban CUÁNTO queda y no DESDE CUÁNDO.
-- Sin esa fecha, una ventana de "3 por día" no se puede reiniciar —no hay contra qué
-- comparar el día de hoy— y el stock por espectador no se puede contar, porque hay
-- que saber desde qué momento mirar su historial de giros.
--
-- Con `stock_window = 'ever'` queda en null y no se usa: esa ventana no vence nunca.

ALTER TABLE wheel_segments
    ADD COLUMN IF NOT EXISTS stock_reset_at timestamp NULL;

COMMENT ON COLUMN wheel_segments.stock_reset_at IS
    'Cuándo se abrió la ventana de stock vigente. null con stock_window = ''ever''.';
