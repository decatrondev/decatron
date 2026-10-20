using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tts
{
    /// <summary>
    /// Una vez al día pregunta a Fish por cada voz activa del catálogo. Si Fish ya no la devuelve (404), o la
    /// retiraron / la hicieron privada, queda inactiva: su <c>reference_id</c> deja de funcionar y así los canales
    /// pasan a la voz predeterminada en vez de fallar cada vez. Un error de red no cambia nada. Consultar no cuesta.
    /// </summary>
    public sealed class FishVoiceHealthService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<FishVoiceHealthService> _logger;

        public FishVoiceHealthService(IServiceScopeFactory scopes, ILogger<FishVoiceHealthService> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); } catch (OperationCanceledException) { return; }
            while (!stoppingToken.IsCancellationRequested)
            {
                try { await CheckAsync(stoppingToken); }
                catch (OperationCanceledException) { return; }
                catch (Exception ex) { _logger.LogWarning(ex, "[FishVoices] Chequeo diario falló"); }
                try { await Task.Delay(TimeSpan.FromHours(24), stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }

        public async Task CheckAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var fish = scope.ServiceProvider.GetRequiredService<FishTtsClient>();

            var active = await db.TtsFishVoices.Where(v => v.Active).ToListAsync(ct);
            foreach (var voice in active)
            {
                try
                {
                    var model = await fish.GetModelAsync(voice.ReferenceId, ct);
                    voice.LastCheckedAt = DateTimeOffset.UtcNow;
                    if (model == null)
                    {
                        voice.Active = false;
                        voice.InactiveReason = "missing";
                        _logger.LogWarning("[FishVoices] {Name} ({Id}): Fish ya no la devuelve, queda inactiva", voice.Name, voice.ReferenceId);
                    }
                    else if (model.TakenDown || !string.Equals(model.Visibility, "public", StringComparison.OrdinalIgnoreCase))
                    {
                        voice.Active = false;
                        voice.InactiveReason = "takedown";
                        _logger.LogWarning("[FishVoices] {Name} ({Id}): retirada o ya no es pública, queda inactiva", voice.Name, voice.ReferenceId);
                    }
                }
                catch (FishTtsException ex)
                {
                    _logger.LogInformation("[FishVoices] {Id}: no se pudo consultar ({Msg}), se deja como está", voice.ReferenceId, ex.Message);
                }
                catch (HttpRequestException) { }
            }
            await db.SaveChangesAsync(ct);
        }
    }
}
