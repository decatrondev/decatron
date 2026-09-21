using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>
    /// Una rueda configurable. Un streamer tiene varias; cada una es de un solo
    /// modo (Premios o Sorteo), elegido al crearla y ya no se cambia.
    ///
    /// <para>El dueño se guarda como <see cref="ChannelId"/> apuntando a users(id),
    /// no como login en texto: la URL del overlay sigue siendo
    /// <c>?channel=&lt;login&gt;</c>, pero se resuelve a id al entrar, así un cambio
    /// de nombre en Twitch no deja la rueda huérfana.</para>
    /// </summary>
    [Table("wheels")]
    public class Wheel
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("channel_id")]
        public long ChannelId { get; set; }

        [ForeignKey("ChannelId")]
        public User? Channel { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(80)]
        public string Name { get; set; } = string.Empty;

        /// <summary>"prizes" o "raffle". Inmutable tras crear.</summary>
        [Required]
        [Column("mode")]
        [MaxLength(10)]
        public string Mode { get; set; } = WheelModes.Prizes;

        [Column("is_enabled")]
        public bool IsEnabled { get; set; } = true;

        /// <summary>
        /// Solo marca cuál destaca el panel. Varias ruedas pueden estar habilitadas
        /// a la vez, cada una con su propio overlay.
        /// </summary>
        [Column("is_active")]
        public bool IsActive { get; set; }

        /// <summary>Nombre visible de los créditos: "fichas", "puntos de aporte"…</summary>
        [Required]
        [Column("credit_label")]
        [MaxLength(30)]
        public string CreditLabel { get; set; } = "creditos";

        [Column("spin_price")]
        public int SpinPrice { get; set; } = 100;

        /// <summary>Si los aportes por debajo del precio se guardan o se descartan.</summary>
        [Column("is_accumulable")]
        public bool IsAccumulable { get; set; } = true;

        /// <summary>"discard" o "cheapest_spins", cuando NO es acumulable.</summary>
        [Required]
        [Column("overflow_policy")]
        [MaxLength(20)]
        public string OverflowPolicy { get; set; } = "discard";

        /// <summary>"most_expensive", "most_spins" o "viewer_choice".</summary>
        [Required]
        [Column("multi_fit_policy")]
        [MaxLength(20)]
        public string MultiFitPolicy { get; set; } = "most_spins";

        /// <summary>"never", "stream_end" o "days".</summary>
        [Required]
        [Column("credit_expiry")]
        [MaxLength(20)]
        public string CreditExpiry { get; set; } = "never";

        [Column("credit_expiry_days")]
        public int? CreditExpiryDays { get; set; }

        /// <summary>"off", "per_viewer" o "global".</summary>
        [Required]
        [Column("no_repeat_scope")]
        [MaxLength(20)]
        public string NoRepeatScope { get; set; } = "off";

        [Column("pity_enabled")]
        public bool PityEnabled { get; set; }

        [Column("pity_threshold")]
        public int? PityThreshold { get; set; }

        [Column("allow_multi_spin")]
        public bool AllowMultiSpin { get; set; }

        [Column("max_multi_spin")]
        public int MaxMultiSpin { get; set; } = 10;

        /// <summary>Identificador de la URL del overlay. Único dentro del canal.</summary>
        [Required]
        [Column("slug")]
        [MaxLength(40)]
        public string Slug { get; set; } = string.Empty;

        /// <summary>Si el saldo de créditos se muestra públicamente. Default privado.</summary>
        [Column("credits_public")]
        public bool CreditsPublic { get; set; }

        // ----------------------------------------------------------------
        // Disparadores del giro y topes (Fase 2, sección 6.2 del plan)
        // ----------------------------------------------------------------

        /// <summary>Comando de chat para girar. Validado contra los comandos reservados.</summary>
        [Required]
        [Column("spin_command")]
        [MaxLength(30)]
        public string SpinCommand { get; set; } = "!dgirar";

        /// <summary>Comando para consultar el saldo de la billetera.</summary>
        [Required]
        [Column("balance_command")]
        [MaxLength(30)]
        public string BalanceCommand { get; set; } = "!dcreditos";

        /// <summary>
        /// Comando con el que un espectador compra créditos gastando deca coins.
        /// Solo responde si la fuente <c>deca_coins</c> está encendida en esta rueda:
        /// el interruptor de la fuente es el que manda, no hace falta otro.
        /// </summary>
        [Required]
        [Column("buy_command")]
        [MaxLength(50)]
        public string BuyCommand { get; set; } = "!dcomprar";

        /// <summary>El streamer puede apagar los comandos y girar solo desde el panel.</summary>
        [Column("command_enabled")]
        public bool CommandEnabled { get; set; } = true;

        /// <summary>Apenas el saldo alcanza el precio, la rueda gira sola.</summary>
        [Column("auto_spin")]
        public bool AutoSpin { get; set; }

        /// <summary>Segundos entre giros del mismo espectador. 0 = sin espera.</summary>
        [Column("spin_cooldown_seconds")]
        public int SpinCooldownSeconds { get; set; }

        /// <summary>Giros por espectador y por stream. NULL = sin tope.</summary>
        [Column("max_spins_per_stream")]
        public int? MaxSpinsPerStream { get; set; }

        /// <summary>
        /// Techo de coins que la rueda reparte por hora. Es el freno que evita que
        /// una mala configuración de pesos vacíe la economía del canal en una tarde.
        /// NULL = sin tope.
        /// </summary>
        [Column("max_coins_per_hour")]
        public int? MaxCoinsPerHour { get; set; }

        /// <summary>Colores, imagen central, puntero, fuentes, tiempos, sonidos, celebración.</summary>
        [Required]
        [Column("visual_config", TypeName = "jsonb")]
        public string VisualConfig { get; set; } = "{}";

        /// <summary>Textos de anuncio en chat y overlay (en/es).</summary>
        [Required]
        [Column("announce_config", TypeName = "jsonb")]
        public string AnnounceConfig { get; set; } = "{}";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [NotMapped]
        public bool EsModoSorteo => string.Equals(Mode, WheelModes.Raffle, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Los dos modos. Una rueda no cambia de modo después de creada.</summary>
    /// <summary>
    /// Qué hacer cuando un solo aporte alcanza para varios giros.
    /// </summary>
    public static class WheelMultiFitPolicies
    {
        /// <summary>Todos los giros que alcancen.</summary>
        public const string MostSpins     = "most_spins";
        /// <summary>Un solo giro, el más caro posible.</summary>
        public const string MostExpensive = "most_expensive";
        /// <summary>
        /// Se acredita todo y NO se gira solo: el espectador decide cuántos gasta,
        /// con el comando de girar y su argumento (<c>!dgirar 3</c>).
        /// </summary>
        public const string ViewerChoice  = "viewer_choice";

        public static bool EsValida(string? v) => v is MostSpins or MostExpensive or ViewerChoice;
    }

    /// <summary>Alcances de la regla de no repetir el último resultado.</summary>
    public static class WheelNoRepeatScopes
    {
        public const string Off       = "off";
        /// <summary>No repetir lo último que le salió a esa persona.</summary>
        public const string PerViewer = "per_viewer";
        /// <summary>No repetir lo último que salió en la rueda, sea de quien sea.</summary>
        public const string Global    = "global";

        public static bool EsValido(string? v) => v is Off or PerViewer or Global;
    }

    public static class WheelModes
    {
        public const string Prizes = "prizes";
        public const string Raffle = "raffle";
    }
}
