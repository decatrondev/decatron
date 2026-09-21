-- ============================================================
-- Rueda de la Suerte — ajustar canales por encima del tope de su tier
-- ============================================================
-- El tope por tier (seccion 11 del plan: free=2, supporter=5, premium=15,
-- fundador/admin sin tope) se agrego el 2026-09-04, despues de que ya hubiera
-- ruedas creadas. Los canales que quedaron por encima siguen funcionando porque
-- el tope solo bloquea CREAR y ENCENDER; este script alinea los que ya estaban.
--
-- Criterio de cual se queda encendida, en este orden:
--   1. las marcadas como activa (is_active)
--   2. las que tienen historial de giros — apagar una rueda que la gente ya uso
--      es mucho peor que apagar una vacia
--   3. las mas viejas
--
-- NO borra nada: apaga (is_enabled = false). El streamer puede encender la que
-- prefiera apagando otra, y si sube de tier las vuelve a prender.

WITH ranking AS (
    SELECT w.id,
           ROW_NUMBER() OVER (
               PARTITION BY w.channel_id
               ORDER BY w.is_active DESC,
                        (SELECT COUNT(*) FROM wheel_spins s WHERE s.wheel_id = w.id) DESC,
                        w.id ASC
           ) AS puesto,
           COALESCE(
               (SELECT t.tier
                FROM user_subscription_tiers t
                WHERE t.user_id = w.channel_id
                  AND (t.tier_expires_at IS NULL OR t.tier_expires_at > NOW())
                ORDER BY t.tier_started_at DESC
                LIMIT 1),
               'free'
           ) AS tier,
           EXISTS (SELECT 1 FROM system_admins sa WHERE sa.user_id = w.channel_id) AS es_admin
    FROM wheels w
    WHERE w.is_enabled
)
UPDATE wheels
SET is_enabled = FALSE,
    updated_at = NOW()
FROM ranking r
WHERE wheels.id = r.id
  AND NOT r.es_admin
  AND r.tier <> 'fundador'
  AND r.puesto > CASE r.tier
                     WHEN 'supporter' THEN 5
                     WHEN 'premium'   THEN 15
                     ELSE 2                     -- free y cualquier valor inesperado
                 END;
