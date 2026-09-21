-- Sistema de cards coleccionables (TCG) - tablas nuevas.
--
-- cards (tabla existente, no se toca) sigue siendo solo el catalogo de disenios base,
-- generado aparte en ComfyUI Desktop. Todo lo de aca es posesion/progreso del jugador,
-- separado a proposito: un disenio de cards.id puede tener muchas instancias, una por
-- cada jugador que lo saco, cada una en su propio nivel.
--
-- Plan completo: .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md

-- ============================================
-- PLAYER_CARD_INSTANCES (posesion real de un jugador sobre un disenio de cards)
-- ============================================
CREATE TABLE IF NOT EXISTS player_card_instances (
    id                   BIGSERIAL PRIMARY KEY,
    card_id              UUID        NOT NULL REFERENCES cards(id),
    owner_account_id     BIGINT      NOT NULL REFERENCES users(id),

    level                SMALLINT    NOT NULL DEFAULT 0,
    origin               VARCHAR(10) NOT NULL,

    -- Cacheado, no se recalcula en cada lectura (leaderboards/colecciones se leen mucho
    -- mas de lo que se escribe). Se recalcula solo al subir de nivel. Si origin='claimed'
    -- queda fijo en 1 para siempre, sin importar el nivel que alcance.
    catalog_value        INTEGER     NOT NULL DEFAULT 0,

    -- 'active': jugable normal. 'frozen_pending_payment': gano un intento de upgrade y
    -- esta esperando el pago dentro de la ventana de 24h, no se puede usar en batalla ni
    -- mandar a otro upgrade mientras tanto. 'destroyed': fallo un intento o no pago a
    -- tiempo. Nunca se hard-deletea una fila destroyed: es dinero real de por medio en
    -- algunos casos y hace falta el historial para cualquier disputa de pago.
    status               VARCHAR(30) NOT NULL DEFAULT 'active',

    pending_target_level SMALLINT,
    payment_amount_due   INTEGER,
    payment_deadline_at  TIMESTAMP,

    -- FK logica a la compra/sobre que la genero, para trazabilidad. Sin REFERENCES
    -- todavia porque la tabla de compras/pulls no esta disenada en este documento
    -- (depende del servicio de DecaCoins, que sigue sin construirse).
    source_pull_id       BIGINT,

    acquired_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    destroyed_at         TIMESTAMP,
    created_at           TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_pci_level         CHECK (level BETWEEN 0 AND 9),
    CONSTRAINT chk_pci_pending_level CHECK (pending_target_level IS NULL OR pending_target_level BETWEEN 1 AND 9),
    CONSTRAINT chk_pci_origin        CHECK (origin IN ('claimed', 'pulled')),
    CONSTRAINT chk_pci_status        CHECK (status IN ('active', 'frozen_pending_payment', 'destroyed'))
);

CREATE INDEX IF NOT EXISTS idx_pci_owner ON player_card_instances (owner_account_id);
CREATE INDEX IF NOT EXISTS idx_pci_card  ON player_card_instances (card_id);

-- Indice parcial: el job que barre pagos vencidos solo necesita esta franja, no la tabla
-- entera, y la mayoria de las filas nunca van a estar en este estado a la vez.
CREATE INDEX IF NOT EXISTS idx_pci_pending_payment
    ON player_card_instances (payment_deadline_at)
    WHERE status = 'frozen_pending_payment';

-- ============================================
-- UPGRADE_ATTEMPT_LOG (un registro por intento, sobrevive aunque la carta se destruya)
-- ============================================
CREATE TABLE IF NOT EXISTS upgrade_attempt_log (
    id                        BIGSERIAL PRIMARY KEY,
    instance_id               BIGINT      NOT NULL REFERENCES player_card_instances(id),

    -- Denormalizados a proposito: el stat de "cuanto invirtio realmente cada jugador en
    -- total" y el de "carta mas intentada" se leen por leaderboard/reporte, no vale la
    -- pena forzar un join contra player_card_instances (que ademas puede estar en
    -- status='destroyed') para algo que se consulta seguido.
    owner_account_id          BIGINT      NOT NULL REFERENCES users(id),
    card_id                   UUID        NOT NULL REFERENCES cards(id),

    from_level                SMALLINT    NOT NULL,
    to_level                  SMALLINT    NOT NULL,

    -- 'fail': perdio la tirada de probabilidad, destruida al toque. 'success_paid':
    -- gano la tirada y pago dentro de las 24h, subio de nivel de verdad. 'success_expired_unpaid':
    -- gano la tirada pero no pago a tiempo, destruida igual - se separa de 'fail' porque
    -- para analitica/soporte son causas de perdida completamente distintas.
    result                    VARCHAR(30) NOT NULL,

    -- Snapshot inmutable del % aplicado en el momento del intento. La tabla de
    -- probabilidades puede cambiar con el tiempo (balance); este log tiene que seguir
    -- reflejando lo que realmente se le mostro al jugador ese dia.
    success_probability_used  NUMERIC(5,2) NOT NULL,
    cost_charged              INTEGER,

    rolled_at                 TIMESTAMP   NOT NULL DEFAULT NOW(),
    resolved_at               TIMESTAMP,

    CONSTRAINT chk_ual_from_level CHECK (from_level BETWEEN 0 AND 8),
    CONSTRAINT chk_ual_to_level   CHECK (to_level BETWEEN 1 AND 9),
    CONSTRAINT chk_ual_result     CHECK (result IN ('fail', 'success_paid', 'success_expired_unpaid'))
);

