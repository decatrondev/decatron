using Decatron.Attributes;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace Decatron.Controllers
{
    /// <summary>
    /// Radiografía del proyecto para el panel de administración.
    ///
    /// No acepta ninguna ruta desde fuera: analiza siempre el proyecto donde corre el
    /// bot. Dejar que el navegador mande un directorio a escanear sería regalar un
    /// lector de archivos del servidor.
    /// </summary>
    [ApiController]
    [Route("api/admin/project-analysis")]
    [Authorize]
    [RequireSystemOwner]
    public class ProjectAnalysisController : ControllerBase
    {
        private readonly ProjectAnalysisService _analysis;
        private readonly ILogger<ProjectAnalysisController> _logger;

        public ProjectAnalysisController(
            ProjectAnalysisService analysis,
            ILogger<ProjectAnalysisController> logger)
        {
            _analysis = analysis;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] bool refresh = false)
        {
            try
            {
                var result = await _analysis.GetAsync(refresh);
                return Ok(new { success = true, analysis = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ProjectAnalysis] Error analizando el proyecto");
                return StatusCode(500, new { success = false, message = "No se pudo analizar el proyecto" });
            }
        }
    }
}
