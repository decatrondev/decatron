-- Gestión de Accesos — accesos ocultos ("vanish") y alias
--
-- Hasta ahora la lista "Usuarios con Acceso" era plana: cualquiera con control_total
-- veía a todos los demás con su login real. Algunos streamers quieren dar acceso a
-- alguien (un dev, soporte) sin que el resto de su equipo lo sepa, o mostrándolo con
-- un nombre genérico.
--
-- Las dos columnas las controla SOLO el dueño del canal (se valida en SettingsController):
--   is_hidden: la fila la ven únicamente el dueño y el propio usuario. Los permisos
--              reales no cambian en nada.
--   alias:     lo que ven los demás en vez del nombre/login real. null = nombre real.
--
-- Todo lo existente queda visible y sin alias.

ALTER TABLE user_channel_permissions
    ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS alias varchar(30) NULL;

COMMENT ON COLUMN user_channel_permissions.is_hidden IS
    'Acceso oculto: solo lo ven el dueño del canal y el propio usuario. Solo el dueño lo edita.';
COMMENT ON COLUMN user_channel_permissions.alias IS
    'Nombre que ven otros usuarios con acceso en vez del login real. null = nombre real.';
