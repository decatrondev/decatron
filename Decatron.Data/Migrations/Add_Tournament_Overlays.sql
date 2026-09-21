-- Modulo de Torneos - Milestone 3: overlays de streamer.
-- Plan: .dev/torneos/12-overlays-widget-embebible.md #1.
-- El widget de ranking embebible (#2) no necesita tabla propia — lee directo del
-- ranking ya calculado, igual que TournamentPublicController.GetHome.

CREATE TABLE IF NOT EXISTS tournament_overlay_configs (
    id                          BIGSERIAL PRIMARY KEY,
    tournament_participant_id    BIGINT       NOT NULL UNIQUE REFERENCES tournament_participants(id) ON DELETE CASCADE,
    token                          VARCHAR(64)  NOT NULL UNIQUE,
    -- jsonb: ["lp-actual", "shell-inventory", "castigo-activo", "racha"]
    enabled_widgets                 JSONB        NOT NULL DEFAULT '["lp-actual","shell-inventory","racha"]',
    theme                             VARCHAR(20)  NOT NULL DEFAULT 'dark',
    created_at                         TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                           TIMESTAMP    NOT NULL DEFAULT NOW()
);
