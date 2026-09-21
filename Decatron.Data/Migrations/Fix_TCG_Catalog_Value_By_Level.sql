-- ============================================
-- TCG — VALOR DE CATÁLOGO SEGÚN NIVEL (plan sección 6.5)
-- ============================================
-- El valor de catálogo tenía que subir al confirmar un nivel (valor base por rareza +
-- el costo que se pagó por ese nivel), pero PayUpgradeAsync nunca lo actualizaba: las
-- cartas gradeadas se quedaban con el valor de nivel 0. Esto corrige las que ya
-- existían; de acá en adelante lo hace el código al pagar.
--
-- La fórmula sale igual que en TcgCardsService:
--   valor base   = multiplicador_rareza * 10
--   costo nivel  = costo_por_nivel * multiplicador_rareza
--   valor final  = multiplicador_rareza * (10 + costo_por_nivel)
--
-- Las cartas de claim NO entran: valen 1 para siempre (sección 6.4).

UPDATE player_card_instances i
SET catalog_value = m.multiplicador * (10 + n.costo),
    updated_at    = NOW()
FROM cards c,
     (VALUES ('N',1),('R',2),('SR',4),('SSR',8),('UR',16),('LR',32),('MR',64))
         AS m(rareza, multiplicador),
     (VALUES (1,10),(2,25),(3,60),(4,150),(5,400),(6,1000),(7,2500),(8,6000),(9,15000),(10,40000))
         AS n(nivel, costo)
WHERE c.id = i.card_id
  AND m.rareza = c.rarity
  AND n.nivel = i.level
  AND i.level > 0
  AND i.origin <> 'claimed'
  AND i.status <> 'destroyed';
