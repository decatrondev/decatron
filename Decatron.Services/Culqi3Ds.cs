using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using Decatron.Core.Models;

namespace Decatron.Services
{
    /// <summary>Lo que devuelve el banco cuando el titular se autentica (3D Secure); se reenvía tal cual a Culqi.</summary>
    public class Authentication3DsRequest
    {
        public string Eci { get; set; } = string.Empty;
        public string Xid { get; set; } = string.Empty;
        public string Cavv { get; set; } = string.Empty;
        public string ProtocolVersion { get; set; } = string.Empty;
        public string DirectoryServerTransactionId { get; set; } = string.Empty;
    }

    /// <summary>
    /// Piezas comunes de los cobros con Culqi (tiers, créditos, DecaCoins y donaciones) para el
    /// 3D Secure y para los datos del comprador que ve el antifraude.
    /// </summary>
    public static class Culqi3Ds
    {
        /// <summary>
        /// Culqi no cobra y pide que el titular se autentique con su banco: llega como 200 con
        /// action_code REVIEW y sin id de cargo.
        /// </summary>
        public static bool PideAutenticar(string body)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                return doc.RootElement.ValueKind == JsonValueKind.Object
                    && !doc.RootElement.TryGetProperty("id", out _)
                    && doc.RootElement.TryGetProperty("action_code", out var ac)
                    && string.Equals(ac.GetString(), "REVIEW", StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        /// <summary>
        /// Cuerpo del cargo. En el segundo intento, cuando el titular ya se autenticó, le suma
        /// el resultado de la autenticación.
        /// </summary>
        public static string ArmarCuerpo(object payload, Authentication3DsRequest? auth)
        {
            var cuerpo = JsonSerializer.SerializeToNode(payload)!.AsObject();
            if (auth != null)
            {
                cuerpo["authentication_3DS"] = new JsonObject
                {
                    ["eci"] = auth.Eci,
                    ["xid"] = auth.Xid,
                    ["cavv"] = auth.Cavv,
                    ["protocolVersion"] = auth.ProtocolVersion,
                    ["directoryServerTransactionId"] = auth.DirectoryServerTransactionId,
                };
            }
            return cuerpo.ToJsonString();
        }

        /// <summary>
        /// Datos del comprador para el antifraude. El checkout de Culqi casi nunca devuelve el
        /// nombre; con un texto por defecto el antifraude ve un comprador anónimo. Primero lo
        /// que dio la tarjeta, después el nombre del perfil de facturación y, sin perfil,
        /// el nombre genérico.
        /// </summary>
        public static Dictionary<string, object?> Antifraude(
            string? firstName, string? lastName, string? deviceFingerPrintId,
            BillingProfile? perfil, string nombreGenerico = "Cliente")
        {
            var partes = (perfil?.LegalName ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var nombrePerfil   = partes.Length > 0 ? partes[0] : nombreGenerico;
            var apellidoPerfil = partes.Length > 1 ? string.Join(' ', partes.Skip(1)) : (perfil != null ? nombrePerfil : "Decatron");

            var detalles = new Dictionary<string, object?>
            {
                ["first_name"] = string.IsNullOrWhiteSpace(firstName) ? nombrePerfil : firstName,
                ["last_name"]  = string.IsNullOrWhiteSpace(lastName) ? apellidoPerfil : lastName,
            };
            if (perfil != null) detalles["country_code"] = perfil.Country;
            if (!string.IsNullOrWhiteSpace(deviceFingerPrintId))
                detalles["device_finger_print_id"] = deviceFingerPrintId;
            return detalles;
        }
    }
}
