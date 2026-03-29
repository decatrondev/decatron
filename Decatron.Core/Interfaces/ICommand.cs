using Decatron.Services;
using Decatron.Core.Models;
using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Interface para comandos de chat del bot
    /// </summary>
    public interface ICommand
    {
        /// <summary>
        /// Nombre del comando (sin !)
        /// </summary>
        string Name { get; }

        /// <summary>
        /// Descripción del comando
        /// </summary>
        string Description { get; }

        /// <summary>
        /// Ejecuta el comando
        /// </summary>
        /// <param name="context">Contexto del comando con toda la información del mensaje y usuario</param>
        /// <param name="messageSender">Servicio para enviar respuestas</param>
        Task ExecuteAsync(CommandContext context, IMessageSender messageSender);
    }
}