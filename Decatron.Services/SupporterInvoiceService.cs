using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services
{
    /// <summary>
    /// Emite el comprobante electrónico de una compra de tier contra DecatronAPI.
    ///
    /// <para>La emisión <b>nunca</b> ocurre dentro del cobro. El pago se guarda con
    /// <c>invoice_status = 'PENDING'</c> y este servicio lo recoge después, porque un
    /// problema con SUNAT no puede impedir que se acredite un tier ya pagado — el dinero
    /// entró y el beneficio se debe. El comprobante se puede emitir un minuto más tarde;
    /// el plazo de SUNAT es de días.</para>
    ///
    /// <para>Las donaciones no pasan por acá: se guardan con <c>invoice_status</c> nulo
    /// porque son liberalidades, no venta de servicio.</para>
    /// </summary>
    public interface ISupporterInvoiceService
    {
        /// <summary>Emite los comprobantes que estén pendientes. Devuelve cuántos resolvió.</summary>
        Task<int> ProcesarPendientesAsync(CancellationToken ct = default);

        /// <summary>Emite el comprobante de un pago concreto. Devuelve false si no se pudo.</summary>
        Task<bool> EmitirAsync(int paymentId, CancellationToken ct = default);

        /// <summary>
        /// Trae un archivo del comprobante desde DecatronAPI. <paramref name="formato"/> es
        /// <c>pdf</c>, <c>xml</c> o <c>cdr</c>. Null si no existe o no se pudo traer.
        /// </summary>
        Task<ArchivoComprobante?> DescargarAsync(int documentId, string formato, CancellationToken ct = default);

        /// <summary>
        /// Vuelve a intentar un comprobante que quedó a medias. Si nunca se emitió, lo emite;
        /// si ya existe el documento, solo actualiza su estado desde SUNAT.
        /// </summary>
        Task<bool> ReintentarAsync(int paymentId, CancellationToken ct = default);

        /// <summary>Con qué empresa se está emitiendo y qué otras hay disponibles.</summary>
        Task<EstadoFacturacion> ObtenerEstadoAsync(CancellationToken ct = default);

        /// <summary>Cambia la empresa emisora. Devuelve el motivo si no se pudo.</summary>
        Task<(bool Ok, string? Error)> CambiarEmpresaAsync(int companyId, string? quien, CancellationToken ct = default);
    }

    /// <summary>Una empresa emisora de DecatronAPI, con lo justo para decidir si sirve.</summary>
    public sealed record EmpresaEmisora(
        int Id,
        string Ruc,
        string RazonSocial,
        /// <summary>Etiqueta interna de DecatronAPI. Es lo único que distingue dos empresas del mismo RUC.</summary>
        string? Alias,
        bool EsBeta,
        string? SerieBoleta,
        string? SerieFactura,
        bool TieneCertificado,
        bool TieneClaveSol);

    /// <summary>
    /// Estado del emisor. <c>Activa</c> es null cuando la empresa configurada no existe o
    /// DecatronAPI no responde — y eso hay que mostrarlo, no esconderlo detrás de un cero.
    /// </summary>
    public sealed record EstadoFacturacion(
        bool Configurado,
        int? CompanyId,
        EmpresaEmisora? Activa,
        IReadOnlyList<EmpresaEmisora> Disponibles,
        string? Error);

    /// <summary>Un archivo del comprobante tal como lo devolvió DecatronAPI.</summary>
    public sealed record ArchivoComprobante(byte[] Contenido, string ContentType, string NombreArchivo);

    public class SupporterInvoiceService : ISupporterInvoiceService
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<SupporterInvoiceService> _logger;

        /// <summary>Tope de intentos. Pasado esto queda en ERROR y hay que mirarlo a mano.</summary>
        private const int MaxIntentos = 5;

        public SupporterInvoiceService(
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<SupporterInvoiceService> logger)
        {
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        private string ConnectionString =>
            _configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Falta la cadena de conexión");

        private bool Habilitado =>
            !string.IsNullOrWhiteSpace(_configuration["DecatronApi:ApiKey"])
            && _configuration.GetValue("DecatronApi:Enabled", true);

        /// <summary>
        /// La empresa que emite. Manda lo guardado en <c>invoicing_settings</c>; el valor de
        /// appsettings queda solo como arranque, para el día que la tabla está vacía.
        /// </summary>
        private async Task<int?> ObtenerCompanyIdAsync(CancellationToken ct)
        {
            await using (var conn = new NpgsqlConnection(ConnectionString))
            {
                await conn.OpenAsync(ct);
                await using var cmd = new NpgsqlCommand(
                    "SELECT company_id FROM invoicing_settings WHERE id = 1", conn);

                var valor = await cmd.ExecuteScalarAsync(ct);
                if (valor is int guardado) return guardado;
            }

            return int.TryParse(_configuration["DecatronApi:CompanyId"], out var config) ? config : null;
        }

        private string BaseUrl =>
            (_configuration["DecatronApi:BaseUrl"] ?? "https://decatronapi.decatron.net").TrimEnd('/');

        private HttpClient CrearCliente(int timeoutSegundos)
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(timeoutSegundos);
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _configuration["DecatronApi:ApiKey"]);
            return client;
        }

        // ── Pendientes ────────────────────────────────────────────────────────────

        public async Task<int> ProcesarPendientesAsync(CancellationToken ct = default)
        {
            if (!Habilitado) return 0;

            var pendientes = new List<int>();

            await using (var conn = new NpgsqlConnection(ConnectionString))
            {
                await conn.OpenAsync(ct);
                await using var cmd = new NpgsqlCommand(@"
                    SELECT id FROM supporter_payments
                    WHERE invoice_status = 'PENDING'
                      AND invoice_attempts < @max
                      AND (invoice_last_attempt_at IS NULL
                           OR invoice_last_attempt_at < NOW() - INTERVAL '5 minutes')
                    ORDER BY captured_at
                    LIMIT 20", conn);
                cmd.Parameters.AddWithValue("max", MaxIntentos);

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                    pendientes.Add(reader.GetInt32(0));
            }

            var emitidos = 0;
            foreach (var id in pendientes)
            {
                if (ct.IsCancellationRequested) break;
                if (await EmitirAsync(id, ct)) emitidos++;
            }

            return emitidos;
        }

        // ── Emisión ───────────────────────────────────────────────────────────────

        public async Task<bool> EmitirAsync(int paymentId, CancellationToken ct = default)
        {
            if (!Habilitado)
            {
                _logger.LogDebug("Facturación de supporters deshabilitada; se omite el pago {Id}", paymentId);
                return false;
            }

            var pago = await CargarPagoAsync(paymentId, ct);
            if (pago == null)
            {
                _logger.LogWarning("No existe el pago {Id}", paymentId);
                return false;
            }

            if (pago.PaymentType != "tier")
            {
                // No debería llegar acá: las donaciones nacen con invoice_status nulo.
                await MarcarAsync(paymentId, null, "No corresponde comprobante", ct);
                return false;
            }

            if (pago.ChargedAmount is not > 0)
            {
                await MarcarAsync(paymentId, "ERROR", "El pago no tiene importe cobrado", ct);
                return false;
            }

            var companyId = await ObtenerCompanyIdAsync(ct);
            if (companyId == null)
            {
                // Falta elegir empresa emisora. Es un problema de configuración, no del pago:
                // no se gasta un intento con esto, porque reintentarlo no lo arregla.
                _logger.LogWarning("No hay empresa emisora configurada; el pago {Id} queda pendiente", paymentId);
                return false;
            }

            var (endpoint, cuerpo) = ArmarPeticion(pago, companyId.Value);

            try
            {
                var baseUrl = BaseUrl;
                using var client = CrearCliente(60);

                var json = JsonSerializer.Serialize(cuerpo);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await client.PostAsync($"{baseUrl}/api/v1/facturacion/documents/{endpoint}", content, ct);
                var body = await response.Content.ReadAsStringAsync(ct);

                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                // Un 4xx acá es un problema del contenido, no de la red: reintentarlo tal
                // cual va a fallar igual, así que se corta y queda para revisar.
                if (!response.IsSuccessStatusCode && (int)response.StatusCode < 500)
                {
                    var msg = root.TryGetProperty("message", out var m) ? m.GetString() : body;
                    _logger.LogError("Comprobante del pago {Id} rechazado por DecatronAPI: {Msg}", paymentId, msg);
                    await MarcarAsync(paymentId, "ERROR", msg, ct);
                    return false;
                }

                if (!response.IsSuccessStatusCode)
                {
                    // 5xx: la API se cayó. Se reintenta.
                    _logger.LogWarning("DecatronAPI devolvió {Code} para el pago {Id}", (int)response.StatusCode, paymentId);
                    await AnotarIntentoAsync(paymentId, $"HTTP {(int)response.StatusCode}", ct);
                    return false;
                }

                if (!root.TryGetProperty("document", out var documento))
                {
                    await AnotarIntentoAsync(paymentId, "Respuesta sin documento", ct);
                    return false;
                }

                var docId    = documento.TryGetProperty("id", out var i) ? i.GetInt32() : (int?)null;
                var serie    = documento.TryGetProperty("series", out var s) ? s.GetString() : null;
                var numero   = documento.TryGetProperty("number", out var n) ? n.GetInt32() : (int?)null;
                var tipo     = documento.TryGetProperty("type", out var t) ? t.GetString() : null;
                var estado   = documento.TryGetProperty("sunatStatus", out var st) ? st.GetString() : "PENDING";
                var mensaje  = root.TryGetProperty("error", out var er) ? er.GetString() : null;

                await GuardarComprobanteAsync(paymentId, estado, docId, tipo, serie, numero, mensaje, ct);

                _logger.LogInformation(
                    "Pago {Id}: comprobante {Tipo} {Serie}-{Numero} → {Estado}",
                    paymentId, tipo, serie, numero, estado);

                return estado == "ACCEPTED";
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error emitiendo el comprobante del pago {Id}", paymentId);
                await AnotarIntentoAsync(paymentId, ex.Message, ct);
                return false;
            }
        }

        // ── Qué comprobante corresponde ───────────────────────────────────────────

        /// <summary>
        /// Decide el documento a partir de dónde está el comprador y qué documento dio.
        ///
        /// <para>Peruano con RUC → factura de venta interna. Peruano sin RUC → boleta.
        /// Comprador del extranjero → factura de exportación de servicios (catálogo 51,
        /// <c>0201</c>), sin IGV y con afectación 40.</para>
        ///
        /// <para>El importe que va al comprobante es el <b>cobrado</b>, no el precio de
        /// lista: Culqi cobra en soles y el precio está en dólares. Y el precio ya
        /// incluye IGV, que es lo que espera <c>unitPrice</c> de la API.</para>
        /// </summary>
        private (string Endpoint, object Cuerpo) ArmarPeticion(PagoParaFacturar pago, int companyId)
        {
            var pais = string.IsNullOrWhiteSpace(pago.CustomerCountry) ? "PE" : pago.CustomerCountry.ToUpperInvariant();
            var exportacion = pais != "PE";

            var descripcion = pago.BillingType == "permanent"
                ? $"Suscripción Decatron {pago.Tier} — acceso permanente"
                : $"Suscripción Decatron {pago.Tier} — 1 mes";

            var comun = new Dictionary<string, object?>
            {
                ["companyId"]  = companyId,
                ["currency"]   = pago.ChargedCurrency ?? "PEN",
                ["issueDate"]  = pago.CapturedAt.ToString("yyyy-MM-dd"),
                ["externalId"] = pago.OrderId,
            };

            var nombre = string.IsNullOrWhiteSpace(pago.CustomerName)
                ? (pago.TwitchLogin ?? "CLIENTE")
                : pago.CustomerName;

            if (exportacion)
            {
                // El no domiciliado normalmente no tiene documento peruano. Si dio uno de su
                // país se usa; si no, va sin documento, que en exportación es válido.
                var docType = string.IsNullOrWhiteSpace(pago.CustomerDocType) ? "SIN_DOC" : pago.CustomerDocType;

                comun["customer"] = new Dictionary<string, object?>
                {
                    ["docType"] = docType,
                    ["docNum"]  = pago.CustomerDocNumber,
                    ["name"]    = nombre,
                    ["country"] = pais,
                };
                comun["tipoOperacion"] = "0201";
                comun["items"] = new[] { Item(descripcion, pago.ChargedAmount!.Value, "X") };

                return ("factura", comun);
            }

            // Tener RUC no obliga a pedir factura: un RUC 10 es persona natural con
            // negocio y muchas veces prefiere boleta. La eleccion se guardo con la compra.
            var esFactura = pago.PreferFactura
                && string.Equals(pago.CustomerDocType, "RUC", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(pago.CustomerDocNumber);

            comun["customer"] = new Dictionary<string, object?>
            {
                ["docType"] = esFactura ? "RUC" : (pago.CustomerDocType ?? "SIN_DOC"),
                ["docNum"]  = pago.CustomerDocNumber,
                ["name"]    = nombre,
                ["country"] = "PE",
            };
            comun["items"] = new[] { Item(descripcion, pago.ChargedAmount!.Value, "S") };

            return (esFactura ? "factura" : "boleta", comun);
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

        // ── Emisor: quién factura y en qué entorno ────────────────────────────────

        public async Task<EstadoFacturacion> ObtenerEstadoAsync(CancellationToken ct = default)
        {
            var companyId = await ObtenerCompanyIdAsync(ct);

            if (!Habilitado)
                return new EstadoFacturacion(false, companyId, null, Array.Empty<EmpresaEmisora>(),
                    "Falta la API key de DecatronAPI: no se emite nada y los pagos quedan pendientes.");

            try
            {
                using var client = CrearCliente(20);
                var response = await client.GetAsync($"{BaseUrl}/api/v1/facturacion/companies", ct);
                var body = await response.Content.ReadAsStringAsync(ct);

                if (!response.IsSuccessStatusCode)
                    return new EstadoFacturacion(true, companyId, null, Array.Empty<EmpresaEmisora>(),
                        $"DecatronAPI respondió {(int)response.StatusCode} al pedir las empresas.");

                using var doc = JsonDocument.Parse(body);
                if (!doc.RootElement.TryGetProperty("companies", out var lista))
                    return new EstadoFacturacion(true, companyId, null, Array.Empty<EmpresaEmisora>(),
                        "DecatronAPI devolvió una respuesta inesperada.");

                var empresas = new List<EmpresaEmisora>();
                foreach (var e in lista.EnumerateArray())
                {
                    var empresa = LeerEmpresa(e);
                    if (empresa != null) empresas.Add(empresa);
                }

                var activa = companyId == null ? null : empresas.Find(e => e.Id == companyId.Value);

                var error = companyId == null
                    ? "No hay ninguna empresa emisora elegida."
                    : activa == null
                        ? $"La empresa {companyId} no existe en DecatronAPI."
                        : null;

                return new EstadoFacturacion(true, companyId, activa, empresas, error);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando las empresas emisoras");
                return new EstadoFacturacion(true, companyId, null, Array.Empty<EmpresaEmisora>(),
                    "No se pudo hablar con DecatronAPI.");
            }
        }

        private static EmpresaEmisora? LeerEmpresa(JsonElement e)
        {
            if (!e.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.Number) return null;

            string? Texto(string nombre) =>
                e.TryGetProperty(nombre, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

            bool Bandera(string nombre) =>
                e.TryGetProperty(nombre, out var v) && v.ValueKind == JsonValueKind.True;

            return new EmpresaEmisora(
                id.GetInt32(),
                Texto("ruc") ?? "",
                Texto("razonSocial") ?? "",
                Texto("alias"),
                Bandera("isBeta"),
                Texto("boletaSeries"),
                Texto("facturaSeries"),
                Bandera("hasCert"),
                Bandera("hasSolCredentials"));
        }

        public async Task<(bool Ok, string? Error)> CambiarEmpresaAsync(
            int companyId, string? quien, CancellationToken ct = default)
        {
            var estado = await ObtenerEstadoAsync(ct);

            // Se valida contra la lista real antes de guardar. Un id inventado dejaría al bot
            // cobrando sin poder emitir, y de eso solo se enteraría el job.
            var empresa = estado.Disponibles.Count == 0
                ? null
                : System.Linq.Enumerable.FirstOrDefault(estado.Disponibles, e => e.Id == companyId);

            if (empresa == null)
                return (false, "Esa empresa no existe en DecatronAPI o no se pudo verificar.");

            if (!empresa.TieneCertificado || !empresa.TieneClaveSol)
                return (false, $"{empresa.RazonSocial} no tiene "
                    + (!empresa.TieneCertificado ? "certificado digital" : "clave SOL")
                    + " cargado en DecatronAPI: no podría emitir nada.");

            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO invoicing_settings (id, company_id, updated_at, updated_by)
                VALUES (1, @companyId, NOW(), @quien)
                ON CONFLICT (id) DO UPDATE
                SET company_id = @companyId, updated_at = NOW(), updated_by = @quien", conn);
            cmd.Parameters.AddWithValue("companyId", companyId);
            cmd.Parameters.AddWithValue("quien", (object?)quien ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ct);

            _logger.LogWarning(
                "Empresa emisora cambiada a {Id} ({Razon}, RUC {Ruc}, {Modo}) por {Quien}",
                empresa.Id, empresa.RazonSocial, empresa.Ruc, empresa.EsBeta ? "beta" : "PRODUCCIÓN", quien ?? "?");

            return (true, null);
        }

        // ── Descarga ──────────────────────────────────────────────────────────────

        private static readonly HashSet<string> FormatosDescarga =
            new(StringComparer.OrdinalIgnoreCase) { "pdf", "xml", "cdr" };

        public async Task<ArchivoComprobante?> DescargarAsync(
            int documentId, string formato, CancellationToken ct = default)
        {
            if (!Habilitado || !FormatosDescarga.Contains(formato)) return null;

            try
            {
                using var client = CrearCliente(30);
                var response = await client.GetAsync(
                    $"{BaseUrl}/api/v1/facturacion/documents/{documentId}/{formato.ToLowerInvariant()}", ct);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "DecatronAPI devolvió {Code} al pedir el {Formato} del documento {Doc}",
                        (int)response.StatusCode, formato, documentId);
                    return null;
                }

                var contenido = await response.Content.ReadAsByteArrayAsync(ct);

                // El nombre lo pone DecatronAPI: es serie-numero, que es como el comprador
                // espera encontrarlo en su carpeta de descargas. El CDR viene como XML.
                var nombre = response.Content.Headers.ContentDisposition?.FileName?.Trim('"');
                if (string.IsNullOrWhiteSpace(nombre))
                    nombre = $"comprobante-{documentId}.{(FormatoEsPdf(formato) ? "pdf" : "xml")}";

                var contentType = response.Content.Headers.ContentType?.MediaType
                                  ?? (FormatoEsPdf(formato) ? "application/pdf" : "application/xml");

                return new ArchivoComprobante(contenido, contentType, nombre);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error descargando el {Formato} del documento {Doc}", formato, documentId);
                return null;
            }
        }

        private static bool FormatoEsPdf(string formato) =>
            string.Equals(formato, "pdf", StringComparison.OrdinalIgnoreCase);

        // ── Reintento manual ──────────────────────────────────────────────────────

        public async Task<bool> ReintentarAsync(int paymentId, CancellationToken ct = default)
        {
            if (!Habilitado) return false;

            int? documentId;
            await using (var conn = new NpgsqlConnection(ConnectionString))
            {
                await conn.OpenAsync(ct);
                await using var cmd = new NpgsqlCommand(
                    "SELECT invoice_document_id FROM supporter_payments WHERE id = @id AND payment_type = 'tier'",
                    conn);
                cmd.Parameters.AddWithValue("id", paymentId);

                var valor = await cmd.ExecuteScalarAsync(ct);
                if (valor == null) return false;                       // no existe o es donación
                documentId = valor is DBNull ? null : (int)valor;
            }

            // Ya hay documento emitido: volver a emitir sacaría un segundo comprobante por la
            // misma venta, y eso solo se deshace con una nota de crédito. Lo único correcto
            // acá es preguntarle a DecatronAPI en qué quedó el que ya existe.
            if (documentId.HasValue)
                return await SincronizarEstadoAsync(paymentId, documentId.Value, ct);

            // Nunca se emitió: se le devuelven los intentos y se emite ahora mismo, sin
            // esperar a la pasada del job.
            await using (var conn = new NpgsqlConnection(ConnectionString))
            {
                await conn.OpenAsync(ct);
                await using var cmd = new NpgsqlCommand(@"
                    UPDATE supporter_payments
                    SET invoice_status = 'PENDING', invoice_attempts = 0, invoice_error = NULL
                    WHERE id = @id AND invoice_document_id IS NULL", conn);
                cmd.Parameters.AddWithValue("id", paymentId);
                await cmd.ExecuteNonQueryAsync(ct);
            }

            return await EmitirAsync(paymentId, ct);
        }

        /// <summary>
        /// Relee el estado de un documento ya emitido. SUNAT puede aceptar minutos después,
        /// y entonces la fila local se queda diciendo PENDING para siempre.
        /// </summary>
        private async Task<bool> SincronizarEstadoAsync(int paymentId, int documentId, CancellationToken ct)
        {
            try
            {
                using var client = CrearCliente(30);
                var response = await client.GetAsync($"{BaseUrl}/api/v1/facturacion/documents/{documentId}", ct);
                var body = await response.Content.ReadAsStringAsync(ct);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "DecatronAPI devolvió {Code} al consultar el documento {Doc}",
                        (int)response.StatusCode, documentId);
                    return false;
                }

                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                var documento = root.TryGetProperty("document", out var d) ? d : root;

                var estado  = documento.TryGetProperty("sunatStatus", out var st) ? st.GetString() : null;
                var mensaje = documento.TryGetProperty("sunatMessage", out var m) ? m.GetString() : null;
                if (string.IsNullOrWhiteSpace(estado)) return false;

                await using var conn = new NpgsqlConnection(ConnectionString);
                await conn.OpenAsync(ct);
                await using var cmd = new NpgsqlCommand(@"
                    UPDATE supporter_payments
                    SET invoice_status = @estado, invoice_error = @error
                    WHERE id = @id", conn);
                cmd.Parameters.AddWithValue("id", paymentId);
                cmd.Parameters.AddWithValue("estado", estado);
                cmd.Parameters.AddWithValue("error", (object?)mensaje ?? DBNull.Value);
                await cmd.ExecuteNonQueryAsync(ct);

                _logger.LogInformation(
                    "Pago {Id}: el documento {Doc} está {Estado} en SUNAT", paymentId, documentId, estado);

                return estado == "ACCEPTED";
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando el documento {Doc}", documentId);
                return false;
            }
        }

        // ── Persistencia ──────────────────────────────────────────────────────────

        private sealed class PagoParaFacturar
        {
            public int      Id { get; init; }
            public string?  TwitchLogin { get; init; }
            public string?  Tier { get; init; }
            public string   BillingType { get; init; } = "monthly";
            public string   PaymentType { get; init; } = "tier";
            public string   OrderId { get; init; } = string.Empty;
            public DateTime CapturedAt { get; init; }
            public decimal? ChargedAmount { get; init; }
            public string?  ChargedCurrency { get; init; }
            public string?  CustomerName { get; init; }
            public string?  CustomerCountry { get; init; }
            public string?  CustomerDocType { get; init; }
            public string?  CustomerDocNumber { get; init; }
            public bool     PreferFactura { get; init; }
        }

        private async Task<PagoParaFacturar?> CargarPagoAsync(int id, CancellationToken ct)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                SELECT twitch_login, tier, billing_type, payment_type, paypal_order_id, captured_at,
                       charged_amount, charged_currency,
                       customer_name, customer_country, customer_doc_type, customer_doc_number,
                       prefer_factura
                FROM supporter_payments WHERE id = @id", conn);
            cmd.Parameters.AddWithValue("id", id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;

            return new PagoParaFacturar
            {
                Id                = id,
                TwitchLogin       = reader.IsDBNull(0)  ? null : reader.GetString(0),
                Tier              = reader.IsDBNull(1)  ? null : reader.GetString(1),
                BillingType       = reader.IsDBNull(2)  ? "monthly" : reader.GetString(2),
                PaymentType       = reader.IsDBNull(3)  ? "tier" : reader.GetString(3),
                OrderId           = reader.IsDBNull(4)  ? string.Empty : reader.GetString(4),
                CapturedAt        = reader.GetDateTime(5),
                ChargedAmount     = reader.IsDBNull(6)  ? null : reader.GetDecimal(6),
                ChargedCurrency   = reader.IsDBNull(7)  ? null : reader.GetString(7),
                CustomerName      = reader.IsDBNull(8)  ? null : reader.GetString(8),
                CustomerCountry   = reader.IsDBNull(9)  ? null : reader.GetString(9),
                CustomerDocType   = reader.IsDBNull(10) ? null : reader.GetString(10),
                CustomerDocNumber = reader.IsDBNull(11) ? null : reader.GetString(11),
                PreferFactura     = !reader.IsDBNull(12) && reader.GetBoolean(12),
            };
        }

        private async Task GuardarComprobanteAsync(
            int id, string? estado, int? docId, string? tipo, string? serie, int? numero,
            string? error, CancellationToken ct)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                UPDATE supporter_payments SET
                    invoice_status = @estado,
                    invoice_document_id = @docId,
                    invoice_type = @tipo,
                    invoice_series = @serie,
                    invoice_number = @numero,
                    invoice_error = @error,
                    invoice_attempts = invoice_attempts + 1,
                    invoice_last_attempt_at = NOW()
                WHERE id = @id", conn);

            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("estado", (object?)estado ?? DBNull.Value);
            cmd.Parameters.AddWithValue("docId",  (object?)docId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("tipo",   (object?)tipo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("serie",  (object?)serie ?? DBNull.Value);
            cmd.Parameters.AddWithValue("numero", (object?)numero ?? DBNull.Value);
            cmd.Parameters.AddWithValue("error",  (object?)error ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync(ct);
        }

        private async Task MarcarAsync(int id, string? estado, string? error, CancellationToken ct)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                UPDATE supporter_payments
                SET invoice_status = @estado, invoice_error = @error,
                    invoice_attempts = invoice_attempts + 1, invoice_last_attempt_at = NOW()
                WHERE id = @id", conn);
            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("estado", (object?)estado ?? DBNull.Value);
            cmd.Parameters.AddWithValue("error", (object?)error ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync(ct);
        }

        /// <summary>
        /// Deja constancia de un intento fallido. Sigue PENDING para que el job vuelva a
        /// intentarlo, salvo que ya se hayan agotado los intentos: ahí pasa a ERROR, para
        /// que no quede una fila pendiente para siempre que nadie mire.
        /// </summary>
        private async Task AnotarIntentoAsync(int id, string? error, CancellationToken ct)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                UPDATE supporter_payments
                SET invoice_error = @error,
                    invoice_attempts = invoice_attempts + 1,
                    invoice_last_attempt_at = NOW(),
                    invoice_status = CASE WHEN invoice_attempts + 1 >= @max THEN 'ERROR' ELSE invoice_status END
                WHERE id = @id
                RETURNING invoice_status, invoice_attempts", conn);
            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("max", MaxIntentos);
            cmd.Parameters.AddWithValue("error", (object?)error ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct) && reader.GetString(0) == "ERROR")
            {
                _logger.LogError(
                    "Pago {Id}: se agotaron los {Max} intentos de emitir el comprobante. Último error: {Error}",
                    id, MaxIntentos, error);
            }
        }
    }
}
