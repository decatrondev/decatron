using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Decatron.Attributes
{
    /// <summary>
    /// Traduce el rechazo por permisos del TCG a un 403 con mensaje, en vez del 500 que
    /// saldría por dejar escapar la excepción.
    ///
    /// <para>Existe porque el proyecto no tiene manejo global de excepciones: sin esto,
    /// intentar operar el TCG de un canal sin <c>control_total</c> se vería como "error
    /// del servidor" y mandaría a buscar el problema donde no está.</para>
    /// </summary>
    public class TcgAccessExceptionFilter : ExceptionFilterAttribute
    {
        public override void OnException(ExceptionContext context)
        {
            if (context.Exception is not UnauthorizedAccessException ex) return;

            context.Result = new ObjectResult(new { error = ex.Message }) { StatusCode = 403 };
            context.ExceptionHandled = true;
        }
    }
}
