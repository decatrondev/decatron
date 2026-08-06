-- Si el comprador con RUC quiso factura o boleta.
--
-- Tener RUC no obliga a pedir factura: un RUC 10 es persona natural con negocio y muchas
-- veces prefiere una boleta. Como es una decision de cada compra y no del perfil, se
-- guarda con el pago.
--
-- Sin RUC el campo no significa nada: siempre sale boleta.

ALTER TABLE supporter_payments
    ADD COLUMN IF NOT EXISTS prefer_factura BOOLEAN NOT NULL DEFAULT FALSE;
