-- ============================================
-- MODO DE COBRO (live / test) Y COMPRAS DE PRUEBA
-- ============================================
-- Culqi tiene dos juegos de llaves. Hasta ahora había uno solo en configuración, así
-- que probar el checkout obligaba a editar el archivo y reiniciar el bot.
--
-- El modo vive junto a la empresa emisora a propósito: lo que decide si un comprobante
-- se puede emitir NO es ninguno de los dos por separado, sino su combinación.
--
--   test + empresa beta        -> se emite un comprobante de prueba. Correcto.
--   test + empresa producción  -> NO se emite: sería declarar ante SUNAT una venta
--                                 que nunca se cobró.
--   live + empresa producción  -> operación normal.
--   live + empresa beta        -> cobro real sin documento válido. Queda pendiente y
--                                 visible, porque es plata que entró sin declarar.
--
-- Tenerlos en la misma fila hace que esa comprobación sea una sola lectura y que en el
-- panel se vean siempre juntos, que es como hay que mirarlos.

ALTER TABLE invoicing_settings
    ADD COLUMN IF NOT EXISTS culqi_mode TEXT NOT NULL DEFAULT 'live';

ALTER TABLE invoicing_settings
    DROP CONSTRAINT IF EXISTS chk_invoicing_culqi_mode;

ALTER TABLE invoicing_settings
    ADD CONSTRAINT chk_invoicing_culqi_mode CHECK (culqi_mode IN ('live', 'test'));

-- Marca de compra hecha con llaves de prueba. Se acreditan los coins/el tier igual (esa
-- es la gracia de poder probar el flujo completo), pero no son ingresos reales: quedan
-- fuera de los comprobantes y hay que excluirlas de cualquier métrica de facturación.
ALTER TABLE coin_purchases
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE supporter_payments
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

-- Fila por defecto, por si la tabla estuviera vacía: sin esto el modo quedaría indefinido.
--
-- OJO con company_id: esta tabla tiene PRIORIDAD sobre el valor de appsettings
-- (DecatronApi:CompanyId), así que crear la fila con un id inventado hace que la
-- facturación pase a apuntar a una empresa inexistente aunque antes funcionara por el
-- fallback. Por eso se toma el de configuración en vez de poner un 0.
INSERT INTO invoicing_settings (id, company_id, culqi_mode)
SELECT 1, COALESCE(NULLIF(current_setting('decatron.company_id', true), '')::int, 16), 'live'
WHERE NOT EXISTS (SELECT 1 FROM invoicing_settings WHERE id = 1);
