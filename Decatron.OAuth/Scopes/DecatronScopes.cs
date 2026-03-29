namespace Decatron.OAuth.Scopes
{
    /// <summary>
    /// Información de un scope OAuth2
    /// </summary>
    public record ScopeInfo(
        string Name,
        string Description,
        string Category,
        bool RequiresVerification = false
    );

    /// <summary>
    /// Definición de todos los scopes disponibles en la API pública de Decatron.
    ///
    /// Nomenclatura:
    /// - read:*   → Lectura de datos
    /// - write:*  → Modificación de configuración
    /// - action:* → Acciones en tiempo real (start, pause, send, etc.)
    /// </summary>
    public static class DecatronScopes
    {
        // ═══════════════════════════════════════════════════════════════
        // LECTURA (read:*)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Ver información del perfil del usuario</summary>
        public const string ReadProfile = "read:profile";

        /// <summary>Ver estado actual del timer</summary>
        public const string ReadTimer = "read:timer";

        /// <summary>Ver lista de comandos configurados</summary>
        public const string ReadCommands = "read:commands";

        /// <summary>Ver configuración de alertas de eventos</summary>
        public const string ReadAlerts = "read:alerts";

        /// <summary>Ver sorteos activos e historial</summary>
        public const string ReadGiveaways = "read:giveaways";

        /// <summary>Ver metas configuradas y progreso</summary>
        public const string ReadGoals = "read:goals";

        /// <summary>Ver estadísticas y analytics</summary>
        public const string ReadAnalytics = "read:analytics";

        /// <summary>Ver configuración de sonidos</summary>
        public const string ReadSounds = "read:sounds";

        // ═══════════════════════════════════════════════════════════════
        // ESCRITURA (write:*)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Modificar configuración del timer</summary>
        public const string WriteTimer = "write:timer";

        /// <summary>Crear, editar y eliminar comandos</summary>
        public const string WriteCommands = "write:commands";

        /// <summary>Modificar configuración de alertas</summary>
        public const string WriteAlerts = "write:alerts";

        /// <summary>Crear y gestionar sorteos</summary>
        public const string WriteGiveaways = "write:giveaways";

        /// <summary>Crear y modificar metas</summary>
        public const string WriteGoals = "write:goals";

        /// <summary>Modificar configuración de sonidos</summary>
        public const string WriteSounds = "write:sounds";

        // ═══════════════════════════════════════════════════════════════
        // ACCIONES (action:*)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Controlar timer: start, pause, stop, reset</summary>
        public const string ActionTimer = "action:timer";

        /// <summary>Disparar alertas personalizadas</summary>
        public const string ActionAlerts = "action:alerts";

        /// <summary>Enviar mensajes al chat de Twitch</summary>
        public const string ActionChat = "action:chat";

        /// <summary>Iniciar/terminar sorteos, seleccionar ganadores</summary>
        public const string ActionGiveaway = "action:giveaway";

        /// <summary>Actualizar progreso de metas</summary>
        public const string ActionGoals = "action:goals";

        /// <summary>Reproducir sonidos en el overlay</summary>
        public const string ActionSounds = "action:sounds";

        // ═══════════════════════════════════════════════════════════════
        // CATÁLOGO COMPLETO DE SCOPES
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Diccionario con información completa de cada scope.
        /// Usado para mostrar en UI de autorización y documentación.
        /// </summary>
        public static readonly Dictionary<string, ScopeInfo> All = new()
        {
            // ─── LECTURA ───────────────────────────────────────────────
            [ReadProfile] = new(
                "Perfil",
                "Ver tu información de perfil (nombre, avatar)",
                "read"
            ),
            [ReadTimer] = new(
                "Timer",
                "Ver el estado actual del timer (tiempo, configuración)",
                "read"
            ),
            [ReadCommands] = new(
                "Comandos",
                "Ver la lista de comandos configurados",
                "read"
            ),
            [ReadAlerts] = new(
                "Alertas",
                "Ver configuración de alertas de eventos",
                "read"
            ),
            [ReadGiveaways] = new(
                "Sorteos",
                "Ver sorteos activos e historial",
                "read"
            ),
            [ReadGoals] = new(
                "Metas",
                "Ver metas configuradas y su progreso",
                "read"
            ),
            [ReadAnalytics] = new(
                "Analytics",
                "Ver estadísticas y métricas del canal",
                "read"
            ),
            [ReadSounds] = new(
                "Sonidos",
                "Ver configuración de alertas de sonido",
                "read"
            ),

            // ─── ESCRITURA ─────────────────────────────────────────────
            [WriteTimer] = new(
                "Timer",
                "Modificar la configuración del timer",
                "write"
            ),
            [WriteCommands] = new(
                "Comandos",
                "Crear, editar y eliminar comandos",
                "write"
            ),
            [WriteAlerts] = new(
                "Alertas",
                "Modificar configuración de alertas",
                "write"
            ),
            [WriteGiveaways] = new(
                "Sorteos",
                "Crear y gestionar sorteos",
                "write"
            ),
            [WriteGoals] = new(
                "Metas",
                "Crear y modificar metas",
                "write"
            ),
            [WriteSounds] = new(
                "Sonidos",
                "Modificar configuración de sonidos",
                "write"
            ),

            // ─── ACCIONES ──────────────────────────────────────────────
            [ActionTimer] = new(
                "Timer",
                "Controlar el timer (iniciar, pausar, detener)",
                "action"
            ),
            [ActionAlerts] = new(
                "Alertas",
                "Disparar alertas personalizadas en tu stream",
                "action"
            ),
            [ActionChat] = new(
                "Chat",
                "Enviar mensajes al chat de Twitch en tu nombre",
                "action",
                RequiresVerification: true  // Scope sensible
            ),
            [ActionGiveaway] = new(
                "Sorteos",
                "Iniciar sorteos y seleccionar ganadores",
                "action"
            ),
            [ActionGoals] = new(
                "Metas",
                "Actualizar el progreso de las metas",
                "action"
            ),
            [ActionSounds] = new(
                "Sonidos",
                "Reproducir sonidos en el overlay",
                "action"
            ),
        };

        // ═══════════════════════════════════════════════════════════════
        // SCOPES AGRUPADOS POR CATEGORÍA (para UI)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Todos los scopes de lectura</summary>
        public static readonly string[] ReadScopes = new[]
        {
            ReadProfile, ReadTimer, ReadCommands, ReadAlerts,
            ReadGiveaways, ReadGoals, ReadAnalytics, ReadSounds
        };

        /// <summary>Todos los scopes de escritura</summary>
        public static readonly string[] WriteScopes = new[]
        {
            WriteTimer, WriteCommands, WriteAlerts,
            WriteGiveaways, WriteGoals, WriteSounds
        };

        /// <summary>Todos los scopes de acción</summary>
        public static readonly string[] ActionScopes = new[]
        {
            ActionTimer, ActionAlerts, ActionChat,
            ActionGiveaway, ActionGoals, ActionSounds
        };

        /// <summary>Scopes que requieren verificación de la app</summary>
        public static readonly string[] VerificationRequiredScopes = new[]
        {
            ActionChat  // Enviar mensajes al chat es sensible
        };

        // ═══════════════════════════════════════════════════════════════
        // MÉTODOS DE VALIDACIÓN
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Verifica si un scope es válido
        /// </summary>
        public static bool IsValid(string scope) => All.ContainsKey(scope);

        /// <summary>
        /// Verifica si todos los scopes son válidos
        /// </summary>
        public static bool AreValid(IEnumerable<string> scopes) => scopes.All(IsValid);

        /// <summary>
        /// Filtra solo los scopes válidos de una lista
        /// </summary>
        public static string[] FilterValid(IEnumerable<string> scopes) =>
            scopes.Where(IsValid).ToArray();

        /// <summary>
        /// Verifica si algún scope requiere verificación de la app
        /// </summary>
        public static bool RequiresVerification(IEnumerable<string> scopes) =>
            scopes.Any(s => VerificationRequiredScopes.Contains(s));

        /// <summary>
        /// Obtiene los scopes organizados por categoría para mostrar en UI
        /// </summary>
        public static Dictionary<string, List<(string Scope, ScopeInfo Info)>> GetGroupedByCategory()
        {
            return All
                .GroupBy(kvp => kvp.Value.Category)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(kvp => (kvp.Key, kvp.Value)).ToList()
                );
        }

        /// <summary>
        /// Parsea un string de scopes separados por espacios
        /// </summary>
        public static string[] Parse(string scopeString)
        {
            if (string.IsNullOrWhiteSpace(scopeString))
                return Array.Empty<string>();

            return scopeString
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Distinct()
                .ToArray();
        }

        /// <summary>
        /// Une un array de scopes en un string separado por espacios
        /// </summary>
        public static string Join(IEnumerable<string> scopes) =>
            string.Join(" ", scopes);
    }
}
