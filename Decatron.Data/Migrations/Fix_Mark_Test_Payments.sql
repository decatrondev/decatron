-- Finanzas fase 0 (.dev/plans/FINANZAS_PLAN.md): marcar como prueba los pagos que nunca
-- fueron dinero real. El flag is_test se agregó después, así que compras hechas con
-- claves de test de Culqi (chr_test_) y con el sandbox de PayPal quedaron como reales y
-- ensuciaban cualquier cuenta de ingresos. No se borran: conservan el historial.
-- Backup previo en /root/backups-finanzas/.

UPDATE coin_purchases
SET is_test = TRUE
WHERE is_test = FALSE
  AND (paypal_order_id LIKE 'chr_test_%'
       -- PayPal sandbox: las compras de abril 2026 del propio dueño, antes de pasar a Culqi
       OR (paypal_status = 'COMPLETED' AND created_at < '2026-05-01'));

UPDATE supporter_payments
SET is_test = TRUE
WHERE is_test = FALSE
  AND paypal_order_id LIKE 'chr_test_%';
