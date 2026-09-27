-- Modulo de Torneos — Fortnite F4: reporte de resultados con pruebas (27-09-2026).
-- Ver .dev/torneos/15-fortnite.md. Se corre a mano contra Postgres como el resto
-- de Decatron.Data/Migrations/*.sql. Idempotente.
--
-- Cada jugador reporta el puesto de su equipo y SUS eliminaciones, con captura. El
-- resultado oficial del equipo (lo que suma puntos) lo aprueba el organizador. Toda
-- carga o correccion del organizador a nombre de otro lleva motivo y justificante,
-- y queda en un historial visible para los participantes.

BEGIN;

-- Reglas de pruebas por edicion.
ALTER TABLE tournament_fortnite_configs
    -- always = captura obligatoria | on_conflict = solo si hay algo raro | staff_only = carga el organizador
    ADD COLUMN IF NOT EXISTS proof_mode            VARCHAR(20) NOT NULL DEFAULT 'always',
    -- Minutos para reportar desde que termina la partida.
    ADD COLUMN IF NOT EXISTS report_window_minutes INTEGER     NOT NULL DEFAULT 30,
    -- true = el equipo que no reporta suma 0 al cerrar la partida.
    ADD COLUMN IF NOT EXISTS missing_report_zero   BOOLEAN     NOT NULL DEFAULT TRUE;

-- Archivos privados (capturas y justificantes). Se guardan fuera del sitio publico
-- y solo se sirven por la API a quien tiene permiso.
CREATE TABLE IF NOT EXISTS tournament_fortnite_files (
    id                     BIGSERIAL PRIMARY KEY,
    tournament_edition_id  BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    file_name              VARCHAR(80)  NOT NULL,
    content_type           VARCHAR(40)  NOT NULL,
    -- screenshot | evidence
    kind                   VARCHAR(20)  NOT NULL,
    uploaded_by_user_id    BIGINT       NOT NULL,
    created_at             TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_fortnite_files_edition ON tournament_fortnite_files (tournament_edition_id);

-- Reporte de cada jugador en cada partida.
CREATE TABLE IF NOT EXISTS tournament_fortnite_reports (
    id                BIGSERIAL PRIMARY KEY,
    game_id           BIGINT     NOT NULL REFERENCES tournament_fortnite_games(id) ON DELETE CASCADE,
    participant_id    BIGINT     NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
    team_id           BIGINT     REFERENCES tournament_teams(id) ON DELETE SET NULL,
    placement         SMALLINT   NOT NULL,
    eliminations      SMALLINT   NOT NULL,
    screenshot_file_id BIGINT    REFERENCES tournament_fortnite_files(id) ON DELETE SET NULL,
    submitted_at      TIMESTAMP  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP  NOT NULL DEFAULT NOW(),
    UNIQUE (game_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_fortnite_reports_team ON tournament_fortnite_reports (game_id, team_id);

-- Resultado oficial de cada equipo en cada partida.
CREATE TABLE IF NOT EXISTS tournament_fortnite_results (
    id                  BIGSERIAL PRIMARY KEY,
    game_id             BIGINT      NOT NULL REFERENCES tournament_fortnite_games(id) ON DELETE CASCADE,
    team_id             BIGINT      NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    -- NULL cuando no hay puesto (rechazado o sin reporte)
    placement           SMALLINT,
    eliminations        SMALLINT    NOT NULL DEFAULT 0,
    -- approved = suma puntos | rejected = 0 puntos | no_report = 0 puntos por no reportar
    status              VARCHAR(20) NOT NULL,
    -- players = aprobado tal cual lo reportaron | staff = cargado o corregido por el organizador | auto = sin reporte al cerrar
    source              VARCHAR(20) NOT NULL,
    reviewed_by_user_id BIGINT,
    reviewed_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (game_id, team_id)
);

-- Historial de lo que hizo el organizador con cada resultado.
CREATE TABLE IF NOT EXISTS tournament_fortnite_result_audit (
    id                     BIGSERIAL PRIMARY KEY,
    tournament_edition_id  BIGINT       NOT NULL REFERENCES tournament_editions(id) ON DELETE CASCADE,
    game_id                BIGINT       NOT NULL REFERENCES tournament_fortnite_games(id) ON DELETE CASCADE,
    team_id                BIGINT       NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    -- approve | staff_load | correct | reject | no_report
    action                 VARCHAR(20)  NOT NULL,
    actor_user_id          BIGINT,
    actor_name             VARCHAR(100) NOT NULL DEFAULT '',
    -- {"placement":3,"eliminations":5,"status":"approved"} o NULL
    before_json            JSONB,
    after_json             JSONB,
    reason                 TEXT,
    evidence_file_ids      BIGINT[]     NOT NULL DEFAULT '{}',
    created_at             TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_fortnite_result_audit_edition ON tournament_fortnite_result_audit (tournament_edition_id, created_at);

ALTER TABLE tournament_fortnite_files OWNER TO decatron_user;
ALTER TABLE tournament_fortnite_reports OWNER TO decatron_user;
ALTER TABLE tournament_fortnite_results OWNER TO decatron_user;
ALTER TABLE tournament_fortnite_result_audit OWNER TO decatron_user;

COMMIT;
