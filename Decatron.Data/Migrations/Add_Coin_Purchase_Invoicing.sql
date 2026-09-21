-- ============================================
-- COMPROBANTES ELECTRÓNICOS PARA COMPRAS DE DECACOINS
-- ============================================
-- Comprar DecaCoins es venta de servicio digital igual que comprar un tier, así que
-- necesita boleta/factura ante SUNAT con el mismo criterio: Perú lleva IGV, el
-- comprador del exterior es exportación de servicios (sin IGV).
--
-- Estas columnas son las mismas que ya tiene supporter_payments, y a propósito con
-- los mismos nombres: la regla fiscal es compartida (InvoiceDocumentBuilder), y que
-- las dos tablas hablen igual hace obvio que se están tratando igual.

ALTER TABLE coin_purchases
    -- Datos del comprador congelados AL MOMENTO DE LA COMPRA. No se leen del perfil
    -- al emitir: si alguien cambia su RUC después, el comprobante ya emitido tiene
    -- que seguir reflejando a quién se le vendió ese día.
    ADD COLUMN IF NOT EXISTS customer_name       TEXT,
    ADD COLUMN IF NOT EXISTS customer_email      TEXT,
    ADD COLUMN IF NOT EXISTS customer_country    TEXT,
    ADD COLUMN IF NOT EXISTS customer_doc_type   TEXT,
    ADD COLUMN IF NOT EXISTS customer_doc_number TEXT,
    ADD COLUMN IF NOT EXISTS prefer_factura      BOOLEAN NOT NULL DEFAULT FALSE,

    -- Lo REALMENTE cobrado por la pasarela. amount_paid_usd es el precio de lista en
    -- dólares; Culqi cobra en soles. Al comprobante va esto, no aquello.
    ADD COLUMN IF NOT EXISTS charged_amount      NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS charged_currency    TEXT,

    -- Estado del comprobante. NULL = no corresponde emitir (compras viejas anteriores
    -- a esto, o regalos). 'PENDING' es lo que el background service sale a buscar.
    ADD COLUMN IF NOT EXISTS invoice_status          TEXT,
    ADD COLUMN IF NOT EXISTS invoice_document_id     INTEGER,
    ADD COLUMN IF NOT EXISTS invoice_type            TEXT,
    ADD COLUMN IF NOT EXISTS invoice_series          TEXT,
    ADD COLUMN IF NOT EXISTS invoice_number          INTEGER,
    ADD COLUMN IF NOT EXISTS invoice_error           TEXT,
    ADD COLUMN IF NOT EXISTS invoice_attempts        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS invoice_last_attempt_at TIMESTAMP;

-- El barrido de pendientes filtra por estado e intentos; el índice parcial deja
-- afuera todo lo ya emitido, que es la mayoría absoluta de las filas.
CREATE INDEX IF NOT EXISTS idx_coin_purchases_invoice_pending
    ON coin_purchases (created_at)
    WHERE invoice_status = 'PENDING';
