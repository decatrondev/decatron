using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services
{
    // ─── DTOs ────────────────────────────────────────────────────────────────────

    public class BillingProfileInput
    {
        public string Country    { get; set; } = "PE";
        public string DocType    { get; set; } = string.Empty;
        public string DocNumber  { get; set; } = string.Empty;
        public string LegalName  { get; set; } = string.Empty;
        public string? Address   { get; set; }
        public string? Email     { get; set; }
    }

    /// <summary>
    /// Cómo va a salir el comprobante de una compra, antes de cobrar nada.
    ///
    /// <para>Se calcula con las mismas reglas que usa la emisión, para que lo que el
    /// comprador ve sea lo que después le llega. Si acá dice factura y sin IGV, eso es lo
    /// que se emite.</para>
    /// </summary>
    public class ComprobantePreview
    {
        public string  DocumentType { get; set; } = "BOLETA";
        public string  CustomerName { get; set; } = string.Empty;
        public string? CustomerDoc  { get; set; }
        public string  Country      { get; set; } = "PE";
        public bool    EsExportacion { get; set; }

        /// <summary>Solo con RUC y venta interna hay algo que elegir; si no, va boleta y punto.</summary>
        public bool    CanChooseFactura { get; set; }

        public string  Currency { get; set; } = "PEN";
        public decimal Subtotal { get; set; }
        public decimal Igv      { get; set; }
        public decimal Total    { get; set; }
        public decimal IgvRate  { get; set; }

        /// <summary>Lo que se le explica al comprador en una línea.</summary>
        public string  Note { get; set; } = string.Empty;
    }

    public class RucLookupResult
    {
        public bool    Found       { get; set; }
        public string? RazonSocial { get; set; }
        public string? Direccion   { get; set; }
        public string? Estado      { get; set; }
        public string? Error       { get; set; }
    }

    public interface IBillingProfileService
    {
        Task<BillingProfile?> GetAsync(long userId, CancellationToken ct = default);
        Task<BillingProfile> SaveAsync(long userId, BillingProfileInput input, CancellationToken ct = default);
        Task<RucLookupResult> LookupRucAsync(string ruc, CancellationToken ct = default);

        /// <summary>Valida el perfil. Devuelve null si está bien, o el motivo si no.</summary>
        string? Validar(BillingProfileInput input);

        ComprobantePreview Preview(BillingProfile perfil, decimal totalCobrado, string currency, bool prefiereFactura);
    }

    public class BillingProfileService : IBillingProfileService
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<BillingProfileService> _logger;

        /// <summary>Tasa del IGV. Vive acá y en DecatronAPI; si cambia, cambia en los dos.</summary>
        public const decimal IgvRate = 0.18m;

        /// <summary>Documentos que puede presentar alguien domiciliado en el Perú.</summary>
        private static readonly HashSet<string> DocsPeru =
            new(StringComparer.OrdinalIgnoreCase) { "DNI", "RUC", "CE", "PASAPORTE" };

        /// <summary>Documentos de un no domiciliado. No tiene por qué tener uno peruano.</summary>
        private static readonly HashSet<string> DocsExtranjero =
            new(StringComparer.OrdinalIgnoreCase)
            { "DOC_PAIS_RESIDENCIA", "PASAPORTE", "TIN", "IN", "CEDULA_DIPLOMATICA", "CE" };

        public BillingProfileService(
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<BillingProfileService> logger)
        {
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        private string ConnectionString =>
            _configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Falta la cadena de conexión");

        // ── Validación ────────────────────────────────────────────────────────────

        /// <summary>
        /// Valida lo que va a terminar impreso en un documento tributario.
        ///
        /// <para>Se valida acá y no solo en el navegador porque un número mal formado no
        /// se descubre hasta que SUNAT rechaza el comprobante, y para entonces el cobro
        /// ya está hecho y no hay a quién preguntarle.</para>
        /// </summary>
        public string? Validar(BillingProfileInput input)
        {
            var country = (input.Country ?? "").Trim().ToUpperInvariant();
            var docType = (input.DocType ?? "").Trim().ToUpperInvariant();
            var docNum  = (input.DocNumber ?? "").Trim();
            var name    = (input.LegalName ?? "").Trim();

            if (!System.Text.RegularExpressions.Regex.IsMatch(country, "^[A-Z]{2}$"))
                return "El país debe ser un código de 2 letras (PE, CL, AR…).";

            if (name.Length < 3)
                return "Escribe tu nombre completo o la razón social.";

            if (docNum.Length == 0)
                return "Escribe el número de tu documento.";

            var extranjero = country != "PE";
            var permitidos = extranjero ? DocsExtranjero : DocsPeru;

            if (!permitidos.Contains(docType))
            {
                return extranjero
                    ? "Con domicilio fuera del Perú, usa pasaporte, documento de tu país de residencia o TIN."
                    : "Con domicilio en el Perú, usa DNI, RUC, carné de extranjería o pasaporte.";
            }

            // El RUC es el unico que se puede verificar de verdad, y es el que mas duele
            // si sale mal: una factura a nombre equivocado es un documento defectuoso.
            if (docType == "RUC" && !System.Text.RegularExpressions.Regex.IsMatch(docNum, @"^(10|15|16|17|20)\d{9}$"))
                return "El RUC debe tener 11 dígitos y empezar en 10, 15, 16, 17 o 20.";

            if (docType == "DNI" && !System.Text.RegularExpressions.Regex.IsMatch(docNum, @"^\d{8}$"))
                return "El DNI debe tener 8 dígitos.";

            if (docType == "CE" && !System.Text.RegularExpressions.Regex.IsMatch(docNum, @"^[A-Za-z0-9]{9,12}$"))
                return "El carné de extranjería debe tener entre 9 y 12 caracteres.";

            if (docType == "PASAPORTE" && !System.Text.RegularExpressions.Regex.IsMatch(docNum, @"^[A-Za-z0-9]{5,12}$"))
                return "El pasaporte debe tener entre 5 y 12 caracteres.";

            // Un RUC solo existe en el Peru. Con domicilio en el extranjero no corresponde.
            if (docType == "RUC" && extranjero)
                return "El RUC es peruano. Si tu domicilio está fuera del Perú, usa el documento de tu país.";

            return null;
        }

        // ── Vista previa ──────────────────────────────────────────────────────────

        /// <summary>
        /// Arma la vista previa con las mismas reglas que después aplica la emisión.
        ///
        /// <para>El importe que se recibe es el <b>total cobrado</b>: los precios ya
        /// incluyen IGV, así que en venta interna el impuesto se saca de adentro, no se
        /// suma encima. En exportación no hay IGV, así que el total es todo base.</para>
        /// </summary>
        public ComprobantePreview Preview(BillingProfile perfil, decimal totalCobrado, string currency, bool prefiereFactura)
        {
            var exportacion = perfil.EsExtranjero;

            // Solo quien tiene RUC elige: un RUC 10 es persona natural con negocio y no
            // siempre quiere factura. Sin RUC no hay opcion, va boleta.
            var esFactura = exportacion || (perfil.PuedeFactura && prefiereFactura);

            decimal subtotal, igv;
            if (exportacion)
            {
                subtotal = decimal.Round(totalCobrado, 2);
                igv = 0m;
            }
            else
            {
                subtotal = decimal.Round(totalCobrado / (1 + IgvRate), 2);
                igv = decimal.Round(totalCobrado - subtotal, 2);
            }

            return new ComprobantePreview
            {
                DocumentType  = esFactura ? "FACTURA" : "BOLETA",
                CustomerName  = perfil.LegalName,
                CustomerDoc   = $"{perfil.DocType} {perfil.DocNumber}".Trim(),
                Country       = perfil.Country,
                EsExportacion = exportacion,
                CanChooseFactura = !exportacion && perfil.PuedeFactura,
                Currency      = currency,
                Subtotal      = subtotal,
                Igv           = igv,
                Total         = decimal.Round(totalCobrado, 2),
                IgvRate       = exportacion ? 0m : IgvRate * 100,
                Note = exportacion
                    ? "Factura de exportación de servicios. No lleva IGV."
                    : esFactura
                        ? "Factura electrónica con IGV, a nombre del RUC indicado."
                        : "Boleta de venta electrónica con IGV incluido.",
            };
        }

        // ── Consulta de RUC ───────────────────────────────────────────────────────

        /// <summary>
        /// Trae la razón social desde SUNAT a través de DecatronAPI.
        ///
        /// <para>Existe para que nadie escriba la razón social a mano: si el nombre no
        /// coincide con el RUC, la factura sale defectuosa y hay que anularla con una nota
        /// de crédito.</para>
        /// </summary>
        public async Task<RucLookupResult> LookupRucAsync(string ruc, CancellationToken ct = default)
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(ruc ?? "", @"^(10|15|16|17|20)\d{9}$"))
                return new RucLookupResult { Found = false, Error = "RUC inválido" };

            var apiKey = _configuration["DecatronApi:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                return new RucLookupResult { Found = false, Error = "Consulta de RUC no disponible" };

            try
            {
                var baseUrl = (_configuration["DecatronApi:BaseUrl"] ?? "https://decatronapi.decatron.net").TrimEnd('/');

                using var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(15);
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

                var response = await client.GetAsync($"{baseUrl}/api/v1/facturacion/ruc/{ruc}", ct);
                var body = await response.Content.ReadAsStringAsync(ct);

                if (!response.IsSuccessStatusCode)
                    return new RucLookupResult { Found = false, Error = "No se pudo consultar el RUC" };

                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                // La respuesta puede venir plana o envuelta en `data`.
                var datos = root.TryGetProperty("data", out var d) ? d : root;

                string? Texto(params string[] nombres)
                {
                    foreach (var n in nombres)
                        if (datos.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String)
                            return v.GetString();
                    return null;
                }

                var razon = Texto("razonSocial", "razon_social", "nombre", "name");
                if (string.IsNullOrWhiteSpace(razon))
                    return new RucLookupResult { Found = false, Error = "SUNAT no devolvió la razón social" };

                return new RucLookupResult
                {
                    Found       = true,
                    RazonSocial = razon,
                    Direccion   = Texto("direccion", "address"),
                    Estado      = Texto("estado", "status"),
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error consultando el RUC {Ruc}", ruc);
                return new RucLookupResult { Found = false, Error = "No se pudo consultar el RUC" };
            }
        }

        // ── Persistencia ──────────────────────────────────────────────────────────

        public async Task<BillingProfile?> GetAsync(long userId, CancellationToken ct = default)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                SELECT id, user_id, country, doc_type, doc_number, legal_name,
                       address, email, name_source, created_at, updated_at
                FROM billing_profiles WHERE user_id = @userId", conn);
            cmd.Parameters.AddWithValue("userId", userId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;

            return new BillingProfile
            {
                Id         = reader.GetInt32(0),
                UserId     = reader.GetInt64(1),
                Country    = reader.GetString(2),
                DocType    = reader.GetString(3),
                DocNumber  = reader.GetString(4),
                LegalName  = reader.GetString(5),
                Address    = reader.IsDBNull(6) ? null : reader.GetString(6),
                Email      = reader.IsDBNull(7) ? null : reader.GetString(7),
                NameSource = reader.GetString(8),
                CreatedAt  = reader.GetDateTime(9),
                UpdatedAt  = reader.GetDateTime(10),
            };
        }

        public async Task<BillingProfile> SaveAsync(long userId, BillingProfileInput input, CancellationToken ct = default)
        {
            var country = input.Country.Trim().ToUpperInvariant();
            var docType = input.DocType.Trim().ToUpperInvariant();
            var docNum  = input.DocNumber.Trim();
            var name    = input.LegalName.Trim();

            // Si es RUC, la razon social manda la de SUNAT: el usuario puede equivocarse
            // o poner un nombre comercial, y en la factura tiene que ir la razon social.
            var nameSource = "manual";
            if (docType == "RUC")
            {
                var sunat = await LookupRucAsync(docNum, ct);
                if (sunat.Found && !string.IsNullOrWhiteSpace(sunat.RazonSocial))
                {
                    name = sunat.RazonSocial!.Trim();
                    nameSource = "sunat";
                }
            }

            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO billing_profiles
                    (user_id, country, doc_type, doc_number, legal_name, address, email, name_source)
                VALUES
                    (@userId, @country, @docType, @docNum, @name, @address, @email, @source)
                ON CONFLICT (user_id) DO UPDATE SET
                    country = EXCLUDED.country,
                    doc_type = EXCLUDED.doc_type,
                    doc_number = EXCLUDED.doc_number,
                    legal_name = EXCLUDED.legal_name,
                    address = EXCLUDED.address,
                    email = EXCLUDED.email,
                    name_source = EXCLUDED.name_source,
                    updated_at = NOW()
                RETURNING id, created_at, updated_at", conn);

            cmd.Parameters.AddWithValue("userId",  userId);
            cmd.Parameters.AddWithValue("country", country);
            cmd.Parameters.AddWithValue("docType", docType);
            cmd.Parameters.AddWithValue("docNum",  docNum);
            cmd.Parameters.AddWithValue("name",    name);
            cmd.Parameters.AddWithValue("address", (object?)input.Address?.Trim() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("email",   (object?)input.Email?.Trim() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("source",  nameSource);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);

            return new BillingProfile
            {
                Id         = reader.GetInt32(0),
                UserId     = userId,
                Country    = country,
                DocType    = docType,
                DocNumber  = docNum,
                LegalName  = name,
                Address    = input.Address?.Trim(),
                Email      = input.Email?.Trim(),
                NameSource = nameSource,
                CreatedAt  = reader.GetDateTime(1),
                UpdatedAt  = reader.GetDateTime(2),
            };
        }
    }
}
