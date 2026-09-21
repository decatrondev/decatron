-- Modulo de Torneos — condicion de victoria configurable para ARAM N vs N.
-- En vez de jugar hasta el nexo, el organizador elige una condicion (ej. "primera
-- torre", "equipo a 50 subditos") y el ganador del cruce del bracket se declara
-- solo cuando se cumple, leyendo el timeline de la partida via Riot API.
-- Pedido del usuario 24-08-2026.

CREATE TABLE IF NOT EXISTS tournament_win_conditions (
    id                      BIGSERIAL PRIMARY KEY,
    tournament_edition_id   BIGINT       NOT NULL UNIQUE REFERENCES tournament_editions(id) ON DELETE CASCADE,
    condition_type          VARCHAR(40)  NOT NULL DEFAULT 'first_tower',
    threshold_value         NUMERIC      NOT NULL DEFAULT 1,
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT NOW()
);
