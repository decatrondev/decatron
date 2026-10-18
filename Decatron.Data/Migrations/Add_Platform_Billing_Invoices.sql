-- Fase 7.6: comprobantes de los pagos de plan y lectura global del libro para /admin/finance. Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 4_comprobantes.sql     Reverso: 4r_reverso.sql
BEGIN;
ALTER TABLE tenant_payments DROP COLUMN IF EXISTS invoice_id;   -- no se usaba; reemplazada por las columnas de abajo
ALTER TABLE tenant_payments
  ADD COLUMN IF NOT EXISTS customer_name        varchar(200),   -- datos del comprobante congelados con el pago (como en las compras de creditos)
  ADD COLUMN IF NOT EXISTS customer_doc_type    varchar(12),
  ADD COLUMN IF NOT EXISTS customer_doc_number  varchar(30),
  ADD COLUMN IF NOT EXISTS customer_email       varchar(254),
  ADD COLUMN IF NOT EXISTS prefer_factura       boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_status       varchar(12),    -- NULL = no se factura (prueba o sin importe); PENDING/ACCEPTED/ERROR/...
  ADD COLUMN IF NOT EXISTS invoice_document_id  integer,
  ADD COLUMN IF NOT EXISTS invoice_type         varchar(12),
  ADD COLUMN IF NOT EXISTS invoice_series       varchar(8),
  ADD COLUMN IF NOT EXISTS invoice_number       integer,
  ADD COLUMN IF NOT EXISTS invoice_error        text,
  ADD COLUMN IF NOT EXISTS invoice_attempts     integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_last_attempt_at timestamptz;

-- Lectura de TODOS los tenants para el P&L del dueno de la plataforma. tenant_payments tiene RLS y el admin corre como tenant 1, asi que una funcion
-- SECURITY DEFINER (dueno: superusuario, que no esta sujeto a RLS) es el unico punto que cruza tenants. Solo pagos confirmados y reales.
CREATE OR REPLACE FUNCTION platform_payments_all(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (id bigint, tenant_id bigint, slug text, plan_key text, period_months smallint, provider varchar, provider_charge_id varchar,
               amount_usd numeric, amount_pen numeric, paid_at timestamptz, invoice_status varchar, invoice_type varchar, invoice_series varchar,
               invoice_number integer, invoice_document_id integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.tenant_id, t.slug::text, pl.key::text, p.period_months, p.provider, p.provider_charge_id, p.amount_usd, p.amount_pen, p.paid_at,
         p.invoice_status, p.invoice_type, p.invoice_series, p.invoice_number, p.invoice_document_id
  FROM tenant_payments p JOIN tenants t ON t.id = p.tenant_id LEFT JOIN plans pl ON pl.id = p.plan_id
  WHERE p.status = 'paid' AND NOT p.is_test AND p.paid_at >= p_from AND p.paid_at < p_to
$$;
REVOKE ALL ON FUNCTION platform_payments_all(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_payments_all(timestamptz, timestamptz) TO decatron_app;
COMMIT;
