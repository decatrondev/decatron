-- Gachapón — tiros bonus y aviso en chat
--
-- 1) Tercera billetera: tiros bonus.
--
-- Hasta ahora todo tiro que no venía de coins iba a `effective_donation`, que es la
-- misma columna que mide dinero real (tips, bits, subs). La Rueda de la Suerte y los
-- regalos manuales del streamer inflaban el monto donado y el progreso de los hitos
-- por donación acumulada. Los bonus van aparte: no cuentan como donación, no avanzan
-- hitos y pueden vencer al terminar el stream si el canal lo pide.
--
-- 2) Aviso en chat al ganar tiros por sub/resub/bits/gift.
--
-- El viewer no se enteraba de que tenía tiros. Se avisa solo si el canal lo permite.

ALTER TABLE gacha_participants
    ADD COLUMN IF NOT EXISTS bonus_pulls_available integer NOT NULL DEFAULT 0;

ALTER TABLE gacha_integration_configs
    ADD COLUMN IF NOT EXISTS chat_notify_enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS bonus_expire_on_stream_end boolean NOT NULL DEFAULT false;

-- El log de tiros tenía un check que solo admitía donation/coins.
ALTER TABLE gacha_pull_logs DROP CONSTRAINT IF EXISTS chk_pull_type;
ALTER TABLE gacha_pull_logs
    ADD CONSTRAINT chk_pull_type CHECK (pull_type IN ('donation', 'coins', 'bonus'));
