using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Platforms.Kick;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Platforms
{
    /// <summary>
    /// El resto del bot (todos los comandos) recibe un solo IMessageSender via DI —
    /// hasta ahora, siempre <see cref="MessageSenderService"/> (Twitch). Con dos
    /// plataformas reales, alguien tiene que decidir a cual mandar cada mensaje.
    /// Este es ese "alguien" — el resto del codigo no se entera de que existe.
    /// Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.8.
    /// </summary>
    public class MessageSenderRouter : IMessageSender
    {
        private readonly MessageSenderService _twitchSender;
        private readonly KickConnector _kickConnector;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<MessageSenderRouter> _logger;

        public MessageSenderRouter(
            MessageSenderService twitchSender,
            KickConnector kickConnector,
            IServiceScopeFactory scopeFactory,
            ILogger<MessageSenderRouter> logger)
        {
            _twitchSender = twitchSender;
            _kickConnector = kickConnector;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task SendMessageAsync(string channel, string message)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            // channel es el kick_id numerico para canales de Kick (ver ChannelResolver),
            // el login para Twitch. Se resuelve contra la fila real en vez de adivinar
            // por forma del string, para no equivocarse con un login que sea todo numeros.
            var user = await db.Users
                .FirstOrDefaultAsync(u => u.Login == channel.ToLower() || u.KickId == channel);

            if (user?.KickId != null)
            {
                var accessToken = user.KickAccessToken;

                // Red de seguridad: el ciclo de background refresca cada 30 min con 1h de
                // margen, pero no es instantaneo. Si justo entra un mensaje con el token ya
                // vencido (o a punto), se intenta un refresh puntual acá en vez de mandarle a
                // Kick un token muerto y tragarse el error en silencio — que es lo que pasaba
                // antes de este cambio.
                var expiringSoon = user.KickTokenExpiration == null
                    || user.KickTokenExpiration.Value <= DateTime.UtcNow.AddMinutes(2);

                if (expiringSoon && !string.IsNullOrEmpty(user.KickRefreshToken))
                {
                    try
                    {
                        var kickRefreshService = scope.ServiceProvider.GetRequiredService<IKickTokenRefreshService>();
                        var refreshed = await kickRefreshService.RefreshUserTokenAsync(user);
                        accessToken = refreshed.KickAccessToken;
                    }
                    catch (KickTokenException ex)
                    {
                        _logger.LogWarning(ex,
                            "[MessageSenderRouter] No se pudo refrescar el token de Kick del canal {Channel} antes de enviar; el mensaje puede fallar",
                            channel);
                    }
                }

                await _kickConnector.SendMessageAsync(channel, message, accessToken, user.KickId);
                return;
            }

            await _twitchSender.SendMessageAsync(channel, message);
        }

        public void SendMessage(string channel, string message)
        {
            _ = SendMessageAsync(channel, message);
        }
    }
}
