-- ============================================
-- TCG — INVENTARIO DE SOBRES SIN ABRIR
-- ============================================
-- Antes, comprar y abrir un sobre eran la misma accion (un solo endpoint cobraba y
-- entregaba las cartas al toque). Eso hacia imposible tener una vista de "abrir"
-- separada de la tienda, porque no existia el estado intermedio "sobre comprado
-- pero todavia sin abrir". Esta tabla es ese estado.
--
-- Una fila = un sobre fisico sin abrir. Se inserta al comprar y se borra al abrir
-- (no se marca como "abierto" y se deja: el registro historico de que abriste algo
-- ya vive en las cartas que te tocaron, no hace falta duplicarlo aca).

CREATE TABLE IF NOT EXISTS player_pack_inventory (
    id                BIGSERIAL PRIMARY KEY,
    owner_account_id  BIGINT    NOT NULL REFERENCES users(id),
    sobre_tier_id     INTEGER   NOT NULL REFERENCES card_sobre_tiers(id),
    purchased_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Lo que el jugador pago realmente por ESTE sobre. Se guarda por fila porque el
    -- precio del tier se puede tunear desde card_sobre_tiers en cualquier momento, y
    -- un reembolso tiene que devolver lo que se pago, no lo que cuesta hoy.
    price_paid        INTEGER   NOT NULL,

    CONSTRAINT chk_ppi_price CHECK (price_paid >= 0)
);

-- La consulta caliente es "dame los sobres sin abrir de este jugador", siempre
-- filtrando por dueño y ordenando por fecha de compra.
CREATE INDEX IF NOT EXISTS idx_ppi_owner
    ON player_pack_inventory (owner_account_id, purchased_at);
