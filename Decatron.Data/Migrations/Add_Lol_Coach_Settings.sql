-- Coach de LoL, fase 2 (comentarios IA). Plan: .dev/plans/LOL_COACH_PLAN.md — 2026-09-20
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS lol_coach_settings (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    enabled            BOOLEAN NOT NULL DEFAULT FALSE,
    coach_name         VARCHAR(40) NOT NULL DEFAULT 'Coach',
    tone               VARCHAR(20) NOT NULL DEFAULT 'analyst',
    comment_picks      BOOLEAN NOT NULL DEFAULT TRUE,
    post_game_summary  BOOLEAN NOT NULL DEFAULT TRUE,
    show_on_overlay    BOOLEAN NOT NULL DEFAULT TRUE,
    champ_pool         VARCHAR(400) NOT NULL DEFAULT '',
    notes              VARCHAR(600) NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lol_coach_settings OWNER TO decatron_user;
ALTER SEQUENCE lol_coach_settings_id_seq OWNER TO decatron_user;
