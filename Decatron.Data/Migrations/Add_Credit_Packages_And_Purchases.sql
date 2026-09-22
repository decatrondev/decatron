-- Créditos unificados, fase 4 (.dev/plans/CREDITOS_UNIFICADOS_PLAN.md):
-- paquetes de créditos a la venta y compras con Culqi, con el mismo esquema de
-- facturación que coin_purchases (CoinInvoiceService emite para las dos tablas).

CREATE TABLE IF NOT EXISTS credit_packages (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT,
    credits      BIGINT NOT NULL,
    bonus_credits BIGINT NOT NULL DEFAULT 0,
    price_usd    NUMERIC(10,2) NOT NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    highlight    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_purchases (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL,
    package_id         BIGINT REFERENCES credit_packages(id),
    credits_received   INT NOT NULL,
    amount_paid_usd    NUMERIC(10,2) NOT NULL,
    charge_id          TEXT,
    charge_status      TEXT,
    charged_amount     NUMERIC(10,2),
    charged_currency   TEXT,
    customer_name      TEXT,
    customer_email     TEXT,
    customer_country   TEXT,
    customer_doc_type  TEXT,
    customer_doc_number TEXT,
    prefer_factura     BOOLEAN NOT NULL DEFAULT FALSE,
    is_test            BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_status     TEXT,
    invoice_document_id INT,
    invoice_type       TEXT,
    invoice_series     TEXT,
    invoice_number     INT,
    invoice_error      TEXT,
    invoice_attempts   INT NOT NULL DEFAULT 0,
    invoice_last_attempt_at TIMESTAMP,
    created_at         TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);
CREATE INDEX IF NOT EXISTS ix_credit_purchases_user ON credit_purchases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_credit_purchases_invoice ON credit_purchases(invoice_status) WHERE invoice_status = 'PENDING';

-- Propuesta inicial (2026-09-22). Costo real ≈ $4 por millón; los planes dan ~$17-33/M,
-- así que los paquetes quedan un poco por encima para no canibalizar el plan.
INSERT INTO credit_packages (name, description, credits, bonus_credits, price_usd, sort_order, highlight)
SELECT * FROM (VALUES
    ('Básico',  '100 mil créditos: ~14 min de voz premium o ~2.500 llamadas del coach', 100000::bigint, 0::bigint, 4.00, 1, FALSE),
    ('Popular', '300 mil créditos: ~45 min de voz premium',                              300000::bigint, 0::bigint, 10.00, 2, TRUE),
    ('Pro',     '1 millón de créditos: ~2,4 h de voz premium',                           1000000::bigint, 0::bigint, 28.00, 3, FALSE)
) AS v(name, description, credits, bonus_credits, price_usd, sort_order, highlight)
WHERE NOT EXISTS (SELECT 1 FROM credit_packages);
