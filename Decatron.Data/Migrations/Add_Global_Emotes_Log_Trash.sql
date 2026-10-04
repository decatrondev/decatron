-- Emotes globales: historial de cambios y papelera de 30 días.

CREATE TABLE IF NOT EXISTS global_emote_log (
    id         BIGSERIAL PRIMARY KEY,
    actor      VARCHAR(100) NOT NULL,
    action     VARCHAR(30)  NOT NULL,
    detail     VARCHAR(300),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_global_emote_log_created ON global_emote_log (created_at DESC);

ALTER TABLE global_emotes ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;
ALTER TABLE global_emotes ADD COLUMN IF NOT EXISTS removed_by VARCHAR(100);
ALTER TABLE global_emotes DROP CONSTRAINT IF EXISTS chk_global_emote_status;
ALTER TABLE global_emotes ADD CONSTRAINT chk_global_emote_status CHECK (status IN ('approved', 'hidden', 'removed'));
-- Un nombre solo se repite entre emotes vivos: los de la papelera no lo bloquean
DROP INDEX IF EXISTS uq_global_emotes_name;
CREATE UNIQUE INDEX uq_global_emotes_name ON global_emotes (LOWER(name)) WHERE status <> 'removed';

ALTER TABLE global_emote_log OWNER TO decatron_user;
ALTER SEQUENCE global_emote_log_id_seq OWNER TO decatron_user;
