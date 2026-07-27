-- !watchtime debe responder sin importar si el stream está en vivo o no (default cambia a desactivado)
-- 2026-07-22

ALTER TABLE watchtime_command_configs ALTER COLUMN only_when_live SET DEFAULT FALSE;

UPDATE watchtime_command_configs SET only_when_live = FALSE WHERE only_when_live = TRUE;
