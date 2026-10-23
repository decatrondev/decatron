-- Giveaways (comandos de chat): la participación puede quedar abierta mientras se validan ganadores y se cierra a mano
-- con «!giveaway close». Esta marca dice si el sorteo ya no acepta entradas. false = como siempre. 2026-10-23
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>   (ANTES de reiniciar el backend)
BEGIN;
ALTER TABLE giveaway_sessions ADD COLUMN IF NOT EXISTS entries_closed boolean NOT NULL DEFAULT false;
COMMIT;
