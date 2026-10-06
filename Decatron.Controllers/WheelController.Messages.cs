using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services;
using Decatron.Core.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>Mensajes de chat de la rueda. Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        // ====================================================================
        // MENSAJES DE CHAT
        // ====================================================================

        /// <summary>
        /// Los textos del chat: lo que el streamer escribió, la base de Decatron para
        /// comparar, y qué variable acepta cada mensaje.
        ///
        /// <para>Se mandan las tres cosas juntas porque el panel las necesita a la vez:
        /// el campo vacío tiene que mostrar la base como marcador, y las variables se
        /// listan al lado para no tener que adivinarlas.</para>
        /// </summary>
        [HttpGet("wheels/{id:int}/messages")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetMessages(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var propios = WheelMessages.Keys.ToDictionary(k => k, k => new
                {
                    es = WheelMessages.Custom(wheel.AnnounceConfig, k, "es"),
                    en = WheelMessages.Custom(wheel.AnnounceConfig, k, "en"),
                });

                return Ok(new
                {
                    success = true,
                    messages = propios,
                    defaults = WheelMessages.AllDefaults(),
                    placeholders = WheelMessages.Placeholders,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error leyendo mensajes de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("wheels/{id:int}/messages")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveMessages(int id, [FromBody] Dictionary<string, MessageDto> dtos)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var chat = new Dictionary<string, object>();
                foreach (var (clave, dto) in dtos ?? new Dictionary<string, MessageDto>())
                {
                    if (!WheelMessages.Keys.Contains(clave)) continue;

                    var es = dto?.Es?.Trim();
                    var en = dto?.En?.Trim();

                    // Un texto vacío no se guarda: la ausencia es lo que hace volver a la
                    // base de Decatron, así que borrar el campo es cómo se restaura.
                    if (string.IsNullOrWhiteSpace(es) && string.IsNullOrWhiteSpace(en)) continue;

                    if ((es?.Length ?? 0) > 400 || (en?.Length ?? 0) > 400)
                        return BadRequest(new { success = false, message = "Un mensaje de chat no puede pasar de 400 caracteres" });

                    chat[clave] = new { es, en };
                }

                // Se conserva lo que announce_config tenga fuera de "chat" (los textos del
                // overlay viven en el mismo jsonb).
                var raiz = new Dictionary<string, object>();
                if (!string.IsNullOrWhiteSpace(wheel.AnnounceConfig))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(wheel.AnnounceConfig);
                        foreach (var prop in doc.RootElement.EnumerateObject())
                            if (prop.Name != "chat")
                                raiz[prop.Name] = JsonSerializer.Deserialize<JsonElement>(prop.Value.GetRawText());
                    }
                    catch { /* config ilegible: se reemplaza entera */ }
                }
                raiz["chat"] = chat;

                await _wheels.UpdateWheelAsync(channelId, id, w => w.AnnounceConfig = JsonSerializer.Serialize(raiz));
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error guardando mensajes de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
