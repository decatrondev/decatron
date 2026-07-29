using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Emite los comprobantes de las compras de tier que quedaron pendientes.
    ///
    /// <para>Existe para que la emisión no viva dentro del cobro. Si SUNAT está caída o
    /// DecatronAPI no responde, el supporter igual recibe su tier y el comprobante sale
    /// cuando se pueda: el plazo para informar es de días, no de segundos.</para>
    /// </summary>
    public class SupporterInvoiceBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<SupporterInvoiceBackgroundService> _logger;
        private readonly TimeSpan _intervalo = TimeSpan.FromMinutes(2);

        public SupporterInvoiceBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<SupporterInvoiceBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Servicio de comprobantes de supporters iniciado");

            // Un respiro al arranque: la base y la configuración primero.
            await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var servicio = scope.ServiceProvider.GetRequiredService<ISupporterInvoiceService>();

                    var emitidos = await servicio.ProcesarPendientesAsync(stoppingToken);
                    if (emitidos > 0)
                        _logger.LogInformation("{Count} comprobante(s) de supporters emitido(s)", emitidos);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    // Que falle una vuelta no puede matar el servicio.
                    _logger.LogError(ex, "Error procesando comprobantes de supporters");
                }

                try { await Task.Delay(_intervalo, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }

            _logger.LogInformation("Servicio de comprobantes de supporters detenido");
        }
    }
}
