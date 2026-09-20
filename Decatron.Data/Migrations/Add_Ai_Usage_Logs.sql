-- Registro unificado de uso de IA + modelos por módulo. Plan: .dev/plans/AI_OPENROUTER_UNIFICACION_PLAN.md
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>. La tabla debe quedar de decatron_user (ver ALTER al final).
-- 2026-09-19

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id                  BIGSERIAL PRIMARY KEY,
    module              VARCHAR(40)  NOT NULL,
    provider            VARCHAR(20)  NOT NULL,
    model               VARCHAR(120) NOT NULL,
    user_id             BIGINT       NOT NULL DEFAULT 0,
    channel_name        VARCHAR(100),
    prompt_tokens       INT          NOT NULL DEFAULT 0,
    completion_tokens   INT          NOT NULL DEFAULT 0,
    estimated_cost_usd  NUMERIC(12,6) NOT NULL DEFAULT 0,
    response_time_ms    INT          NOT NULL DEFAULT 0,
    success             BOOLEAN      NOT NULL DEFAULT TRUE,
    error_message       VARCHAR(300),
    used_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_used_at     ON ai_usage_logs (used_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_module_date ON ai_usage_logs (module, used_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_date   ON ai_usage_logs (user_id, used_at);

ALTER TABLE decatron_ai_global_config
    ADD COLUMN IF NOT EXISTS translation_model  VARCHAR(120) NOT NULL DEFAULT 'qwen/qwen3.8-flash',
    ADD COLUMN IF NOT EXISTS coach_model        VARCHAR(120) NOT NULL DEFAULT 'qwen/qwen3.8-flash',
    ADD COLUMN IF NOT EXISTS model_prices_json  TEXT NOT NULL DEFAULT '{"qwen/qwen3.8-flash":{"in":0.15,"out":0.47},"deepseek/deepseek-v4.1-flash":{"in":0.15,"out":0.60},"gemini-3.5-flash-lite":{"in":0.30,"out":2.50},"gemini-2.5-flash-lite":{"in":0.10,"out":0.40}}';

-- OpenRouter pasa a ser el proveedor principal; Gemini queda como fallback.
-- El modelo anterior del chat (openrouter/owl-alpha) ya no existe en OpenRouter: todo !decatronai daba 404 y caía a Gemini.
UPDATE decatron_ai_global_config SET ai_provider = 'openrouter', fallback_enabled = TRUE, openrouter_model = 'qwen/qwen3.8-flash';

ALTER TABLE ai_usage_logs OWNER TO decatron_user;
ALTER SEQUENCE ai_usage_logs_id_seq OWNER TO decatron_user;

-- El chat web tenía z-ai/glm-4.5-air:free, tampoco existe ya.
UPDATE decatron_chat_config SET openrouter_model = 'qwen/qwen3.8-flash';
