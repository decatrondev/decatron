-- Modulo de Torneos - Milestone 1: Normas (texto).
-- Plan: .dev/torneos/09-panel-admin-backend.md #4.
-- v1: textarea + markdown simple, sin editor rich-text (ver ESTADO.md #5 item 8 —
-- no hay libreria rich-text instalada en el frontend, se agrega despues si hace falta).

CREATE TABLE IF NOT EXISTS tournament_rule_documents (
    id                      BIGSERIAL PRIMARY KEY,
    tournament_edition_id    BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    -- 'general' | 'punishments' (nombre generico, no 'blue_shell' — ver decision de
    -- nombres propios por tenant, Add_Tournament_Custom_Mechanic_Names.sql)
    type                      VARCHAR(20)  NOT NULL,
    content_markdown           TEXT         NOT NULL DEFAULT '',
    version                     INTEGER      NOT NULL DEFAULT 1,
    updated_by_user_id            BIGINT       REFERENCES users(id),
    created_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tournament_rule_documents_edition_type UNIQUE (tournament_edition_id, type)
);
