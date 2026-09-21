-- ============================================================
-- Fortnite Spirit Tracker — Notificaciones de sprites nuevos
-- released_at: momento real en que un sprite paso a released (distinto de
-- created_at, que es cuando se cargo al catalogo, a veces meses antes como
-- unreleased). Es el marcador que compara cada usuario contra su ultimo aviso.
-- ============================================================

ALTER TABLE fortnite_sprites ADD COLUMN IF NOT EXISTS released_at TIMESTAMP;

-- Backfill: los que ya estan released hoy, se toman como "liberados" a su
-- created_at (no sabemos el momento real historico, y asi no dispara avisos
-- masivos retroactivos la primera vez que corra la notificacion).
UPDATE fortnite_sprites
SET released_at = created_at
WHERE is_unreleased = false AND released_at IS NULL;

CREATE TABLE IF NOT EXISTS user_spirit_notification_prefs (
    id                          BIGSERIAL PRIMARY KEY,
    user_id                     BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    notify_twitch_chat          BOOLEAN NOT NULL DEFAULT false,
    notify_discord_dm           BOOLEAN NOT NULL DEFAULT false,
    last_notified_twitch_at     TIMESTAMP,
    last_notified_discord_at    TIMESTAMP,
    last_seen_dashboard_at      TIMESTAMP,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);
