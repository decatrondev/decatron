-- Gachapón — efectos de item
--
-- Un item deja de ser solo nombre + rareza + imagen: puede hacer algo al salir.
-- Catálogo (mismo espíritu que los premios de la Rueda de la Suerte):
--   none        → nada, item coleccionable normal
--   roll_again  → el bot encadena otro tiro al instante (va como 1 tiro bonus)
--   extra_pulls → suma `effect_value` tiros bonus a la billetera del viewer
--   timer_time  → suma `effect_value` segundos al timer extensible (negativo = resta)
--
-- `consumable`: el item se usa y no queda en la colección. Pensado para los que
-- tienen efecto ("Tiro extra" común llenando el inventario no tiene gracia).

ALTER TABLE gacha_items
    ADD COLUMN IF NOT EXISTS effect_type  varchar(30) NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS effect_value integer     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS consumable   boolean     NOT NULL DEFAULT false;

ALTER TABLE gacha_items DROP CONSTRAINT IF EXISTS chk_gacha_item_effect_type;
ALTER TABLE gacha_items
    ADD CONSTRAINT chk_gacha_item_effect_type
    CHECK (effect_type IN ('none', 'roll_again', 'extra_pulls', 'timer_time'));
