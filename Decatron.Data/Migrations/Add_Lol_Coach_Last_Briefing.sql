-- Coach de LoL: el briefing de inicio se recuerda en la base. 2026-09-23
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
-- Antes vivía en memoria y cada reinicio del backend lo repetía, sin contar las partidas ya jugadas.
ALTER TABLE lol_coach_settings
    ADD COLUMN IF NOT EXISTS last_briefing_at TIMESTAMP WITH TIME ZONE NULL;

-- Al desplegar, nadie recibe otro briefing por el reinicio: cuenta como dado ahora.
-- OJO: el backend corre con Npgsql.EnableLegacyTimestampBehavior y guarda DateTime.UtcNow como
-- hora local (la hora UTC etiquetada -05). Un NOW() a secas queda 5 h "atrás" para la app y el
-- briefing se repetía. Hay que escribir la hora UTC con la etiqueta local, igual que la app.
UPDATE lol_coach_settings SET last_briefing_at = (NOW() AT TIME ZONE 'UTC') WHERE last_briefing_at IS NULL;
