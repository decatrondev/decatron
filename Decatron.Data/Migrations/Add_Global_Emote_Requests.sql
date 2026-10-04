-- Solicitudes de acceso para manejar los emotes globales: la persona la envía, el owner la aprueba o rechaza.
CREATE TABLE IF NOT EXISTS global_emote_requests (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    login       VARCHAR(100) NOT NULL,
    message     VARCHAR(300),
    status      VARCHAR(10) NOT NULL DEFAULT 'pending',
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_global_emote_request_status CHECK (status IN ('pending', 'approved', 'rejected'))
);
-- Una sola solicitud pendiente por persona
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_emote_requests_pending ON global_emote_requests (login) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_global_emote_requests_status ON global_emote_requests (status, created_at DESC);

ALTER TABLE global_emote_requests OWNER TO decatron_user;
ALTER SEQUENCE global_emote_requests_id_seq OWNER TO decatron_user;
