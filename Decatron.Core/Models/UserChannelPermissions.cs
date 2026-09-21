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
        /// Acceso "vanish": sigue funcionando igual, pero en Gestión de Accesos solo lo ven
        /// el dueño del canal y el propio usuario. Solo el dueño lo puede cambiar.
        /// </summary>
        public bool IsHidden { get; set; } = false;

        /// <summary>
        /// Nombre con el que otros usuarios con acceso ven esta fila ("Dev", "Mod X"…)
        /// en vez del login real. null = se muestra el nombre real. Solo el dueño lo edita.
        /// </summary>
        public string? Alias { get; set; }

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