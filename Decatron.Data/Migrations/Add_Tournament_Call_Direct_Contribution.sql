-- Convocatoria: aporte directo sin esperar aprobacion, union automatica pago-colaborador y custodia del colaborador.
-- Aditiva e idempotente. Aplicar antes de reiniciar el backend.
BEGIN;
ALTER TABLE tournament_call_applications ADD COLUMN IF NOT EXISTS origin varchar(20) NOT NULL DEFAULT 'form';
ALTER TABLE tournament_call_applications DROP CONSTRAINT IF EXISTS ck_call_application_origin;
ALTER TABLE tournament_call_applications ADD CONSTRAINT ck_call_application_origin CHECK (origin IN ('form','payment'));
ALTER TABLE tournament_call_applications ADD COLUMN IF NOT EXISTS custody_accepted_at timestamptz;
ALTER TABLE tournament_call_applications ADD COLUMN IF NOT EXISTS custody_notice_version varchar(64) NOT NULL DEFAULT '';
ALTER TABLE tournament_call_applications ADD COLUMN IF NOT EXISTS public_offer boolean NOT NULL DEFAULT false;
-- Persona y canal con los que se preparo el pago (solo si habia sesion). Nunca bloquean el borrado de la cuenta.
ALTER TABLE tournament_call_donation_intents ADD COLUMN IF NOT EXISTS user_id bigint;
ALTER TABLE tournament_call_donation_intents ADD COLUMN IF NOT EXISTS channel_user_id bigint;
ALTER TABLE tournament_call_donation_intents DROP CONSTRAINT IF EXISTS tournament_call_donation_intents_user_id_fkey;
ALTER TABLE tournament_call_donation_intents ADD CONSTRAINT tournament_call_donation_intents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tournament_call_donation_intents DROP CONSTRAINT IF EXISTS tournament_call_donation_intents_channel_user_id_fkey;
ALTER TABLE tournament_call_donation_intents ADD CONSTRAINT tournament_call_donation_intents_channel_user_id_fkey
    FOREIGN KEY (channel_user_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_call_applications_origin ON tournament_call_applications(origin) WHERE origin <> 'form';
CREATE INDEX IF NOT EXISTS ix_call_intents_user ON tournament_call_donation_intents(user_id) WHERE user_id IS NOT NULL;
COMMIT;
