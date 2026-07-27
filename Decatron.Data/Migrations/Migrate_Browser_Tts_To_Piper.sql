-- Migración: motor "browser" → voz estándar (Piper)
-- Fecha: 2026-07-27
-- Descripción: La voz del navegador se retiró. Nunca sonó dentro de OBS: la genera el
--              motor del sistema y su audio no entra en la captura de la fuente, así
--              que quien la tenía puesta estaba con las alertas mudas sin saberlo.
--              Piper hace lo que aquella prometía —gratis, sin coste por carácter— y
--              además produce un MP3, así que suena en cualquier OBS.
--
--              El código ya lee "browser" como "piper", así que esto no es
--              imprescindible para que funcione: es para dejar los datos limpios y que
--              el panel no siga enseñando un motor que ya no existe.
--
--              El código lee "browser" como "piper", así que esto no es imprescindible
--              para que funcione: deja los datos limpios.

-- ─────────────────────────────────────────────────────────────────────────────
-- Speak Chat: el único sitio donde alguien llegó a elegir el navegador
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE speak_chat_configs
SET config_json = jsonb_set(
        config_json,
        '{voice}',
        (config_json->'voice')
            - 'browserVoice'
            || jsonb_build_object(
                'engine', 'piper',
                -- La voz del navegador que tenían guardada no sirve de nada aquí: son
                -- catálogos distintos. Vacío = el servidor elige la del idioma.
                'standardVoice', ''
            )
    )
WHERE config_json->'voice'->>'engine' = 'browser';

-- Los que ya usaban Polly conservan su motor, pero se les quita el campo muerto
UPDATE speak_chat_configs
SET config_json = jsonb_set(
        config_json,
        '{voice}',
        (config_json->'voice') - 'browserVoice'
    )
WHERE config_json->'voice' ? 'browserVoice';

-- ─────────────────────────────────────────────────────────────────────────────
-- Alertas de eventos, tips y timer
--
-- Hoy ninguna configuración tiene provider="browser" ahí (el selector se añadió
-- hace pocos días y nadie lo cambió), pero se deja el reemplazo por si alguna se
-- guarda entre este archivo y su ejecución. Es una sustitución de texto sobre el
-- JSON completo porque el campo vive anidado a distinta profundidad en cada
-- feature —por alerta, por tramo de propina, por evento del timer— y recorrer
-- todos esos caminos con jsonb_set sería mucho más frágil que esto.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE event_alerts_configs
SET config_json = REPLACE(config_json::text, '"provider":"browser"', '"provider":"piper"')::jsonb
WHERE config_json::text LIKE '%"provider":"browser"%';

UPDATE tips_configs
SET alert_config = REPLACE(alert_config::text, '"provider":"browser"', '"provider":"piper"')::jsonb
WHERE alert_config::text LIKE '%"provider":"browser"%';

UPDATE tips_configs
SET tips_alert_config = REPLACE(tips_alert_config::text, '"provider":"browser"', '"provider":"piper"')::jsonb
WHERE tips_alert_config::text LIKE '%"provider":"browser"%';

UPDATE tips_configs
SET basic_alert_tts = REPLACE(basic_alert_tts::text, '"provider":"browser"', '"provider":"piper"')::jsonb
WHERE basic_alert_tts::text LIKE '%"provider":"browser"%';

UPDATE timer_configs
SET alerts_config = REPLACE(alerts_config::text, '"provider":"browser"', '"provider":"piper"')::jsonb
WHERE alerts_config::text LIKE '%"provider":"browser"%';
