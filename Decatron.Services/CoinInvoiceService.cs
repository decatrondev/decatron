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
    /// Emite el comprobante electrónico de una compra de DecaCoins contra DecatronAPI.
    ///
    /// <para>Comprar DecaCoins es venta de servicio digital, igual que comprar un tier:
    /// va con IGV si el comprador está en Perú y como exportación de servicios si está
    /// afuera. Esa decisión no se toma acá — vive en <see cref="InvoiceDocumentBuilder"/>,
    /// compartida con <see cref="SupporterInvoiceService"/>, para que la regla fiscal sea
    /// una sola.</para>
    ///
    /// <para>Como en supporters, la emisión <b>nunca</b> ocurre dentro del cobro: la compra
    /// se guarda con <c>invoice_status = 'PENDING'</c> y este servicio la recoge después.
    /// Un problema con SUNAT no puede impedir que se acrediten coins ya pagados.</para>
    /// </summary>
    public interface ICoinInvoiceService
    {
        /// <summary>Emite los comprobantes pendientes. Devuelve cuántos resolvió.</summary>
        Task<int> ProcesarPendientesAsync(CancellationToken ct = default);

        /// <summary>Emite el comprobante de una compra concreta. False si no se pudo.</summary>
        Task<bool> EmitirAsync(long purchaseId, CancellationToken ct = default);

        /// <summary>El id de documento del comprobante de esa compra, si ya se emitió.</summary>
        Task<int?> ObtenerDocumentIdAsync(long purchaseId, long userId, CancellationToken ct = default);
    }

    public class CoinInvoiceService : ICoinInvoiceService
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<CoinInvoiceService> _logger;

        /// <summary>Tope de intentos. Pasado esto queda en ERROR y hay que mirarlo a mano.</summary>
        private const int MaxIntentos = 5;

        public CoinInvoiceService(
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<CoinInvoiceService> logger)
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

        private string BaseUrl =>
            (_configuration["DecatronApi:BaseUrl"] ?? "https://decatronapi.decatron.net").TrimEnd('/');

        /// <summary>
        /// La empresa emisora sale de la misma tabla que usa supporters: se factura todo con
        /// la misma empresa, cambiarla en un lado tiene que cambiarla en los dos.
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

            var pendientes = new List<long>();

            await using (var conn = new NpgsqlConnection(ConnectionString))
            {
                await conn.OpenAsync(ct);
                await using var cmd = new NpgsqlCommand(@"
                    SELECT id FROM coin_purchases
                    WHERE invoice_status = 'PENDING'
                      AND invoice_attempts < @max
                      AND (invoice_last_attempt_at IS NULL
                           OR invoice_last_attempt_at < NOW() - INTERVAL '5 minutes')
                    ORDER BY created_at
                    LIMIT 20", conn);
                cmd.Parameters.AddWithValue("max", MaxIntentos);

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                    pendientes.Add(reader.GetInt64(0));
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

        public async Task<bool> EmitirAsync(long purchaseId, CancellationToken ct = default)
        {
            if (!Habilitado)
            {
                _logger.LogDebug("Facturación deshabilitada; se omite la compra de coins {Id}", purchaseId);
                return false;
            }

            var compra = await CargarCompraAsync(purchaseId, ct);
            if (compra == null)
            {
                _logger.LogWarning("No existe la compra de coins {Id}", purchaseId);
                return false;
            }

            if (compra.ChargedAmount is not > 0)
            {
                // Sin importe cobrado no hay nada que declarar: compras regaladas, o de
                // antes de que se guardara el monto real en soles.
                await MarcarAsync(purchaseId, null, "Sin importe cobrado", ct);
                return false;
            }

            // Segunda barrera. La compra de prueba ya nace sin invoice_status, así que en
            // teoría no llega hasta acá; el chequeo está igual porque el costo de emitir
            // un comprobante por una venta inexistente es una anulación ante SUNAT, y no
            // se justifica dejarlo dependiendo de un solo punto del código.
            if (compra.IsTest)
            {
                _logger.LogWarning(
                    "La compra de coins {Id} es de prueba: no se emite comprobante", purchaseId);
                await MarcarAsync(purchaseId, null, "Compra de prueba, no se emite", ct);
                return false;
            }

            var companyId = await ObtenerCompanyIdAsync(ct);
            if (companyId == null)
            {
                // Falta elegir empresa emisora. Es un problema de configuración, no de la
                // compra: no se gasta un intento, porque reintentarlo no lo arregla.
                _logger.LogWarning("No hay empresa emisora configurada; la compra {Id} queda pendiente", purchaseId);
                return false;
            }

            var (endpoint, cuerpo) = InvoiceDocumentBuilder.Armar(new VentaParaComprobante(
                ExternalId:       $"coins-{compra.Id}",
                Descripcion:      $"Compra de {compra.TotalCoins:N0} DecaCoins",
                ImporteCobrado:   compra.ChargedAmount!.Value,
                MonedaCobrada:    compra.ChargedCurrency,
                FechaEmision:     compra.CreatedAt,
                NombreCliente:    string.IsNullOrWhiteSpace(compra.CustomerName) ? compra.Login : compra.CustomerName,
                PaisCliente:      compra.CustomerCountry,
                TipoDocCliente:   compra.CustomerDocType,
                NumeroDocCliente: compra.CustomerDocNumber,
                PrefiereFactura:  compra.PreferFactura), companyId.Value);

            try
            {
                using var client = CrearCliente(60);
                var content = new StringContent(JsonSerializer.Serialize(cuerpo), Encoding.UTF8, "application/json");

                var response = await client.PostAsync($"{BaseUrl}/api/v1/facturacion/documents/{endpoint}", content, ct);
                var body = await response.Content.ReadAsStringAsync(ct);

                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                // Un 4xx acá es un problema del contenido, no de la red: reintentarlo tal
                // cual va a fallar igual, así que se corta y queda para revisar.
                if (!response.IsSuccessStatusCode && (int)response.StatusCode < 500)
                {
                    var msg = root.TryGetProperty("message", out var m) ? m.GetString() : body;
                    _logger.LogError("Comprobante de la compra de coins {Id} rechazado: {Msg}", purchaseId, msg);
                    await MarcarAsync(purchaseId, "ERROR", msg, ct);
                    return false;
                }

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("DecatronAPI devolvió {Code} para la compra {Id}", (int)response.StatusCode, purchaseId);
                    await AnotarIntentoAsync(purchaseId, $"HTTP {(int)response.StatusCode}", ct);
                    return false;
                }

                if (!root.TryGetProperty("document", out var documento))
                {
                    await AnotarIntentoAsync(purchaseId, "Respuesta sin documento", ct);
                    return false;
                }

                var docId   = documento.TryGetProperty("id", out var i) ? i.GetInt32() : (int?)null;
                var serie   = documento.TryGetProperty("series", out var s) ? s.GetString() : null;
                var numero  = documento.TryGetProperty("number", out var n) ? n.GetInt32() : (int?)null;
                var tipo    = documento.TryGetProperty("type", out var t) ? t.GetString() : null;
                var estado  = documento.TryGetProperty("sunatStatus", out var st) ? st.GetString() : "PENDING";
                var mensaje = root.TryGetProperty("error", out var er) ? er.GetString() : null;

                await GuardarComprobanteAsync(purchaseId, estado, docId, tipo, serie, numero, mensaje, ct);

                _logger.LogInformation(
                    "Compra de coins {Id}: comprobante {Tipo} {Serie}-{Numero} → {Estado}",
                    purchaseId, tipo, serie, numero, estado);

                return estado == "ACCEPTED";
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error emitiendo el comprobante de la compra de coins {Id}", purchaseId);
                await AnotarIntentoAsync(purchaseId, ex.Message, ct);
                return false;
            }
        }

        public async Task<int?> ObtenerDocumentIdAsync(long purchaseId, long userId, CancellationToken ct = default)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            // El user_id va en el WHERE, no se compara después: así no hay forma de pedir
            // el comprobante de otro pasando un id que no es tuyo.
            await using var cmd = new NpgsqlCommand(
                "SELECT invoice_document_id FROM coin_purchases WHERE id = @id AND user_id = @user", conn);
            cmd.Parameters.AddWithValue("id", purchaseId);
            cmd.Parameters.AddWithValue("user", userId);

            var valor = await cmd.ExecuteScalarAsync(ct);
            return valor is int docId ? docId : null;
        }

        // ── Persistencia ──────────────────────────────────────────────────────────

        private sealed class CompraParaFacturar
        {
            public long     Id { get; init; }
            public string?  Login { get; init; }
            public int      TotalCoins { get; init; }
            public DateTime CreatedAt { get; init; }
            public decimal? ChargedAmount { get; init; }
            public string?  ChargedCurrency { get; init; }
            public string?  CustomerName { get; init; }
            public string?  CustomerCountry { get; init; }
            public string?  CustomerDocType { get; init; }
            public string?  CustomerDocNumber { get; init; }
            public bool     PreferFactura { get; init; }
            public bool     IsTest { get; init; }
        }

        private async Task<CompraParaFacturar?> CargarCompraAsync(long id, CancellationToken ct)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            // coins_received ya incluye el bono de primera compra (se acredita en el mismo
            // acto). El bono por cupón NO va: se acredita después y aparte, no es parte de
            // lo que se compró en esta operación.
            await using var cmd = new NpgsqlCommand(@"
                SELECT cp.coins_received, cp.created_at,
                       cp.charged_amount, cp.charged_currency,
                       cp.customer_name, cp.customer_country, cp.customer_doc_type,
                       cp.customer_doc_number, cp.prefer_factura, u.login, cp.is_test
                FROM coin_purchases cp
                JOIN users u ON u.id = cp.user_id
                WHERE cp.id = @id", conn);
            cmd.Parameters.AddWithValue("id", id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;

            return new CompraParaFacturar
            {
                Id                = id,
                TotalCoins        = reader.GetInt32(0),
                CreatedAt         = reader.GetDateTime(1),
                ChargedAmount     = reader.IsDBNull(2) ? null : reader.GetDecimal(2),
                ChargedCurrency   = reader.IsDBNull(3) ? null : reader.GetString(3),
                CustomerName      = reader.IsDBNull(4) ? null : reader.GetString(4),
                CustomerCountry   = reader.IsDBNull(5) ? null : reader.GetString(5),
                CustomerDocType   = reader.IsDBNull(6) ? null : reader.GetString(6),
                CustomerDocNumber = reader.IsDBNull(7) ? null : reader.GetString(7),
                PreferFactura     = !reader.IsDBNull(8) && reader.GetBoolean(8),
                Login             = reader.IsDBNull(9) ? null : reader.GetString(9),
                IsTest            = !reader.IsDBNull(10) && reader.GetBoolean(10),
            };
        }

        private async Task GuardarComprobanteAsync(
            long id, string? estado, int? docId, string? tipo, string? serie, int? numero,
            string? error, CancellationToken ct)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                UPDATE coin_purchases SET
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

        private async Task MarcarAsync(long id, string? estado, string? error, CancellationToken ct)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                UPDATE coin_purchases
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
        private async Task AnotarIntentoAsync(long id, string? error, CancellationToken ct)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(@"
                UPDATE coin_purchases
                SET invoice_error = @error,
                    invoice_attempts = invoice_attempts + 1,
                    invoice_last_attempt_at = NOW(),
                    invoice_status = CASE WHEN invoice_attempts + 1 >= @max THEN 'ERROR' ELSE invoice_status END
                WHERE id = @id
                RETURNING invoice_status", conn);
            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("max", MaxIntentos);
            cmd.Parameters.AddWithValue("error", (object?)error ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct) && !reader.IsDBNull(0) && reader.GetString(0) == "ERROR")
            {
                _logger.LogError(
                    "La compra de coins {Id} agotó sus {Max} intentos de comprobante y quedó en ERROR: {Error}",
                    id, MaxIntentos, error);
            }
        }
    }
}
