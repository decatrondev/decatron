using System;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services
{
    /// <summary>Qué llaves de Culqi usar y con qué sección de configuración leerlas.</summary>
    /// <summary>
    /// Un cargo de Culqi es de prueba si el modo lo dice **o** si el id del cargo empieza
    /// por chr_test_. La segunda barrera existe porque en julio de 2026 se emitió una
    /// factura real (F002-11) por un cargo de prueba: el modo puede cambiar entre el cobro
    /// y el guardado, pero el id del cargo no miente. Ver .dev/plans/FINANZAS_PLAN.md.
    /// </summary>
    public static class CargoDePrueba
    {
        public static bool Es(bool modoTest, string? chargeId) =>
            modoTest || (chargeId?.StartsWith("chr_test_", StringComparison.OrdinalIgnoreCase) ?? false);
    }

    public sealed record ModoCobro(bool EsTest)
    {
        /// <summary>Sección de appsettings de la que salen las llaves.</summary>
        public string SeccionConfig => EsTest ? "CulqiSettingsTest" : "CulqiSettings";
    }

    public interface IPaymentModeService
    {
        /// <summary>El modo activo. Ante cualquier duda devuelve live: equivocarse hacia "cobrar de verdad" es recuperable, regalar producto no.</summary>
        Task<ModoCobro> GetModoAsync(CancellationToken ct = default);

        /// <summary>La llave pública/secreta que corresponde al modo activo.</summary>
        Task<(string PublicKey, string SecretKey, bool EsTest)> GetLlavesAsync(CancellationToken ct = default);

        /// <summary>Cambia el modo. Devuelve el motivo si no se pudo.</summary>
        Task<(bool Ok, string? Error)> CambiarModoAsync(bool esTest, string? quien, CancellationToken ct = default);
    }

    /// <summary>
    /// Modo de cobro de la plataforma (llaves de Culqi live o test).
    ///
    /// <para>Vive en <c>invoicing_settings</c>, en la misma fila que la empresa emisora,
    /// porque lo que decide si un comprobante puede emitirse no es ninguno de los dos por
    /// separado sino su combinación — ver Add_Culqi_Mode_And_Test_Payments.sql.</para>
    /// </summary>
    public class PaymentModeService : IPaymentModeService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<PaymentModeService> _logger;

        public PaymentModeService(IConfiguration configuration, ILogger<PaymentModeService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        private string ConnectionString =>
            _configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Falta la cadena de conexión");

        public async Task<ModoCobro> GetModoAsync(CancellationToken ct = default)
        {
            try
            {
                await using var conn = new NpgsqlConnection(ConnectionString);
                await conn.OpenAsync(ct);
                await using var cmd = new NpgsqlCommand(
                    "SELECT culqi_mode FROM invoicing_settings WHERE id = 1", conn);

                var valor = await cmd.ExecuteScalarAsync(ct) as string;
                return new ModoCobro(valor == "test");
            }
            catch (Exception ex)
            {
                // Si no se puede leer el modo se cobra de verdad. Asumir "test" ante un
                // error de base dejaría la tienda regalando producto sin que nadie se
                // entere; asumir "live" a lo sumo cobra un pago de prueba, que se devuelve.
                _logger.LogError(ex, "No se pudo leer el modo de cobro; se asume live");
                return new ModoCobro(false);
            }
        }

        public async Task<(string PublicKey, string SecretKey, bool EsTest)> GetLlavesAsync(CancellationToken ct = default)
        {
            var modo = await GetModoAsync(ct);
            var pk = _configuration[$"{modo.SeccionConfig}:PublicKey"] ?? "";
            var sk = _configuration[$"{modo.SeccionConfig}:SecretKey"] ?? "";

            // Modo test sin llaves cargadas: se cae a live en vez de intentar cobrar con
            // una llave vacía, que daría un error incomprensible en el checkout.
            if (modo.EsTest && (string.IsNullOrWhiteSpace(pk) || string.IsNullOrWhiteSpace(sk)))
            {
                _logger.LogError(
                    "Modo test activo pero falta la sección {Seccion} en configuración; se usan las llaves live",
                    modo.SeccionConfig);
                return (_configuration["CulqiSettings:PublicKey"] ?? "",
                        _configuration["CulqiSettings:SecretKey"] ?? "", false);
            }

            return (pk, sk, modo.EsTest);
        }

        public async Task<(bool Ok, string? Error)> CambiarModoAsync(bool esTest, string? quien, CancellationToken ct = default)
        {
            if (esTest)
            {
                var pk = _configuration["CulqiSettingsTest:PublicKey"];
                var sk = _configuration["CulqiSettingsTest:SecretKey"];
                if (string.IsNullOrWhiteSpace(pk) || string.IsNullOrWhiteSpace(sk))
                    return (false, "Falta la sección CulqiSettingsTest en la configuración del servidor.");
            }

            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(@"
                UPDATE invoicing_settings
                SET culqi_mode = @modo, updated_at = NOW(), updated_by = @quien
                WHERE id = 1", conn);
            cmd.Parameters.AddWithValue("modo", esTest ? "test" : "live");
            cmd.Parameters.AddWithValue("quien", (object?)quien ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ct);

            // A nivel warning a propósito: quedarse en test sin darse cuenta significa
            // entregar coins y tiers sin cobrar, así que tiene que saltar en los logs.
            _logger.LogWarning("Modo de cobro cambiado a {Modo} por {Quien}", esTest ? "TEST" : "LIVE", quien ?? "?");

            return (true, null);
        }
    }
}
