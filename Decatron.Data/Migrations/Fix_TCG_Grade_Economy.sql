-- ============================================
-- TCG — ECONOMÍA DEL GRADEO REDEFINIDA (2026-08-11)
-- ============================================
-- Antes: valor = base + costo pagado, y costo = tabla_por_nivel x multiplicador_rareza.
-- Eso hacía que (a) el valor fuera el costo con otro nombre, y (b) un MR grado 10
-- costara 2.560.000 coins, o sea impagable: la carta se autodestruía por no poder
-- confirmarse.
--
-- Ahora las dos cosas salen del valor base (rareza x10) por curvas separadas:
--   valor = base x multiplicador_de_grado   (1.5, 2, 3, 4, 6, 9, 14, 22, 40, 100)
--   costo = base x factor_de_grado          (0.75, 1, 1.25, 1.5, 2, 2.5, 3.5, 4.5, 6.5, 12.5)
--
-- El valor ya no incluye lo pagado, así que un ranking de colección deja de ser un
-- ranking de gasto. Las cartas de claim siguen valiendo 1 (plan sección 6.4).

-- 1) Valor de catálogo de las cartas ya gradeadas.
UPDATE player_card_instances i
SET catalog_value = ROUND(m.base * g.valor),
    updated_at    = NOW()
FROM cards c,
     (VALUES ('N',10),('R',20),('SR',40),('SSR',80),('UR',160),('LR',320),('MR',640))
         AS m(rareza, base),
     (VALUES (1,1.5),(2,2),(3,3),(4,4),(5,6),(6,9),(7,14),(8,22),(9,40),(10,100))
         AS g(grado, valor)
WHERE c.id = i.card_id
  AND m.rareza = c.rarity
  AND g.grado = i.level
  AND i.level > 0
  AND i.origin <> 'claimed'
  AND i.status <> 'destroyed';

-- 2) Costo pendiente de las que están esperando pago con la tarifa vieja. Sin esto,
--    a alguien que ya recibió su grado se le seguiría cobrando el precio anterior.
UPDATE player_card_instances i
SET payment_amount_due = ROUND(m.base * g.factor),
    updated_at         = NOW()
FROM cards c,
     (VALUES ('N',10),('R',20),('SR',40),('SSR',80),('UR',160),('LR',320),('MR',640))
         AS m(rareza, base),
     (VALUES (1,0.75),(2,1),(3,1.25),(4,1.5),(5,2),(6,2.5),(7,3.5),(8,4.5),(9,6.5),(10,12.5))
         AS g(grado, factor)
WHERE c.id = i.card_id
  AND m.rareza = c.rarity
  AND g.grado = i.pending_target_level
  AND i.status IN ('frozen_pending_payment', 'grading_in_progress')
  AND i.payment_amount_due IS NOT NULL;
