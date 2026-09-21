using System;
using System.Collections.Generic;

namespace Decatron.Services
{
    /// <summary>
    /// Datos del comprador y del cobro que necesita un comprobante, sin importar qué se
    /// vendió ni de qué tabla salió. Es lo que separa la regla fiscal (una sola, acá) del
    /// flujo de cada venta (tiers en <see cref="SupporterInvoiceService"/>, DecaCoins en
    /// <see cref="CoinInvoiceService"/>).
    /// </summary>
    public sealed record VentaParaComprobante(
        /// <summary>Id propio de la venta. Va como <c>externalId</c> para poder rastrearla.</summary>
        string ExternalId,
        /// <summary>Lo que aparece impreso en el comprobante.</summary>
        string Descripcion,
        /// <summary>Importe realmente cobrado, IGV incluido. No el precio de lista.</summary>
        decimal ImporteCobrado,
        string? MonedaCobrada,
        DateTime FechaEmision,
        string? NombreCliente,
        string? PaisCliente,
        string? TipoDocCliente,
        string? NumeroDocCliente,
        /// <summary>El comprador con RUC pidió factura en vez de boleta.</summary>
        bool PrefiereFactura);

    /// <summary>Qué documento sale y con qué cuerpo se le pide a DecatronAPI.</summary>
    public sealed record PeticionComprobante(string Endpoint, Dictionary<string, object?> Cuerpo);

    /// <summary>
    /// La regla fiscal, en un solo lugar: qué comprobante corresponde según dónde está el
    /// comprador y qué documento dio.
    ///
    /// <para>Peruano con RUC que pidió factura → factura de venta interna con IGV.
    /// Peruano sin eso → boleta con IGV. Comprador del extranjero → factura de exportación
    /// de servicios (catálogo 51, <c>0201</c>), sin IGV y con afectación 40.</para>
    ///
    /// <para>Vive aparte de los servicios de emisión a propósito: si la regla estuviera
    /// duplicada por tipo de venta, tarde o temprano una se actualiza y la otra no, y el
    /// resultado es un comprobante mal emitido ante SUNAT.</para>
    /// </summary>
    public static class InvoiceDocumentBuilder
    {
        public static PeticionComprobante Armar(VentaParaComprobante venta, int companyId)
        {
            var pais = string.IsNullOrWhiteSpace(venta.PaisCliente)
                ? "PE"
                : venta.PaisCliente.ToUpperInvariant();
            var exportacion = pais != "PE";

            var cuerpo = new Dictionary<string, object?>
            {
                ["companyId"]  = companyId,
                ["currency"]   = venta.MonedaCobrada ?? "PEN",
                ["issueDate"]  = venta.FechaEmision.ToString("yyyy-MM-dd"),
                ["externalId"] = venta.ExternalId,
            };

            var nombre = string.IsNullOrWhiteSpace(venta.NombreCliente) ? "CLIENTE" : venta.NombreCliente;

            if (exportacion)
            {
                // El no domiciliado normalmente no tiene documento peruano. Si dio uno de su
                // país se usa; si no, va sin documento, que en exportación es válido.
                cuerpo["customer"] = new Dictionary<string, object?>
                {
                    ["docType"] = string.IsNullOrWhiteSpace(venta.TipoDocCliente) ? "SIN_DOC" : venta.TipoDocCliente,
                    ["docNum"]  = venta.NumeroDocCliente,
                    ["name"]    = nombre,
                    ["country"] = pais,
                };
                cuerpo["tipoOperacion"] = "0201";
                cuerpo["items"] = new[] { Item(venta.Descripcion, venta.ImporteCobrado, "X") };

                return new PeticionComprobante("factura", cuerpo);
            }

            // Tener RUC no obliga a pedir factura: un RUC 10 es persona natural con
            // negocio y muchas veces prefiere boleta. La elección se guardó con la compra.
            var esFactura = venta.PrefiereFactura
                && string.Equals(venta.TipoDocCliente, "RUC", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(venta.NumeroDocCliente);

            cuerpo["customer"] = new Dictionary<string, object?>
            {
                ["docType"] = esFactura ? "RUC" : (venta.TipoDocCliente ?? "SIN_DOC"),
                ["docNum"]  = venta.NumeroDocCliente,
                ["name"]    = nombre,
                ["country"] = "PE",
            };
            cuerpo["items"] = new[] { Item(venta.Descripcion, venta.ImporteCobrado, "S") };

            return new PeticionComprobante(esFactura ? "factura" : "boleta", cuerpo);
        }

        /// <summary>El precio ya incluye IGV, que es justo lo que pide <c>unitPrice</c>.</summary>
        private static Dictionary<string, object?> Item(string descripcion, decimal total, string igvType) =>
            new()
            {
                ["description"] = descripcion,
                ["quantity"]    = 1,
                ["unitPrice"]   = total,
                ["igvType"]     = igvType,
            };
    }
}
