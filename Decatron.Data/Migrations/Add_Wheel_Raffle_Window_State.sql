-- ============================================================
-- Rueda de la Suerte — Fase 4 (modo Sorteo)
-- Estado de la ventana de inscripcion.
-- ============================================================
-- wheel_raffle_configs guardaba COMO se abre la ventana (manual / temporizada /
-- siempre abierta) pero no SI esta abierta ahora mismo. Sin eso el comando de
-- inscripcion no tiene contra que decidir: o acepta siempre, o no acepta nunca.
--
-- Las tres columnas son estado vivo, no configuracion:
--   is_open           lo que decide el modo 'manual' (lo prende y apaga el streamer)
--   window_opened_at  cuando se abrio la ventana actual
--   window_closes_at  cuando se cierra sola, solo en modo 'timed'
--
-- El modo 'always_open' ignora las tres: si esta configurado asi, esta abierta.

ALTER TABLE wheel_raffle_configs
    ADD COLUMN IF NOT EXISTS is_open          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS window_opened_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS window_closes_at TIMESTAMP;

COMMENT ON COLUMN wheel_raffle_configs.is_open IS
    'Estado vivo de la ventana en modo manual. No aplica a always_open.';
COMMENT ON COLUMN wheel_raffle_configs.window_closes_at IS
    'Cuando se cierra sola la ventana en modo timed. NULL en los otros modos.';

-- El sorteo tambien necesita saber quien gano y cuando, para que el panel pueda
-- mostrar el historial sin recorrer wheel_spins entero.
ALTER TABLE wheel_raffle_entries
    ADD COLUMN IF NOT EXISTS won_at TIMESTAMP;

COMMENT ON COLUMN wheel_raffle_entries.won_at IS
    'Cuando gano. Va junto a has_won: sin fecha, dos ganadores del mismo pool son indistinguibles.';
