namespace Decatron.Core.Models
{
    public class UserChannelPermissions
    {
        public long Id { get; set; }

        /// <summary>
        /// ID del dueño del canal (streamer)
        /// </summary>
        public long ChannelOwnerId { get; set; }

        /// <summary>
        /// ID del usuario que tiene acceso
        /// </summary>
        public long GrantedUserId { get; set; }

        /// <summary>
        /// Nivel de acceso: "commands", "moderation", "control_total"
        /// </summary>
        public string AccessLevel { get; set; } = "";

        /// <summary>
        /// Si el acceso está activo
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Quién otorgó el permiso
        /// </summary>
        public long GrantedBy { get; set; }

        /// <summary>
        /// Fecha de creación del permiso
        /// </summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Última actualización
        /// </summary>
        public DateTime UpdatedAt { get; set; }

        // Navegación
        public virtual User ChannelOwner { get; set; } = null!;
        public virtual User GrantedUser { get; set; } = null!;
        public virtual User GrantedByUser { get; set; } = null!;
    }
}