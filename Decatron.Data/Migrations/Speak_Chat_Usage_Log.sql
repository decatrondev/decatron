-- Speak Chat, F7 (.dev/plans/speak-chat/PLAN.md): registro de uso. Quién usó qué comando, con qué voz, cuánto costó y qué se descartó y por qué.
-- Una fila por mensaje que activó una regla (leído o descartado). NO guarda el texto del mensaje ni llaves: solo usuario, comando, voz y resultado.
-- Se conservan 30 días (la poda la hace el backend). Los créditos son una estimación con la tarifa vigente (un acierto de caché se devuelve y aquí igual figura). 2026-10-21
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>   (ANTES de reiniciar el backend)
BEGIN;

CREATE TABLE IF NOT EXISTS speak_chat_usage_log (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL,            -- dueño del canal (speak_chat_configs.user_id)
    channel_name VARCHAR(100) NOT NULL,
    platform     VARCHAR(10)  NOT NULL DEFAULT 'twitch',
    username     VARCHAR(100) NOT NULL DEFAULT '', -- quien escribió el mensaje
    rule_type    VARCHAR(20)  NOT NULL DEFAULT '', -- command | bits | channelPoints | roles | all
    command      VARCHAR(100) NOT NULL DEFAULT '', -- solo en reglas de comando
    outcome      VARCHAR(30)  NOT NULL,            -- spoken | no_audio | blocked_word | blocked_user | cooldown_global | cooldown_user | empty | no_overlay | no_balance | queue_full | duplicate
    engine       VARCHAR(10)  NOT NULL DEFAULT '', -- piper | polly | fish
    voice        VARCHAR(100) NOT NULL DEFAULT '',
    chars        INTEGER      NOT NULL DEFAULT 0,
    credits      BIGINT       NULL,                -- null con voz estándar (sale de la cuota, no de créditos)
    created_at   TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    tenant_id    BIGINT       NOT NULL DEFAULT app_tenant_id() REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_speak_chat_usage_log_user ON speak_chat_usage_log(user_id, created_at DESC);

-- Igual que speak_chat_configs: una fila es de un tenant y solo ese tenant la ve
ALTER TABLE speak_chat_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON speak_chat_usage_log;
CREATE POLICY tenant_isolation ON speak_chat_usage_log USING (tenant_id = (SELECT app_tenant_id())) WITH CHECK (tenant_id = (SELECT app_tenant_id()));

GRANT SELECT, INSERT, DELETE ON speak_chat_usage_log TO decatron_user, decatron_app;
GRANT USAGE, SELECT ON SEQUENCE speak_chat_usage_log_id_seq TO decatron_user, decatron_app;

COMMIT;
