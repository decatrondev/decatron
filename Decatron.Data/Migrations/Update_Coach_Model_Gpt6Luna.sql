-- Coach de LoL: gpt-6-luna como modelo principal. 2026-09-23
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
--
-- Prueba real (plan final Ahri vs Zed): qwen3.8-flash 7.7 s y un solo proveedor (Alibaba);
-- gpt-6-luna 4.4-5.4 s con OpenAI + Azure + Bedrock detrás. Qwen pasa al final del respaldo,
-- así el coach queda gpt-6-luna → deepseek → qwen, y chat/traducción (que siguen en Qwen)
-- quedan qwen → gpt-6-luna → deepseek.
UPDATE decatron_ai_global_config
   SET coach_model = 'openai/gpt-6-luna',
       fallback_models = 'openai/gpt-6-luna,deepseek/deepseek-v4.1-flash,qwen/qwen3.8-flash',
       updated_at = NOW();
