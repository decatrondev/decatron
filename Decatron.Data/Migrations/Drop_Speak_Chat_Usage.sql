-- Retira la tabla del contador viejo de Speak Chat.
--
-- El consumo se lleva desde 2026-07-26 en `tts_credit_ledger`, que es un libro de
-- movimientos y no un contador que se sobrescribe. Nada escribía ya en `speak_chat_usage`;
-- solo quedaban vivos el modelo de EF y su DbSet.
--
-- Se conservan los datos por si hiciera falta comparar con el histórico: la tabla se
-- renombra en vez de borrarse. Cuando se confirme que no se necesita, un
-- `DROP TABLE speak_chat_usage_backup` la elimina de verdad.

ALTER TABLE IF EXISTS speak_chat_usage RENAME TO speak_chat_usage_backup;
