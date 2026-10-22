-- Giveaways F3a (.dev/plans/giveaways/PLAN.md): participante = (plataforma, id). Los ids numéricos de Twitch y Kick
-- pueden coincidir; sin esta columna dos personas distintas serían la misma. Texto abierto (sin enum): YouTube, TikTok
-- etc. se suman después sin tocar la base. Todo lo existente es de Twitch. 2026-10-22
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>   (ANTES de reiniciar el backend)
BEGIN;
ALTER TABLE giveaway_participants      ADD COLUMN IF NOT EXISTS platform varchar(20) NOT NULL DEFAULT 'twitch';
ALTER TABLE giveaway_winner_cooldowns  ADD COLUMN IF NOT EXISTS platform varchar(20) NOT NULL DEFAULT 'twitch';
ALTER TABLE giveaway_blacklist         ADD COLUMN IF NOT EXISTS platform varchar(20) NOT NULL DEFAULT 'twitch';

DROP INDEX IF EXISTS giveaway_blacklist_channel_id_user_id_key_t;
CREATE UNIQUE INDEX giveaway_blacklist_channel_id_user_id_key_t
    ON giveaway_blacklist USING btree (tenant_id, channel_id, platform, user_id);
COMMIT;
