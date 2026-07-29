-- Datos de facturacion electronica en supporter_payments.
--
-- Hasta ahora la tabla guardaba el precio de lista en USD y nada del comprador, que
-- alcanza para llevar la cuenta de cuanto entro pero no para emitir un comprobante:
-- SUNAT va por el importe realmente cobrado y por quien lo pago.
--
-- Culqi cobra en PEN convirtiendo con un tipo de cambio fijo, asi que `amount` (USD)
-- nunca fue lo que paso por la tarjeta. Por eso se separan las dos cifras: `amount`
-- sigue siendo el precio de lista, que es lo que miran los reportes de supporters, y
-- `charged_amount` / `charged_currency` son lo que cobro la pasarela, que es lo unico
-- que puede ir en un comprobante.

ALTER TABLE supporter_payments
    -- Lo que realmente se cobro. Culqi siempre PEN, PayPal siempre USD.
    ADD COLUMN IF NOT EXISTS charged_amount   NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS charged_currency VARCHAR(3),
    -- 'culqi' | 'paypal'. Hoy se deducia del prefijo del id de orden, que es fragil.
    ADD COLUMN IF NOT EXISTS provider         VARCHAR(20),

    -- Comprador. Sin esto no se puede decidir entre boleta, factura y exportacion.
    ADD COLUMN IF NOT EXISTS customer_email      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS customer_name       VARCHAR(200),
    -- ISO-3166 alpha-2. NULL o 'PE' = domiciliado.
    ADD COLUMN IF NOT EXISTS customer_country    VARCHAR(2),
    -- Nombres del catalogo 06 tal como los espera decatronapi: DNI, RUC, CE,
    -- PASAPORTE, SIN_DOC, DOC_PAIS_RESIDENCIA, TIN, IN, CEDULA_DIPLOMATICA.
    ADD COLUMN IF NOT EXISTS customer_doc_type   VARCHAR(30),
    ADD COLUMN IF NOT EXISTS customer_doc_number VARCHAR(20),

    -- Comprobante emitido. NULL en invoice_status = no corresponde emitir
    -- (donaciones, que son liberalidades y no venta de servicio).
    -- PENDING | ACCEPTED | REJECTED | ERROR
    ADD COLUMN IF NOT EXISTS invoice_status          VARCHAR(20),
    -- id del SunatDocument del lado de decatronapi
    ADD COLUMN IF NOT EXISTS invoice_document_id     INTEGER,
    ADD COLUMN IF NOT EXISTS invoice_type            VARCHAR(20),
    ADD COLUMN IF NOT EXISTS invoice_series          VARCHAR(10),
    ADD COLUMN IF NOT EXISTS invoice_number          INTEGER,
    ADD COLUMN IF NOT EXISTS invoice_error           TEXT,
    ADD COLUMN IF NOT EXISTS invoice_attempts        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS invoice_last_attempt_at TIMESTAMP;

-- Para el job que reintenta lo que quedo sin comprobante.
CREATE INDEX IF NOT EXISTS idx_supporter_payments_invoice_status
    ON supporter_payments (invoice_status)
    WHERE invoice_status IS NOT NULL AND invoice_status <> 'ACCEPTED';

-- El id de la pasarela dejo de ser solo de PayPal hace rato; el nombre de la columna
-- se queda como esta para no romper nada, pero al menos que no se repita.
CREATE UNIQUE INDEX IF NOT EXISTS idx_supporter_payments_order
    ON supporter_payments (paypal_order_id)
    WHERE paypal_order_id IS NOT NULL;

-- Backfill de lo que ya estaba: las dos filas historicas son donaciones, que no llevan
-- comprobante, pero igual conviene que la moneda cobrada quede correcta.
UPDATE supporter_payments
SET provider         = CASE WHEN paypal_order_id LIKE 'chr\_%' THEN 'culqi' ELSE 'paypal' END,
    charged_currency = CASE WHEN paypal_order_id LIKE 'chr\_%' THEN 'PEN'   ELSE 'USD'    END,
    charged_amount   = CASE WHEN paypal_order_id LIKE 'chr\_%' THEN ROUND(amount * 3.80, 2) ELSE amount END
WHERE provider IS NULL;
