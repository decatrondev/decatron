-- Gachapón — forzar el próximo tiro de un participante
--
-- El streamer elige un item para una persona concreta: en su siguiente tiro (de
-- cualquier billetera) sale esa carta, con su efecto y overlay, y el campo se
-- limpia solo. Un solo uso, una sola persona, sin tocar probabilidades globales.
-- Sirve para regalar una carta, compensar un fallo o probar el gachapón en vivo.

ALTER TABLE gacha_participants
    ADD COLUMN IF NOT EXISTS forced_item_id integer NULL
        REFERENCES gacha_items(id) ON DELETE SET NULL;
