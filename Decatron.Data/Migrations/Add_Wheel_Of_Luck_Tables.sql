-- ============================================================
-- RUEDA DE LA SUERTE - Fase 0
-- Ver .dev/plans/RUEDA_DE_LA_SUERTE_PLAN.md, seccion 5.
-- ============================================================
--
-- Prefijo wheel_ para no colisionar con el gachapon ni con giveaway.
--
-- Dos decisiones que se apartan del resto del esquema y conviene tener presentes:
--
-- 1. El dueño se guarda como channel_id -> users(id), NO como channel_name. Las
--    features viejas (gacha, goals, event-alerts) guardan el login en texto y se
--    rompen el dia que un streamer se cambia el nombre en Twitch. Aca la URL del
--    overlay sigue siendo ?channel=<login>, pero se resuelve login -> users.id al
--    entrar y todo lo demas cuelga del id.
--
-- 2. Dos columnas cambian de nombre respecto del plan porque las palabras que
--    pedia son reservadas en Postgres: `order` -> display_order y
--    `trigger` -> trigger_source.

-- ------------------------------------------------------------
-- 1. wheels - la plantilla configurable
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wheels (
    id                  SERIAL PRIMARY KEY,
    channel_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name                VARCHAR(80) NOT NULL,

    -- 'prizes' | 'raffle'. Inmutable tras crear: cambiarlo dejaria historial y
    -- configuracion sin sentido. Si el streamer quiere el otro modo, crea otra rueda.
    mode                VARCHAR(10) NOT NULL,

    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    -- Varias ruedas pueden estar habilitadas a la vez, cada una con su overlay.
    -- is_active solo marca cual destaca el panel como "la rueda activa".
    is_active           BOOLEAN NOT NULL DEFAULT FALSE,

    -- Nombre visible de los creditos ("fichas", "puntos de aporte", ...).
    credit_label        VARCHAR(30) NOT NULL DEFAULT 'creditos',
    spin_price          INTEGER NOT NULL DEFAULT 100,

    -- Si los aportes por debajo del precio se guardan (TRUE) o se descartan
    -- cuando no alcanzan en un solo evento (FALSE).
    is_accumulable      BOOLEAN NOT NULL DEFAULT TRUE,
    -- Que hacer con el sobrante cuando NO es acumulable: 'discard' | 'cheapest_spins'.
    overflow_policy     VARCHAR(20) NOT NULL DEFAULT 'discard',
    -- Cuando un aporte alcanza para varios giros:
    -- 'most_expensive' | 'most_spins' | 'viewer_choice'.
    multi_fit_policy    VARCHAR(20) NOT NULL DEFAULT 'most_spins',

    -- 'never' | 'stream_end' | 'days'. Default never: los creditos son un aporte
    -- real del espectador, caducarlos por defecto seria hostil.
    credit_expiry       VARCHAR(20) NOT NULL DEFAULT 'never',
    credit_expiry_days  INTEGER,

    -- 'off' | 'per_viewer' | 'global' - evita repetir el mismo premio.
    no_repeat_scope     VARCHAR(20) NOT NULL DEFAULT 'off',

    -- Piedad estilo gacha: garantiza premio raro cada N giros sin premio.
    pity_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    pity_threshold      INTEGER,

    allow_multi_spin    BOOLEAN NOT NULL DEFAULT FALSE,
    max_multi_spin      INTEGER NOT NULL DEFAULT 10,

    -- Identificador legible para la URL: /overlay/rueda?channel=<canal>&wheel=<slug>.
    slug                VARCHAR(40) NOT NULL,

    -- Si el saldo de creditos es visible publicamente (leaderboard). Default privado.
    credits_public      BOOLEAN NOT NULL DEFAULT FALSE,

    -- Colores, imagen central, puntero, fuentes, tiempos, sonidos, celebracion.
    visual_config       JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Textos de anuncio en chat y en el overlay (en/es), plantillas.
    announce_config     JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wheels_channel_slug     UNIQUE (channel_id, slug),
    CONSTRAINT chk_wheels_mode            CHECK (mode IN ('prizes', 'raffle')),
    CONSTRAINT chk_wheels_overflow        CHECK (overflow_policy IN ('discard', 'cheapest_spins')),
    CONSTRAINT chk_wheels_multifit        CHECK (multi_fit_policy IN ('most_expensive', 'most_spins', 'viewer_choice')),
    CONSTRAINT chk_wheels_expiry          CHECK (credit_expiry IN ('never', 'stream_end', 'days')),
    -- Si caduca por dias, tiene que haber un numero de dias y ser positivo.
    CONSTRAINT chk_wheels_expiry_days     CHECK (credit_expiry <> 'days' OR (credit_expiry_days IS NOT NULL AND credit_expiry_days > 0)),
    CONSTRAINT chk_wheels_norepeat        CHECK (no_repeat_scope IN ('off', 'per_viewer', 'global')),
    CONSTRAINT chk_wheels_pity            CHECK (NOT pity_enabled OR (pity_threshold IS NOT NULL AND pity_threshold > 0)),
    CONSTRAINT chk_wheels_price           CHECK (spin_price > 0),
    CONSTRAINT chk_wheels_multispin       CHECK (max_multi_spin BETWEEN 1 AND 100),
    CONSTRAINT chk_wheels_slug            CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
    CONSTRAINT chk_wheels_name            CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_wheels_channel ON wheels (channel_id);

-- ------------------------------------------------------------
-- 2. wheel_segments - los gajos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wheel_segments (
    id                  SERIAL PRIMARY KEY,
    wheel_id            INTEGER NOT NULL REFERENCES wheels(id) ON DELETE CASCADE,

    label               VARCHAR(60) NOT NULL,
    -- Peso relativo. La normalizacion a % la hace la app sobre los gajos
    -- habilitados y con stock, no la base.
    weight              DECIMAL(7,3) NOT NULL DEFAULT 1,
    -- Hex con o sin alpha (#RRGGBB / #RRGGBBAA). NULL = usa la paleta de visual_config.
    color               VARCHAR(9),
    -- Emoji o clave de icono.
    icon                VARCHAR(100),
    display_order       INTEGER NOT NULL DEFAULT 0,

    -- Un solo premio por gajo (seccion 5.3). 'nothing' es un premio valido:
    -- el clasico "sigue participando".
    prize               JSONB NOT NULL DEFAULT '{"type":"nothing","params":{}}'::jsonb,

    stock_total         INTEGER,        -- NULL = ilimitado
    stock_per_viewer    INTEGER,        -- NULL = ilimitado
    -- Ventana del stock: 'stream' | 'day' | 'ever'.
    stock_window        VARCHAR(20) NOT NULL DEFAULT 'ever',
    -- Contador vivo de la ventana actual. NULL cuando stock_total es NULL.
    stock_remaining     INTEGER,

    -- Permite apagar un gajo sin borrarlo (y sin romper el historial que lo apunta).
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_wheel_segments_weight  CHECK (weight >= 0),
    CONSTRAINT chk_wheel_segments_window  CHECK (stock_window IN ('stream', 'day', 'ever')),
    CONSTRAINT chk_wheel_segments_stock   CHECK (stock_total IS NULL OR stock_total >= 0),
    CONSTRAINT chk_wheel_segments_label   CHECK (length(trim(label)) > 0),
    CONSTRAINT chk_wheel_segments_color   CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$')
);

CREATE INDEX IF NOT EXISTS idx_wheel_segments_wheel       ON wheel_segments (wheel_id);
CREATE INDEX IF NOT EXISTS idx_wheel_segments_wheel_order ON wheel_segments (wheel_id, display_order);

-- ------------------------------------------------------------
-- 3. wheel_wallets - Billetera de Aportes (modo Premios)
-- ------------------------------------------------------------
-- Saldo por espectador y por canal. La billetera es del CANAL, no de la rueda:
-- el espectador aporta una vez y puede gastar en cualquier rueda de ese canal.
CREATE TABLE IF NOT EXISTS wheel_wallets (
    id                  SERIAL PRIMARY KEY,
    channel_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- El espectador puede no tener cuenta en Decatron todavia: el login es lo unico
    -- que siempre hay. viewer_user_id se rellena si aparece por users mas adelante.
    viewer_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    viewer_login        VARCHAR(100) NOT NULL,

    credits             INTEGER NOT NULL DEFAULT 0,
    -- Historico, nunca baja. Sirve para leaderboards y para no perder el dato
    -- cuando los creditos caducan.
    lifetime_credits    INTEGER NOT NULL DEFAULT 0,

    last_activity_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Giros seguidos sin premio, para la piedad.
    pity_counter        INTEGER NOT NULL DEFAULT 0,

    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wheel_wallets_channel_viewer UNIQUE (channel_id, viewer_login),
    CONSTRAINT chk_wheel_wallets_credits       CHECK (credits >= 0),
    CONSTRAINT chk_wheel_wallets_lifetime      CHECK (lifetime_credits >= 0),
    CONSTRAINT chk_wheel_wallets_pity          CHECK (pity_counter >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wheel_wallets_channel ON wheel_wallets (channel_id);
CREATE INDEX IF NOT EXISTS idx_wheel_wallets_viewer  ON wheel_wallets (viewer_user_id);

-- ------------------------------------------------------------
-- 4. wheel_wallet_sources - tasas de conversion, por rueda
-- ------------------------------------------------------------
-- La tasa se guarda como fraccion y no como decimal a proposito: "1 sub = 500
-- creditos" y "100 bits = 1 credito" son la misma estructura, y no hay redondeo
-- flotante que discuta con el saldo del espectador.
CREATE TABLE IF NOT EXISTS wheel_wallet_sources (
    id                        SERIAL PRIMARY KEY,
    wheel_id                  INTEGER NOT NULL REFERENCES wheels(id) ON DELETE CASCADE,

    -- 'bits' | 'gift_sub' | 'donation' | 'channel_points' | 'deca_coins'.
    source                    VARCHAR(20) NOT NULL,
    -- deca_coins se crea desactivada: casi nadie la usa (decision 3 del plan).
    is_enabled                BOOLEAN NOT NULL DEFAULT FALSE,

    rate_numerator            INTEGER NOT NULL DEFAULT 1,
    rate_denominator          INTEGER NOT NULL DEFAULT 1,

    -- Tope de creditos por evento individual. NULL = sin tope.
    cap_per_event             INTEGER,

    -- Solo cuando source = 'channel_points': que recompensa cuenta.
    channel_points_reward_id  VARCHAR(100),

    created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wheel_wallet_sources UNIQUE (wheel_id, source),
    CONSTRAINT chk_wheel_sources_name  CHECK (source IN ('bits', 'gift_sub', 'donation', 'channel_points', 'deca_coins')),
    CONSTRAINT chk_wheel_sources_num   CHECK (rate_numerator > 0),
    CONSTRAINT chk_wheel_sources_den   CHECK (rate_denominator > 0),
    CONSTRAINT chk_wheel_sources_cap   CHECK (cap_per_event IS NULL OR cap_per_event > 0)
);

CREATE INDEX IF NOT EXISTS idx_wheel_wallet_sources_wheel ON wheel_wallet_sources (wheel_id);

-- ------------------------------------------------------------
-- 5. wheel_spins - historial
-- ------------------------------------------------------------
-- El historial nunca se borra (decision 6 del plan): pasada la ventana del tier
-- solo deja de mostrarse en el panel. Por eso result_segment_id es SET NULL y no
-- CASCADE: borrar un gajo no puede llevarse los giros que lo ganaron. El premio
-- real queda igual en result_prize, que es una foto del momento.
CREATE TABLE IF NOT EXISTS wheel_spins (
    id                  BIGSERIAL PRIMARY KEY,
    wheel_id            INTEGER NOT NULL REFERENCES wheels(id) ON DELETE CASCADE,

    -- Copia del modo al momento del giro.
    mode                VARCHAR(10) NOT NULL,

    spinner_user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    spinner_login       VARCHAR(100),

    -- 'command' | 'panel' | 'auto' | 'raffle_draw'.
    trigger_source      VARCHAR(20) NOT NULL,
    credits_spent       INTEGER NOT NULL DEFAULT 0,

    result_segment_id   INTEGER REFERENCES wheel_segments(id) ON DELETE SET NULL,
    -- Snapshot del premio entregado. Sobrevive a que el gajo cambie o se borre.
    result_prize        JSONB,

    -- 'delivered' | 'pending' | 'failed'.
    delivery_status     VARCHAR(20) NOT NULL DEFAULT 'delivered',
    -- Modo Sorteo: ganador(es).
    raffle_winner       JSONB,

    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_wheel_spins_mode     CHECK (mode IN ('prizes', 'raffle')),
    CONSTRAINT chk_wheel_spins_trigger  CHECK (trigger_source IN ('command', 'panel', 'auto', 'raffle_draw')),
    CONSTRAINT chk_wheel_spins_status   CHECK (delivery_status IN ('delivered', 'pending', 'failed')),
    CONSTRAINT chk_wheel_spins_credits  CHECK (credits_spent >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wheel_spins_wheel        ON wheel_spins (wheel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_spinner      ON wheel_spins (spinner_login);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_status       ON wheel_spins (delivery_status) WHERE delivery_status <> 'delivered';

-- ------------------------------------------------------------
-- 6. wheel_pending_deliveries - bandeja de entregas manuales
-- ------------------------------------------------------------
-- Premios que el bot no puede cumplir solo (ej. manual_message): quedan aca para
-- que el streamer los resuelva a mano.
CREATE TABLE IF NOT EXISTS wheel_pending_deliveries (
    id                  SERIAL PRIMARY KEY,
    wheel_id            INTEGER NOT NULL REFERENCES wheels(id) ON DELETE CASCADE,
    spin_id             BIGINT NOT NULL REFERENCES wheel_spins(id) ON DELETE CASCADE,

    viewer_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    viewer_login        VARCHAR(100) NOT NULL,

    prize               JSONB NOT NULL,
    -- 'pending' | 'done' | 'cancelled'.
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',

    resolved_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    resolved_at         TIMESTAMP,
    notes               VARCHAR(500),

    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_wheel_deliveries_status   CHECK (status IN ('pending', 'done', 'cancelled')),
    -- Una entrega resuelta tiene que decir cuando se resolvio.
    CONSTRAINT chk_wheel_deliveries_resolved CHECK (status = 'pending' OR resolved_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_wheel_deliveries_wheel   ON wheel_pending_deliveries (wheel_id, status);
CREATE INDEX IF NOT EXISTS idx_wheel_deliveries_pending ON wheel_pending_deliveries (wheel_id) WHERE status = 'pending';

-- ------------------------------------------------------------
-- 7. wheel_raffle_entries - inscritos (modo Sorteo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wheel_raffle_entries (
    id                  SERIAL PRIMARY KEY,
    wheel_id            INTEGER NOT NULL REFERENCES wheels(id) ON DELETE CASCADE,

    viewer_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    viewer_login        VARCHAR(100) NOT NULL,

    -- Numero de boletos, si se pueden comprar varios.
    entries             INTEGER NOT NULL DEFAULT 1,
    -- Peso efectivo tras multiplicadores.
    weight              DECIMAL(7,3) NOT NULL DEFAULT 1,
    -- De donde sale ese peso (watchtime, sub, tier, coins, manual). Se guarda para
    -- poder explicarle al espectador por que otro tenia mas peso que el.
    weight_breakdown    JSONB NOT NULL DEFAULT '{}'::jsonb,

    joined_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Para "quitar ganador del pool" sin perder el registro de que participo.
    has_won             BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_wheel_raffle_entry     UNIQUE (wheel_id, viewer_login),
    CONSTRAINT chk_wheel_raffle_entries  CHECK (entries > 0),
    CONSTRAINT chk_wheel_raffle_weight   CHECK (weight >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wheel_raffle_entries_wheel ON wheel_raffle_entries (wheel_id);
CREATE INDEX IF NOT EXISTS idx_wheel_raffle_entries_pool  ON wheel_raffle_entries (wheel_id) WHERE has_won = FALSE;

-- ------------------------------------------------------------
-- 8. wheel_raffle_configs - config del modo Sorteo
-- ------------------------------------------------------------
-- Tabla aparte y no dentro de wheels.visual_config: son reglas del sorteo, no
-- aspecto, y una rueda de modo Premios no tiene ninguna de estas columnas.
CREATE TABLE IF NOT EXISTS wheel_raffle_configs (
    id                      SERIAL PRIMARY KEY,
    wheel_id                INTEGER NOT NULL UNIQUE REFERENCES wheels(id) ON DELETE CASCADE,

    entry_command           VARCHAR(30) NOT NULL DEFAULT '!djoin',
    -- Array de 'command' | 'channel_points' | 'auto_active_chatters' | 'manual'.
    entry_methods           JSONB NOT NULL DEFAULT '["command"]'::jsonb,

    -- 'manual' | 'timed' | 'always_open'.
    window_mode             VARCHAR(20) NOT NULL DEFAULT 'manual',
    window_seconds          INTEGER,

    entry_cost_credits      INTEGER NOT NULL DEFAULT 0,
    max_entries_per_viewer  INTEGER NOT NULL DEFAULT 1,

    -- Multiplicadores: watchtime, sub, tier, coins gastados, manual por usuario.
    weight_sources          JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- subs_only, followers_only, min_watchtime_minutes.
    requirements            JSONB NOT NULL DEFAULT '{}'::jsonb,

    winners_count           INTEGER NOT NULL DEFAULT 1,
    -- 'single' | 'multi' | 'remove_and_continue'.
    draw_mode               VARCHAR(20) NOT NULL DEFAULT 'single',
    remove_winner_from_pool BOOLEAN NOT NULL DEFAULT TRUE,
    clear_on_stream_end     BOOLEAN NOT NULL DEFAULT FALSE,

    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_wheel_raffle_window   CHECK (window_mode IN ('manual', 'timed', 'always_open')),
    CONSTRAINT chk_wheel_raffle_secs     CHECK (window_mode <> 'timed' OR (window_seconds IS NOT NULL AND window_seconds > 0)),
    CONSTRAINT chk_wheel_raffle_draw     CHECK (draw_mode IN ('single', 'multi', 'remove_and_continue')),
    CONSTRAINT chk_wheel_raffle_winners  CHECK (winners_count > 0),
    CONSTRAINT chk_wheel_raffle_cost     CHECK (entry_cost_credits >= 0),
    CONSTRAINT chk_wheel_raffle_max      CHECK (max_entries_per_viewer > 0),
    CONSTRAINT chk_wheel_raffle_command  CHECK (entry_command ~ '^![a-zA-Z0-9_-]+$')
);
