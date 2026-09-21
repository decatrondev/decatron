namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Puerto para mandar DMs de Discord desde Decatron.Business/Services, que
    /// no puede referenciar Decatron.Discord directamente (evita dependencia
    /// circular con Decatron.csproj). La implementacion real vive del lado de
    /// Decatron.Discord y se inyecta por DI.
    /// </summary>
    public interface IDiscordDmSender
    {
        /// <summary>Devuelve false si no se pudo mandar (id invalido, DMs cerrados, etc.) sin tirar excepcion.</summary>
        Task<bool> SendDmAsync(string discordUserId, string message);
    }
}
