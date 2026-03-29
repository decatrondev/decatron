-- Migration: Add canvas resolution to timer_configs
-- Date: 2026-01-07
-- Description: Add canvas_width and canvas_height columns to store custom overlay resolution per streamer

ALTER TABLE timer_configs
    ADD COLUMN IF NOT EXISTS canvas_width INT NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS canvas_height INT NOT NULL DEFAULT 300;

COMMENT ON COLUMN timer_configs.canvas_width IS 'Width of the overlay canvas in pixels (customizable per streamer)';
COMMENT ON COLUMN timer_configs.canvas_height IS 'Height of the overlay canvas in pixels (customizable per streamer)';
