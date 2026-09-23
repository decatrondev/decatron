-- IA: modelos de respaldo de OpenRouter, en orden. 2026-09-23
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
--
-- qwen/qwen3.8-flash tiene UN solo proveedor en OpenRouter (Alibaba). Cuando esa cola se
-- satura devuelve 429 y no hay a dónde ir: el 20-21/09 falló la mitad de las llamadas del
-- coach. Con esta lista, OpenRouter pasa solo al siguiente modelo en la misma petición.
-- gpt-6-luna: OpenAI + Azure + Bedrock. deepseek-v4.1-flash: 25 proveedores.
ALTER TABLE decatron_ai_global_config
    ADD COLUMN IF NOT EXISTS fallback_models VARCHAR(400) NOT NULL DEFAULT 'openai/gpt-6-luna,deepseek/deepseek-v4.1-flash';
