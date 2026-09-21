-- Unificacion de Sound Alerts en la galeria de medios compartida (8 ago 2026).
-- Ver plan en .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md.
--
-- sound_alert_reward_files es la tabla de mapeo "esta recompensa de este canal
-- dispara este archivo", separada del archivo en si (que ahora vive en
-- timer_media_files, la galeria compartida con Timer/Event Alerts/Goals/Discord).
-- Reemplaza a sound_alert_files, que NO se borra en este pase (queda como
-- respaldo reversible, se limpia en un pase aparte una vez estable).

BEGIN;

CREATE TABLE sound_alert_reward_files (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    reward_id VARCHAR(100) NOT NULL,
    reward_title VARCHAR(200) NOT NULL DEFAULT '',
    media_file_id INTEGER REFERENCES timer_media_files(id) ON DELETE SET NULL,
    system_file_path VARCHAR(500),
    volume INTEGER,
    enabled BOOLEAN NOT NULL DEFAULT true,
    image_path VARCHAR(500),
    image_name VARCHAR(255),
    show_image BOOLEAN NOT NULL DEFAULT true,
    image_url VARCHAR(1000),
    image_source VARCHAR(20) NOT NULL DEFAULT 'upload',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sound_alert_reward_files_userid_reward UNIQUE (user_id, reward_id),
    CONSTRAINT chk_sound_alert_reward_files_exactly_one_source
        CHECK ((media_file_id IS NOT NULL)::int + (system_file_path IS NOT NULL)::int = 1)
);

CREATE INDEX idx_sound_alert_reward_files_media_file ON sound_alert_reward_files(media_file_id);

-- Backfill 1: archivos subidos por el streamer -> entran a timer_media_files
-- (categoria "sound-alerts") + su mapping. Se queda con el mismo file_path
-- fisico (no se mueve nada), usage_count=1 porque ya esta en uso por esta
-- recompensa.
WITH inserted_media AS (
    INSERT INTO timer_media_files (
        channel_name, user_id, file_type, file_path, original_file_name,
        file_name, category, file_size, duration_seconds, usage_count,
        uploaded_at, created_at
    )
    SELECT
        saf.username,
        saf.user_id,
        saf.file_type,
        saf.file_path,
        saf.file_name,
        saf.file_name,
        'sound-alerts',
        saf.file_size,
        saf.duration_seconds,
        1,
        saf.created_at,
        saf.created_at
    FROM sound_alert_files saf
    WHERE saf.is_system_file = false
    RETURNING id, user_id, file_path
)
INSERT INTO sound_alert_reward_files (
    user_id, reward_id, reward_title, media_file_id, system_file_path,
    volume, enabled, image_path, image_name, show_image, image_url,
    image_source, created_at, updated_at
)
SELECT
    saf.user_id,
    saf.reward_id,
    saf.reward_title,
    im.id,
    NULL,
    saf.volume,
    saf.enabled,
    saf.image_path,
    saf.image_name,
    saf.show_image,
    saf.image_url,
    saf.image_source,
    saf.created_at,
    saf.updated_at
FROM sound_alert_files saf
JOIN inserted_media im ON im.user_id = saf.user_id AND im.file_path = saf.file_path
WHERE saf.is_system_file = false;

-- Backfill 2: archivos de sistema -> solo el mapping, sin fila de media (no
-- son de nadie, siguen siendo un escaneo del filesystem).
INSERT INTO sound_alert_reward_files (
    user_id, reward_id, reward_title, media_file_id, system_file_path,
    volume, enabled, image_path, image_name, show_image, image_url,
    image_source, created_at, updated_at
)
SELECT
    saf.user_id,
    saf.reward_id,
    saf.reward_title,
    NULL,
    saf.file_path,
    saf.volume,
    saf.enabled,
    saf.image_path,
    saf.image_name,
    saf.show_image,
    saf.image_url,
    saf.image_source,
    saf.created_at,
    saf.updated_at
FROM sound_alert_files saf
WHERE saf.is_system_file = true;

COMMIT;
