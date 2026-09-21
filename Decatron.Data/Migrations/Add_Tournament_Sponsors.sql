-- Modulo de Torneos - Milestone 1: sponsors (alta manual).
-- Plan: .dev/torneos/06-premios-pagos-sponsors.md #3.
-- Fuera de este corte (Milestone 5): tournament_sponsor_leads (form publico "querés
-- ser sponsor?") y tournament_sponsor_impressions (metricas de vistas/clicks) — ver
-- ESTADO.md para el detalle de que quedo afuera y por que.

CREATE TABLE IF NOT EXISTS tournament_sponsors (
    id                       BIGSERIAL PRIMARY KEY,
    tournament_edition_id     BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    name                        VARCHAR(150) NOT NULL,
    logo_url                     VARCHAR(500),
    cta_text                      VARCHAR(150),
    cta_url                        VARCHAR(500),
    amount_sponsored                 DECIMAL(12,2),
    -- jsonb: ["home-banner", "prizes", "footer"]
    slots                              JSONB        NOT NULL DEFAULT '[]',
    -- 'active' | 'archived'
    status                               VARCHAR(20)  NOT NULL DEFAULT 'active',
    sort_order                            SMALLINT     NOT NULL DEFAULT 0,
    created_at                              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                                TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_sponsors_edition ON tournament_sponsors(tournament_edition_id, status);
