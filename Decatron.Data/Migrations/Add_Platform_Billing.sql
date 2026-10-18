-- Fase 7.1: libro de pagos, perfil de facturacion y siembra de precios (FASE7_DISENO.md §3, FASE5_DISENO.md §7). Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 1_cobro.sql     Reverso: 1r_reverso.sql
-- Precio de lista en USD con IGV incluido. price_usd = TOTAL del periodo = mensual x meses x (1 - descuento). Descuentos: 3m 5%, 6m 10%, 9m 15%, 12m 20%.
-- Exclusivo (precio a medida) y sandbox/internal no se siembran.
BEGIN;

CREATE TABLE IF NOT EXISTS tenant_payments (
  id                 bigserial     PRIMARY KEY,
  tenant_id          bigint        NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id),
  purpose            varchar(12)   NOT NULL CHECK (purpose IN ('plan','addon','renewal')),
  plan_id            bigint        REFERENCES plans(id),
  capability_key     varchar(80),
  period_months      smallint      NOT NULL CHECK (period_months IN (1,3,6,9,12)),
  provider           varchar(16)   NOT NULL CHECK (provider IN ('culqi','paypal','mercadopago','manual')),
  provider_charge_id varchar(120),
  amount_usd         numeric(10,2) NOT NULL CHECK (amount_usd >= 0),          -- con IGV incluido
  pen_per_usd        numeric(10,4),
  amount_pen         numeric(12,2),
  tax_treatment      varchar(12)   NOT NULL DEFAULT 'igv' CHECK (tax_treatment IN ('igv','export')),
  status             varchar(10)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  is_test            boolean       NOT NULL DEFAULT false,
  invoice_id         varchar(60),
  created_at         timestamptz   NOT NULL DEFAULT now(),
  paid_at            timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_payments_charge ON tenant_payments (provider, provider_charge_id) WHERE provider_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tenant_payments_tenant ON tenant_payments (tenant_id, created_at DESC);
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_payments;
CREATE POLICY tenant_isolation ON tenant_payments USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));
-- Libro contable: se inserta y se actualiza el estado, nunca se borra.
GRANT SELECT, INSERT, UPDATE ON tenant_payments TO decatron_app;
GRANT USAGE, SELECT ON SEQUENCE tenant_payments_id_seq TO decatron_app;

CREATE TABLE IF NOT EXISTS tenant_billing_profile (
  tenant_id        bigint       PRIMARY KEY DEFAULT app_tenant_id() REFERENCES tenants(id),
  legal_name       varchar(200),
  country          varchar(2),
  doc_type         varchar(12),
  doc_number       varchar(30),
  billing_email    varchar(254),
  pay_mode         varchar(6)   NOT NULL DEFAULT 'manual' CHECK (pay_mode IN ('manual','auto')),
  culqi_customer_id varchar(80),                                              -- solo ids de Culqi; nunca el numero de tarjeta
  culqi_card_id    varchar(80),
  auto_enabled_at  timestamptz,
  updated_at       timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE tenant_billing_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_billing_profile;
CREATE POLICY tenant_isolation ON tenant_billing_profile USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_billing_profile TO decatron_app;

-- Precios de planes (USD por mes de lista).
WITH base(plan_key, monthly) AS (VALUES ('semilla',9),('creator',19),('pro',39),('studio',79)),
     per(months, disc) AS (VALUES (1,0.00),(3,0.05),(6,0.10),(9,0.15),(12,0.20))
INSERT INTO plan_prices (plan_id, period_months, price_usd, active)
SELECT p.id, per.months, round(base.monthly * per.months * (1 - per.disc), 2), true
FROM base JOIN plans p ON p.key = base.plan_key CROSS JOIN per
ON CONFLICT (plan_id, period_months) DO UPDATE SET price_usd = EXCLUDED.price_usd, active = true;

-- Precios de modulos sueltos y de la API /v1 (USD por mes).
WITH base(cap, monthly) AS (VALUES
  ('module.song_request',4),('module.overlays',3),('module.clips',3),('module.giveaways',2),('module.roulette',2),
  ('module.live_translation',8),('module.tts',6),('module.tournaments',5),('module.discord',4),('module.spirits',3),('module.multiview',3),('module.pets',2),
  ('module.lol_coach',12),('module.game_overlays',6),('feature.api_v1',8)),
     per(months, disc) AS (VALUES (1,0.00),(3,0.05),(6,0.10),(9,0.15),(12,0.20))
INSERT INTO addon_prices (capability_key, period_months, price_usd, active)
SELECT base.cap, per.months, round(base.monthly * per.months * (1 - per.disc), 2), true
FROM base CROSS JOIN per
ON CONFLICT (capability_key, period_months) DO UPDATE SET price_usd = EXCLUDED.price_usd, active = true;

COMMIT;
