namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Enganche para copiar a la otra plataforma lo que se cambió en Twitch. TitleUtils y GameUtils (que usan todas las copias de
    /// !title, !game, !g y los micro comandos de Twitch) lo llaman al cambiar con éxito; lo conecta ChannelSyncService al arrancar.
    /// </summary>
    public static class ChannelSyncHooks
    {
        /// <summary>(twitchId, nuevo título)</summary>
        public static Func<string, string, Task>? TitleChanged { get; set; }

        /// <summary>(twitchId, nombre real de la categoría)</summary>
        public static Func<string, string, Task>? CategoryChanged { get; set; }

        /// <summary>true mientras ChannelSyncService escribe en Twitch por otra plataforma: evita que el cambio rebote.</summary>
        public static readonly AsyncLocal<bool> Mirroring = new();

        /// <summary>Lanza el aviso sin bloquear a quien cambió el título o la categoría; un fallo aquí nunca afecta al comando.</summary>
        public static void Fire(Func<string, string, Task>? hook, string twitchId, string value)
        {
            if (hook == null || Mirroring.Value) return;
            _ = Task.Run(async () =>
            {
                try { await hook(twitchId, value); }
                catch { /* el espejo registra sus propios errores */ }
            });
        }
    }
}
