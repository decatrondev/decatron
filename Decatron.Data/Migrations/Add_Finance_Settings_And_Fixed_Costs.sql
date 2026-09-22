-- Finanzas fase 1 (.dev/plans/FINANZAS_PLAN.md): parámetros del P&L y costos fijos.

CREATE TABLE IF NOT EXISTS finance_settings (
    id                   INT PRIMARY KEY DEFAULT 1,
    -- Comisión de la pasarela por transacción. Culqi Perú: 3.99 % + S/ 0.30, más IGV sobre la comisión.
    gateway_percent      NUMERIC(6,3) NOT NULL DEFAULT 3.990,
    gateway_fixed_pen    NUMERIC(10,2) NOT NULL DEFAULT 0.30,
    gateway_fee_has_igv  BOOLEAN NOT NULL DEFAULT TRUE,
    igv_percent          NUMERIC(6,3) NOT NULL DEFAULT 18.000,
    pen_per_usd          NUMERIC(10,4) NOT NULL DEFAULT 3.8000,
    primary_currency     TEXT NOT NULL DEFAULT 'PEN',
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT finance_settings_single_row CHECK (id = 1)
);
INSERT INTO finance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Costos fijos del dueño (servidor, dominios, suscripciones). No salen de ninguna tabla
-- del bot: se cargan a mano desde el admin y se normalizan a mensual para el P&L.
CREATE TABLE IF NOT EXISTS fixed_costs (
    id          BIGSERIAL PRIMARY KEY,
    concept     TEXT NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'USD',
    -- monthly | yearly | one_time
    periodicity TEXT NOT NULL DEFAULT 'monthly',
    starts_on   DATE NOT NULL DEFAULT CURRENT_DATE,
    ends_on     DATE,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_fixed_costs_range ON fixed_costs(starts_on, ends_on);
