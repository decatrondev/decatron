using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Caché perezoso de categorías de Kick (equivalente a <see cref="GameCache"/> de Twitch): lo que se busca en la API se guarda.
    /// SQL: Decatron.Data/Migrations/Add_Kick_Category_Cache.sql
    /// </summary>
    [Table("kick_category_cache")]
    public class KickCategoryCache
    {
        [Key, Column("category_id")]
        public long CategoryId { get; set; }

        [Required, MaxLength(255), Column("name")]
        public string Name { get; set; } = "";

        [MaxLength(500), Column("thumbnail")]
        public string? Thumbnail { get; set; }

        [Column("usage_count")]
        public int UsageCount { get; set; }

        [Column("last_updated")]
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Lo que se necesita de GET /public/v1/channels. La respuesta completa incluye la clave de transmisión: no se guarda ni se loga.</summary>
    public record KickChannelInfo(string StreamTitle, long CategoryId, string CategoryName);

    public record KickCategory(long Id, string Name, string? Thumbnail);

    /// <summary>Resultado de PATCH /public/v1/channels. NeedsRelink = el token no sirve o no tiene channel:write.</summary>
    public record KickUpdateResult(bool Ok, bool NeedsRelink);
}

namespace Decatron.Core.Models
{
    /// <summary>
    /// ¿Aplicar !title / !game / micro comandos en las dos plataformas a la vez? Una fila por cuenta (la de la fila principal).
    /// Sin fila = apagado. SQL: Decatron.Data/Migrations/Add_Title_Game_Sync.sql
    /// </summary>
    [System.ComponentModel.DataAnnotations.Schema.Table("title_game_sync_settings")]
    public class TitleGameSyncSetting
    {
        [System.ComponentModel.DataAnnotations.Key, System.ComponentModel.DataAnnotations.Schema.Column("user_id")]
        public long UserId { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.Column("enabled")]
        public bool Enabled { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
