-- Aplicar título y categoría en las dos plataformas a la vez (.dev/plans/KICK_TITULO_CATEGORIA_PLAN.md). 2026-10-11
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
-- Una fila por cuenta (la de la fila principal). Sin fila = apagado.
CREATE TABLE IF NOT EXISTS title_game_sync_settings (
    user_id    BIGINT PRIMARY KEY REFERENCES users(id),
    enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON title_game_sync_settings TO decatron_user;
