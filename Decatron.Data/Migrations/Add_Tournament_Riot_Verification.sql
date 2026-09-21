-- Verificacion real de propiedad de cuenta de Riot (metodo del icono de invocador,
-- ver .dev/torneos/03-riot-api-integracion.md #2) + inscripcion autenticada:
-- el participante se loguea con su propia cuenta de Twitch de la plataforma
-- (misma sesion que /login, no la del dueno del canal) y linkea su Riot ID desde
-- su propio panel, en vez de que el organizador cargue todo a mano.
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS riot_verification_challenge_icon_id INTEGER;
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS riot_verification_started_at TIMESTAMPTZ;
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS riot_verified_at TIMESTAMPTZ;