CREATE INDEX IF NOT EXISTS idx_ual_owner ON upgrade_attempt_log (owner_account_id);
CREATE INDEX IF NOT EXISTS idx_ual_card  ON upgrade_attempt_log (card_id);

-- ============================================
-- CARD_LEVEL_ART (arte de upgrade, compartido entre TODOS los jugadores que lleguen
-- a ese card_id + level - no es una imagen por jugador, ver plan seccion 8.5)
-- ============================================
CREATE TABLE IF NOT EXISTS card_level_art (
    id            BIGSERIAL PRIMARY KEY,
    card_id       UUID        NOT NULL REFERENCES cards(id),
    level         SMALLINT    NOT NULL,
    image_path    TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMP,

    CONSTRAINT chk_cla_level  CHECK (level BETWEEN 1 AND 9),
    CONSTRAINT chk_cla_status CHECK (status IN ('pending', 'generating', 'done')),

    -- Garantiza que nunca se pide (ni se genera) dos veces la misma combinacion -
    -- el primer jugador que llega a un nivel dispara el pedido, todos los demas
    -- despues lo ven ya resuelto.
    CONSTRAINT uq_cla_card_level UNIQUE (card_id, level)
);

-- Indice parcial para la cola de pendientes que revisa el dueño - la inmensa mayoria
-- de las filas eventualmente quedan en 'done' y no hace falta escanearlas.
CREATE INDEX IF NOT EXISTS idx_cla_pending
    ON card_level_art (requested_at)
    WHERE status != 'done';

-- ============================================
-- CARD_SOBRE_TIERS (config de los 5 tiers de sobres, en DB para poder tunear precio
-- sin redeploy)
-- ============================================
CREATE TABLE IF NOT EXISTS card_sobre_tiers (
    id                       SERIAL PRIMARY KEY,
    name                     VARCHAR(50) NOT NULL,
    card_count               SMALLINT    NOT NULL,
    price_coins              INTEGER     NOT NULL,
    guaranteed_floor_rarity  VARCHAR(10) NOT NULL,
    active                   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_cst_card_count CHECK (card_count > 0),
    CONSTRAINT chk_cst_price      CHECK (price_coins > 0),
    CONSTRAINT chk_cst_floor      CHECK (guaranteed_floor_rarity IN ('N', 'R', 'SR', 'SSR', 'UR', 'LR', 'MR'))
);

-- Seed de los 5 tiers ya definidos en el plan (seccion 4.1). Precios de ejemplo,
-- ajustables desde esta tabla sin tocar codigo.
INSERT INTO card_sobre_tiers (name, card_count, price_coins, guaranteed_floor_rarity) VALUES
    ('Mini',       3,  250,   'R'),
    ('Estandar',   5,  400,   'R'),
    ('Plus',       10, 750,   'SR'),
    ('Premium',    20, 1400,  'SSR'),
    ('Legendario', 40, 2400,  'UR')
ON CONFLICT DO NOTHING;

-- ============================================
-- PLAYER_PITY_COUNTER (garantia de SR+ cada 20 cartas obtenidas, acumulado entre sobres)
-- ============================================
CREATE TABLE IF NOT EXISTS player_pity_counter (
    owner_account_id          BIGINT    PRIMARY KEY REFERENCES users(id),
    cards_since_last_sr_plus  INTEGER   NOT NULL DEFAULT 0,
    last_reset_at             TIMESTAMP
);

-- ============================================
-- CARD_EVENT_BANNERS (ventana de disponibilidad de cards de evento - navidad/verano/
-- halloween, matchea cards.event_id)
-- ============================================
CREATE TABLE IF NOT EXISTS card_event_banners (
    id          SERIAL      PRIMARY KEY,
    event_id    VARCHAR(50) NOT NULL,
    starts_at   TIMESTAMP   NOT NULL,
    ends_at     TIMESTAMP   NOT NULL,
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ceb_dates CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_ceb_active ON card_event_banners (event_id, active);
