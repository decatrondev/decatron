using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>Entrega de premios: un handler por tipo del catálogo y la bandeja de pendientes. Parte de <see cref="WheelService"/>.</summary>
    public partial class WheelService
    {
        /// <summary>Lo que dejó la entrega de un premio, para el chat y para el log.</summary>
        public class PrizeDelivery
        {
            /// <summary>Coins efectivamente entregados (solo el premio <c>coins</c>).</summary>
            public int Coins { get; init; }

            /// <summary>El premio quedó en la bandeja del streamer.</summary>
            public bool Pending { get; init; }

            /// <summary>Por qué quedó pendiente. Se guarda en la bandeja.</summary>
            public string? PendingReason { get; init; }
        }

        /// <summary>
        /// Entrega el premio del gajo. Un tipo por handler; el catálogo es modular
        /// (sección 5.3 del plan) y agregar uno nuevo es agregar un <c>case</c>.
        ///
        /// <para>Un premio que no se puede entregar <b>nunca</b> rompe el giro
        /// (sección 6.3): la rueda ya giró en pantalla y el espectador ya pagó. Cuando
        /// la integración no está disponible el premio va a la bandeja de entregas
        /// pendientes con el motivo, que es lo único que le permite al streamer
        /// cumplirlo a mano.</para>
        /// </summary>
        private async Task<PrizeDelivery> EntregarPremioAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string? prizeJson)
        {
            if (string.IsNullOrWhiteSpace(prizeJson)) return new PrizeDelivery();

            try
            {
                using var doc = JsonDocument.Parse(prizeJson);
                var root = doc.RootElement;
                if (!root.TryGetProperty("type", out var tipoProp)) return new PrizeDelivery();

                var tipo = tipoProp.GetString();
                var pars = root.TryGetProperty("params", out var p) ? p : default;

                return tipo switch
                {
                    // RETIRADO: este premio acuñaba deca coins —la moneda que vende la plataforma— con
                    // `GiveCoinsAsync` (la funcion de regalo de admin, que no le quita nada a nadie), asi que
                    // cualquier streamer podia fabricarlos. Ya no se puede crear (SaveSegments lo rechaza) y,
                    // si llegara un gajo viejo, no se entrega nada y queda el aviso en el log.
                    WheelPrizeTypes.Coins         => PremioRetirado(wheel, viewerLogin, "coins"),
                    WheelPrizeTypes.FreeSpin      => await EntregarFreeSpinAsync(wheel, viewerLogin, pars),
                    WheelPrizeTypes.GachaPull     => await EntregarGachaPullAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.TimerTime     => await EntregarTimerTimeAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.Timeout       => await EntregarTimeoutAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.SoundAlert    => await EntregarSoundAlertAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    WheelPrizeTypes.ManualMessage => await EntregarManualAsync(wheel, channelLogin, viewerLogin, spinId, prizeJson, pars),
                    _                             => new PrizeDelivery(),   // "nothing" y cualquier tipo que no conozcamos
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error entregando el premio de {Viewer} en '{Rueda}'", viewerLogin, wheel.Name);
                await MarcarPendienteAsync(wheel, viewerLogin, spinId, prizeJson, "Error al entregar el premio");
                return new PrizeDelivery { Pending = true, PendingReason = "Error al entregar el premio" };
            }
        }

        // --------------------------------------------------------------------
        // Los handlers, uno por tipo del catálogo
        // --------------------------------------------------------------------

        private PrizeDelivery PremioRetirado(Wheel wheel, string viewerLogin, string tipo)
        {
            _logger.LogWarning("🎡 [Rueda] '{Rueda}': el premio '{Tipo}' esta retirado y no se entrego a {Viewer}",
                wheel.Name, tipo, viewerLogin);
            return new PrizeDelivery();
        }

        /// <summary>
        /// Giros gratis: se acreditan como créditos, no como un giro inmediato.
        ///
        /// <para>Encadenar un giro dentro de otro haría que la rueda se dispare sola en
        /// pantalla mientras el espectador todavía está viendo el primero, y con un gajo
        /// de free_spin en la propia rueda sería un bucle. Acreditando, el espectador
        /// gira cuando quiera y todos los topes (cooldown, tope por stream) se siguen
        /// aplicando.</para>
        /// </summary>
        private async Task<PrizeDelivery> EntregarFreeSpinAsync(Wheel wheel, string viewerLogin, JsonElement pars)
        {
            var cantidad = Math.Max(1, LeerInt(pars, "count", 1));

            // Por defecto los giros son de esta misma rueda; el streamer puede regalar
            // giros de otra suya (una rueda "premium", por ejemplo).
            var destinoId = LeerInt(pars, "wheel_id", 0);
            var precio = wheel.SpinPrice;

            if (destinoId > 0 && destinoId != wheel.Id)
            {
                var otra = await _db.Wheels.AsNoTracking()
                    .FirstOrDefaultAsync(w => w.Id == destinoId && w.ChannelId == wheel.ChannelId);
                if (otra != null) precio = otra.SpinPrice;
            }

            // La billetera es por canal, no por rueda: lo que cambia entre ruedas es el
            // precio, así que "N giros" se traduce a N veces el precio de la rueda destino.
            var creditos = cantidad * Math.Max(1, precio);
            await _wallets.GrantCreditsAsync(wheel.ChannelId, viewerLogin, creditos);

            _logger.LogInformation("🎡 [Rueda] {Viewer} ganó {Giros} giro(s) gratis en '{Rueda}' (+{Creditos} créditos)",
                viewerLogin, cantidad, wheel.Name, creditos);

            return new PrizeDelivery();
        }

        /// <summary>
        /// Tiros de gachapón. No dispara el tiro: le deja los tiros disponibles al
        /// espectador para que los use cuando quiera, que es como funciona el gachapón
        /// en el resto del bot.
        /// </summary>
        private async Task<PrizeDelivery> EntregarGachaPullAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var cantidad = Math.Max(1, LeerInt(pars, "count", 1));
            // Los tiros de la Rueda SIEMPRE van a la billetera bonus. Antes el streamer podia elegir
            // "de coins": regalar tiros del contador que el espectador llena gastando deca coins, o sea
            // lo que la plataforma vende. Un `pull_type` viejo en el gajo se ignora.

            // Sin items configurados el tiro no puede resolverse nunca, así que el
            // premio va a la bandeja en vez de quedar como un saldo que da error.
            var hayItems = await _db.GachaItems.AnyAsync(i => i.ChannelName == channelLogin && i.Available);
            if (!hayItems)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "El gachapón del canal no tiene items disponibles");

            var participante = await _db.GachaParticipants
                .FirstOrDefaultAsync(g => g.ChannelName == channelLogin && g.Name.ToLower() == viewerLogin);

            if (participante == null)
            {
                participante = new Decatron.Core.Models.Gacha.GachaParticipant
                {
                    ChannelName = channelLogin,
                    UserId = wheel.ChannelId,
                    Name = viewerLogin,
                    DisplayName = viewerLogin,
                };
                _db.GachaParticipants.Add(participante);
            }

            // Los tiros de la rueda no son dinero: van a la billetera bonus para no
            // inflar el monto donado ni los hitos por acumulado del gachapón.
            participante.BonusPullsAvailable += cantidad;

            participante.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation("🎡 [Rueda] {Viewer} ganó {Tiros} tiro(s) de gachapón (bonus) en '{Rueda}'",
                viewerLogin, cantidad, wheel.Name);

            return new PrizeDelivery();
        }

        /// <summary>
        /// Suma segundos al timer extensible. Solo si el timer está corriendo o en
        /// pausa: sumarle tiempo a un timer detenido no se ve en ningún lado y el
        /// espectador creería que su premio se perdió.
        /// </summary>
        private async Task<PrizeDelivery> EntregarTimerTimeAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var segundos = LeerInt(pars, "seconds", 0);
            if (segundos <= 0) return new PrizeDelivery();

            var estado = await _db.TimerStates.FirstOrDefaultAsync(s2 => s2.ChannelName == channelLogin);
            if (estado == null || (estado.Status != "running" && estado.Status != "paused"))
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "El timer del canal no está activo");

            estado.CurrentTime += segundos;
            estado.TotalTime += segundos;
            estado.UpdatedAt = DateTime.UtcNow;

            if (estado.CurrentSessionId.HasValue)
            {
                var sesion = await _db.TimerSessions.FindAsync(estado.CurrentSessionId.Value);
                if (sesion != null) sesion.TotalAddedTime += segundos;

                _db.TimerEventLogs.Add(new Decatron.Core.Models.TimerEventLog
                {
                    ChannelName = channelLogin,
                    EventType = "wheel",
                    Username = viewerLogin,
                    TimeAdded = segundos,
                    Details = $"Rueda de la Suerte: {wheel.Name}",
                    TimerSessionId = estado.CurrentSessionId,
                    CreatedAt = DateTime.UtcNow,
                    OccurredAt = TimerDateTimeHelper.NowForDb(),
                });
            }

            await _db.SaveChangesAsync();
            await _overlays.SendAddTimeAsync(channelLogin, segundos);

            _logger.LogInformation("🎡 [Rueda] {Viewer} sumó {Segundos}s al timer de {Canal} desde '{Rueda}'",
                viewerLogin, segundos, channelLogin, wheel.Name);

            return new PrizeDelivery();
        }

        /// <summary>
        /// Timeout por gracia del gajo. Necesita que el bot sea moderador del canal;
        /// si no lo es la API de Twitch responde 401 y el premio queda en la bandeja
        /// como aviso, sin romper el giro (caso borde de la sección 13).
        /// </summary>
        private async Task<PrizeDelivery> EntregarTimeoutAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var segundos = LeerInt(pars, "seconds", 0);
            var objetivo = LeerString(pars, "target", "spinner");

            if (segundos <= 0 || objetivo == "none") return new PrizeDelivery();

            string? victima = objetivo == "spinner" ? viewerLogin : null;

            if (objetivo == "random_chatter")
            {
                var chatters = await _twitch.GetChattersAsync(channelLogin);

                // El streamer nunca: silenciar al dueño del canal por un gajo es
                // exactamente el accidente que nadie quiere en vivo.
                var elegibles = chatters
                    .Where(c => !string.Equals(c, channelLogin, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                if (elegibles.Count == 0)
                    return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "No había nadie en el chat para elegir");

                victima = elegibles[RandomNumberGenerator.GetInt32(elegibles.Count)];
            }

            if (victima == null) return new PrizeDelivery();

            var aplicado = await _twitch.TimeoutUserAsync(channelLogin, victima, segundos, $"Rueda de la Suerte: {wheel.Name}");
            if (!aplicado)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson,
                    $"No se pudo aplicar el timeout a {victima} (¿el bot es moderador?)");

            _logger.LogInformation("🎡 [Rueda] Timeout de {Segundos}s a {Victima} por el gajo de {Viewer} en '{Rueda}'",
                segundos, victima, viewerLogin, wheel.Name);

            return new PrizeDelivery();
        }

        /// <summary>
        /// Dispara una Sound Alert ya configurada del canal. El parámetro es el id de
        /// la alerta (la fila de <c>sound_alert_reward_files</c>), no el de la
        /// recompensa de Twitch: el streamer elige de una lista, no escribe un GUID.
        /// </summary>
        private async Task<PrizeDelivery> EntregarSoundAlertAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var alertaId = (long)LeerInt(pars, "sound_alert_id", 0);
            if (alertaId <= 0) return new PrizeDelivery();

            var alerta = await _db.SoundAlertRewardFiles
                .FirstOrDefaultAsync(m => m.Id == alertaId && m.UserId == wheel.ChannelId);

            if (alerta == null)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "La alerta de sonido ya no existe");

            if (!alerta.Enabled)
                return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "La alerta de sonido está desactivada");

            await _soundAlerts.TriggerAsync(new Decatron.Core.Interfaces.SoundAlertRedemption(
                ChannelUserId: wheel.ChannelId,
                OverlayGroupKey: channelLogin,
                RewardId: alerta.RewardId,
                RewardTitle: alerta.RewardTitle,
                RedeemerUsername: viewerLogin,
                RedeemerId: null,
                RedeemedAt: DateTimeOffset.UtcNow));

            return new PrizeDelivery();
        }

        /// <summary>
        /// Premio manual: publica el texto en el chat y deja la entrega en la bandeja
        /// para que el streamer la resuelva. Las dos cosas, no una: el anuncio es para
        /// el espectador y la bandeja es para que al streamer no se le pase.
        /// </summary>
        private async Task<PrizeDelivery> EntregarManualAsync(
            Wheel wheel, string channelLogin, string viewerLogin, long? spinId, string prizeJson, JsonElement pars)
        {
            var plantilla = LeerString(pars, "template", "");

            if (!string.IsNullOrWhiteSpace(plantilla))
            {
                var texto = plantilla
                    .Replace("{user}", viewerLogin)
                    .Replace("{wheel}", wheel.Name);

                try
                {
                    await _chat.SendMessageAsync(channelLogin, texto);
                }
                catch (Exception ex)
                {
                    // El chat caído no puede costarle el premio al espectador: la
                    // entrega pendiente de abajo se crea igual.
                    _logger.LogWarning(ex, "🎡 [Rueda] No se pudo anunciar el premio manual de {Viewer} en {Canal}",
                        viewerLogin, channelLogin);
                }
            }

            return await PendienteAsync(wheel, viewerLogin, spinId, prizeJson, "Premio manual: lo entrega el streamer");
        }

        // --------------------------------------------------------------------
        // Auxiliares de entrega
        // --------------------------------------------------------------------

        private async Task<PrizeDelivery> PendienteAsync(
            Wheel wheel, string viewerLogin, long? spinId, string? prizeJson, string motivo)
        {
            await MarcarPendienteAsync(wheel, viewerLogin, spinId, prizeJson, motivo);
            return new PrizeDelivery { Pending = true, PendingReason = motivo };
        }

        private async Task<long?> BuscarUserIdAsync(string viewerLogin) =>
            await _db.Users
                .Where(u => u.Login == viewerLogin.ToLowerInvariant())
                .Select(u => (long?)u.Id)
                .FirstOrDefaultAsync();

        private static int LeerInt(JsonElement pars, string nombre, int porDefecto)
        {
            if (pars.ValueKind != JsonValueKind.Object) return porDefecto;
            if (!pars.TryGetProperty(nombre, out var v)) return porDefecto;

            return v.ValueKind switch
            {
                JsonValueKind.Number => v.TryGetInt32(out var n) ? n : porDefecto,
                // El panel manda números, pero un premio escrito a mano por la API
                // puede traerlos como texto y no vale la pena perder el premio por eso.
                JsonValueKind.String => int.TryParse(v.GetString(), out var t) ? t : porDefecto,
                _ => porDefecto,
            };
        }
    }
}
