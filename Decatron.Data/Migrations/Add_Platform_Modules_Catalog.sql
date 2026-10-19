-- Modulos: catalogo granular (MODULOS.md, 2026-10-19). 31 capacidades nuevas module.* (los 45 modulos = 14 claves que ya existian + 31 nuevas).
-- Solo datos: capacidades, entitlements por plan y precios sueltos. Nada del codigo las lee todavia; las claves gruesas (module.commands/moderation/overlays) siguen vigentes hasta migrar el cumplimiento. Idempotente.
-- Aplicar: sudo -u postgres psql -d decatron_prod -v ON_ERROR_STOP=1 -q < 1_catalogo.sql     Reverso: 1r_reverso.sql
-- Plan que incluye cada modulo = su nivel minimo (plans.sort: semilla 20, creator 30, pro 40, studio 50, exclusivo 60); sandbox cuenta como semilla; el interno lo tiene todo.
-- price: USD/mes de lista (NULL = incluido, sin precio suelto). Periodos con descuento 3/6/9/12 m = 5/10/15/20 %.
BEGIN;

CREATE TEMP TABLE nuevos (key varchar(80), descr text, min_sort int, price numeric, sort int) ON COMMIT DROP;
INSERT INTO nuevos VALUES
 ('module.cmd_title',        'Cambiar titulo (!title, !t)',                    20, NULL, 500),
 ('module.cmd_game',         'Cambiar categoria (!game, !g)',                  20, NULL, 501),
 ('module.cmd_followage',    'Followage',                                      20, NULL, 502),
 ('module.cmd_micro',        'Micro comandos',                                 20, NULL, 503),
 ('module.cmd_custom',       'Comandos personalizados',                        20, NULL, 504),
 ('module.cmd_public',       'Vista publica de comandos (!commands)',          20, NULL, 505),
 ('module.cmd_scripting',    'Scripting de comandos',                          40, 4,    506),
 ('module.cmd_watchtime',    'Watchtime',                                      30, 1,    507),
 ('module.mod_banned_words', 'Moderacion: palabras prohibidas',                20, NULL, 510),
 ('module.mod_links',        'Moderacion: filtro de links',                    20, NULL, 511),
 ('module.mod_spam',         'Moderacion: anti-spam',                          20, NULL, 512),
 ('module.mod_commands',     'Moderacion: comandos (!permit, !nuke, !strikes)', 20, NULL, 513),
 ('module.mod_raids',        'Moderacion: proteccion de raids',                30, 1,    514),
 ('module.mod_history',      'Moderacion: historial',                          30, 1,    515),
 ('module.ov_shoutout',      'Shoutout (comando y overlay)',                   30, 1,    520),
 ('module.ov_chat',          'Overlay de chat',                                30, 1,    521),
 ('module.ov_sound_alerts',  'Sound Alerts',                                   30, 2,    522),
 ('module.ov_event_alerts',  'Event Alerts',                                   30, 2,    523),
 ('module.ov_goals',         'Metas (goals)',                                  30, 1,    524),
 ('module.ov_now_playing',   'Now Playing',                                    30, 1,    525),
 ('module.ov_live',          'Partida en vivo',                                50, 4,    526),
 ('module.gacha',            'Gacha / TCG',                                    40, 4,    530),
 ('module.tips',             'Tips (donaciones)',                              30, 2,    531),
 ('module.emotes',           'Emotes',                                         30, 2,    532),
 ('module.decatron_chat',    'Decatron Chat',                                  40, 3,    533),
 ('module.decatron_ai',      'Decatron AI',                                    40, 4,    534),
 ('module.bots',             'Bots del chat',                                  30, 1,    535),
 ('module.analytics',        'Analytics',                                      30, 2,    536),
 ('module.followers',        'Followers',                                      30, 1,    537),
 ('module.credits',          'Creditos de IA (compra)',                        20, NULL, 538),
 ('module.developer',        'Developer / apps OAuth',                         50, 8,    539);

INSERT INTO capabilities (key, kind, group_key, default_value, meter, description, active, sort)
SELECT key, 'flag', 'modulos', CASE WHEN min_sort = 20 THEN 1 ELSE 0 END, 'none', descr, true, sort FROM nuevos
ON CONFLICT (key) DO NOTHING;

INSERT INTO plan_entitlements (plan_id, capability_key, value)
SELECT p.id, n.key, 1 FROM plans p JOIN nuevos n
  ON p.is_internal OR (CASE WHEN p.key = 'sandbox' THEN 20 ELSE p.sort END) >= n.min_sort
ON CONFLICT DO NOTHING;

INSERT INTO addon_prices (capability_key, period_months, price_usd, active)
SELECT n.key, per.months, round(n.price * per.months * (1 - per.disc), 2), true
FROM nuevos n CROSS JOIN (VALUES (1,0.00),(3,0.05),(6,0.10),(9,0.15),(12,0.20)) AS per(months, disc)
WHERE n.price IS NOT NULL
ON CONFLICT (capability_key, period_months) DO UPDATE SET price_usd = EXCLUDED.price_usd, active = true;

COMMIT;
