-- ============================================
-- TCG — SOBRES GRATIS CON COOLDOWN POR TIER
-- ============================================
-- Hasta ahora lo unico gratis del TCG era la carta diaria (origen 'claimed'). Esto
-- suma una version gratis de cada sobre, una por ventana de tiempo y con la ventana
-- propia de cada tier: cuanto mas grande el sobre, mas espera.
--
-- Regla de economia que se mantiene: lo gratis vale 1 de catalogo para siempre, sin
-- importar la rareza que salga ni el grado al que llegue. Los frenos del sobre gratis
-- son la espera, la falta de piso garantizado y que no mueve el pity — no el valor.

-- ── 1. Distinguir un sobre gratis de uno pagado ──────────────────────────────────
-- Sin esto no hay forma de saber, al abrirlo, si sus cartas deben valer 1: el sobre
-- se consume y la fila desaparece, asi que el dato tiene que viajar en el sobre.
ALTER TABLE player_pack_inventory
    ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Cada tier define su propia espera ─────────────────────────────────────────
-- NULL = ese sobre no tiene version gratis. Va en la tabla del tier y no hardcodeado
-- en el servicio para poder apagar o retunear un sobre gratis sin recompilar.
ALTER TABLE card_sobre_tiers
    ADD COLUMN IF NOT EXISTS free_cooldown_hours INTEGER;

UPDATE card_sobre_tiers SET free_cooldown_hours = 24  WHERE name = 'Mini'       AND free_cooldown_hours IS NULL;
UPDATE card_sobre_tiers SET free_cooldown_hours = 48  WHERE name = 'Estandar'   AND free_cooldown_hours IS NULL;
UPDATE card_sobre_tiers SET free_cooldown_hours = 96  WHERE name = 'Plus'       AND free_cooldown_hours IS NULL;
UPDATE card_sobre_tiers SET free_cooldown_hours = 168 WHERE name = 'Premium'    AND free_cooldown_hours IS NULL;
UPDATE card_sobre_tiers SET free_cooldown_hours = 360 WHERE name = 'Legendario' AND free_cooldown_hours IS NULL;

ALTER TABLE card_sobre_tiers
    DROP CONSTRAINT IF EXISTS chk_cst_free_cooldown;
ALTER TABLE card_sobre_tiers
    ADD CONSTRAINT chk_cst_free_cooldown
    CHECK (free_cooldown_hours IS NULL OR free_cooldown_hours > 0);

-- ── 3. Cuando reclamo cada jugador cada sobre ────────────────────────────────────
-- Hace falta tabla propia: a diferencia del claim de carta, donde el cooldown se
-- deduce de la propia carta que quedo en la coleccion, el sobre se consume al abrirlo
-- y no deja rastro del que se pueda inferir la fecha.
--
-- Una fila por (cuenta, tier) que se pisa en cada reclamo. No es un log historico —
-- lo unico que hace falta responder es "cuando fue la ultima vez".
CREATE TABLE IF NOT EXISTS tcg_free_pack_claims (
    owner_account_id BIGINT    NOT NULL REFERENCES users(id),
    sobre_tier_id    INTEGER   NOT NULL REFERENCES card_sobre_tiers(id),
    claimed_at       TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (owner_account_id, sobre_tier_id)
);

-- ── 4. Origen nuevo para las cartas de sobre gratis ──────────────────────────────
-- Deliberadamente NO reusa 'claimed': el cooldown de la carta diaria se calcula
-- buscando la ultima instancia con origen 'claimed', asi que si compartieran origen,
-- abrir un sobre gratis le resetearia el cooldown al claim diario.
ALTER TABLE player_card_instances
    DROP CONSTRAINT IF EXISTS chk_pci_origin;
ALTER TABLE player_card_instances
    ADD CONSTRAINT chk_pci_origin
    CHECK (origin IN ('claimed', 'pulled', 'free_pack'));
