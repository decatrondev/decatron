-- ============================================
-- TCG — MIGRACIÓN AL GRADEO INSTANTÁNEO (2026-08-11)
-- ============================================
-- El flujo viejo revelaba el resultado recién a las 24h de "gradeo". El nuevo lo
-- resuelve al instante del 1 al 9, y solo el 10 espera (a que se suba su ilustración,
-- no al reloj). Eso deja sin dueño a las cartas que quedaron a mitad del flujo viejo:
-- ya no existe el código que las resolvía por tiempo, así que se quedarían en
-- 'grading_in_progress' para siempre.

-- 1) Grados 1 a 9 que estaban esperando el reveal: ya tenían su resultado decidido,
--    así que pasan directo a esperar pago con la ventana arrancando ahora. No se les
--    descuenta el tiempo que estuvieron trabadas.
UPDATE player_card_instances
SET status              = 'frozen_pending_payment',
    payment_deadline_at = NOW() + INTERVAL '24 hours',
    updated_at          = NOW()
WHERE status = 'grading_in_progress'
  AND pending_target_level BETWEEN 1 AND 9;

-- 2) Las que nunca llegaron a tener un resultado decidido (pending_target_level NULL,
--    del flujo original que tiraba el dado recién al revelar). No hay resultado que
--    aplicar, así que se deshace el intento entero en vez de inventarle uno: la carta
--    vuelve a estar activa y con su upgrade sin usar.
UPDATE player_card_instances
SET status               = 'active',
    upgrade_used         = FALSE,
    attempt_started_at   = NULL,
    pending_target_level = NULL,
    payment_amount_due   = NULL,
    payment_deadline_at  = NULL,
    updated_at           = NOW()
WHERE status = 'grading_in_progress'
  AND pending_target_level IS NULL;

-- 3) Pedidos de arte de los milestones viejos (3/6/9). Ya no existen como niveles con
--    arte propio: del 1 al 9 se usa el arte base dentro de la cápsula PSA. Solo se
--    borran los que nadie llegó a completar — si alguno ya tiene su imagen subida se
--    deja, no se tira trabajo hecho.
DELETE FROM card_level_art
WHERE level <> 10
  AND status <> 'done';
