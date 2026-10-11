using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace Decatron.Hubs
{
    /// <summary>
    /// Aviso en vivo para la extensión del espectador: cuando cambia un emote propio de un canal o uno global
    /// (se sube, aprueba, oculta, borra o cambia su ancho), el servidor manda <c>EmotesChanged</c> y la extensión
    /// vuelve a pedir su diccionario al instante, sin esperar su ciclo ni un F5. Anónimo a propósito, igual que
    /// <see cref="TranslationHub"/>; no lleva datos, solo el aviso. Grupos: <c>emotes:{login}</c> y <c>emotes:all</c>.
    /// </summary>
    public class EmotesHub : Hub
    {
        public const string AllGroup = "emotes:all";
        public static string GroupName(string login) => $"emotes:{login.ToLowerInvariant()}";

        private static readonly ConcurrentDictionary<string, string> _watching = new();

        /// <summary>La pestaña ve el chat de este canal (cambia de canal sin cerrar la conexión)</summary>
        public async Task<bool> Watch(string login)
        {
            login = (login ?? "").Trim().ToLowerInvariant();
            if (login.Length is 0 or > 40) return false;

            if (_watching.TryGetValue(Context.ConnectionId, out var previous) && previous != login)
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(previous));

            _watching[Context.ConnectionId] = login;
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(login));
            await Groups.AddToGroupAsync(Context.ConnectionId, AllGroup);
            return true;
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            _watching.TryRemove(Context.ConnectionId, out _);
            return base.OnDisconnectedAsync(exception);
        }
    }
}
