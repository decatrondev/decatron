using Decatron.Core.Models;
using Xunit;

namespace Decatron.Tests;

/// <summary>Giveaways F2: las opciones configurables nunca rompen el sorteo, aunque el JSON guardado sea viejo, parcial o dañado.</summary>
public class GiveawaySettingsTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("{}")]
    [InlineData("no es json")]
    [InlineData("[1,2,3]")]
    [InlineData("{\"weightLimits\": 5}")]
    public void Parse_siempre_devuelve_valores_por_defecto(string? json)
    {
        var s = GiveawaySettings.Parse(json);

        Assert.Equal(1000, s.WeightLimits.MaxPerFactor);
        Assert.Equal(10000, s.WeightLimits.MaxTotal);
        Assert.Equal(1, s.WeightLimits.Min);
        Assert.Equal(30, s.Reminders.StopBeforeEndSeconds);
        Assert.Equal(24, s.Reminders.MaxAgeHours);
        Assert.Equal(1, s.MultiAccount.SameCreationDays);
        Assert.Equal(30, s.MultiAccount.NewAccountDays);
        Assert.True(s.Roles.StreamerCanJoin);
        Assert.True(s.Roles.LeadModCountsAsMod);
        Assert.False(s.Rejections.AnnounceInChat);
        Assert.Equal("", s.Messages.Joined);
    }

    [Fact]
    public void Parse_respeta_lo_que_el_streamer_configuro_y_deja_el_resto_por_defecto()
    {
        var s = GiveawaySettings.Parse("{\"messages\":{\"joined\":\"hola {user}\"},\"weightLimits\":{\"maxPerFactor\":5},\"roles\":{\"streamerCanJoin\":false}}");

        Assert.Equal("hola {user}", s.Messages.Joined);
        Assert.Equal(5, s.WeightLimits.MaxPerFactor);
        Assert.Equal(10000, s.WeightLimits.MaxTotal);   // no tocado
        Assert.False(s.Roles.StreamerCanJoin);
        Assert.True(s.Roles.LeadModCountsAsMod);         // no tocado
    }

    [Fact]
    public void Parse_no_distingue_mayusculas_en_las_claves()
    {
        var s = GiveawaySettings.Parse("{\"Roles\":{\"STREAMERCANJOIN\":false}}");
        Assert.False(s.Roles.StreamerCanJoin);
    }

    [Fact]
    public void Rechazos_usan_el_texto_del_streamer_y_si_esta_vacio_el_de_por_defecto()
    {
        var s = GiveawaySettings.Parse("{\"rejections\":{\"messages\":{\"not_follower\":\"sigue el canal @{user}\",\"cooldown\":\"  \"}}}");

        Assert.Equal("sigue el canal @{user}", s.Rejections.TextFor("not_follower"));
        Assert.Equal(GiveawayRejections.DefaultMessages["cooldown"], s.Rejections.TextFor("cooldown")); // vacío = por defecto
        Assert.Equal("", s.Rejections.TextFor("motivo_que_no_existe"));
    }

    [Fact]
    public void Todo_motivo_de_rechazo_que_emite_el_servicio_tiene_texto_por_defecto_salvo_los_tecnicos()
    {
        // Los códigos que ValidateRequirements/AddParticipant pueden devolver y que el viewer debe entender
        var visibles = new[] { "not_follower", "not_subscriber", "watch_time", "account_age", "account_age_unknown", "follow_age",
            "follow_age_unknown", "chat_messages", "cooldown", "blacklisted", "not_in_whitelist", "vip_not_allowed", "mod_not_allowed",
            "streamer_not_allowed", "full", "multi_account", "duplicate_ip" };
        foreach (var code in visibles)
            Assert.True(GiveawayRejections.DefaultMessages.ContainsKey(code), $"falta el texto por defecto de «{code}»");
    }

    [Fact]
    public void Por_defecto_solo_Twitch_esta_activo_y_lo_no_verificable_se_omite()
    {
        var p = GiveawaySettings.Parse("{}").Platforms;
        Assert.True(p.IsEnabled("twitch"));
        Assert.False(p.IsEnabled("kick"));
        Assert.False(p.IsEnabled("youtube")); // una plataforma sin adaptador nunca entra
        Assert.Equal("allow", p.Unverifiable);
    }

    [Fact]
    public void Las_plataformas_se_leen_del_json_guardado()
    {
        var p = GiveawaySettings.Parse("{\"platforms\":{\"kick\":true,\"unverifiable\":\"reject\"}}").Platforms;
        Assert.True(p.Twitch);
        Assert.True(p.IsEnabled("kick"));
        Assert.Equal("reject", p.Unverifiable);
    }

    [Fact]
    public void Twitch_lo_comprueba_todo_y_Kick_solo_los_roles()
    {
        foreach (var c in GiveawayCapabilities.All)
            Assert.True(GiveawayCapabilities.CanVerify("twitch", c), $"Twitch debe poder comprobar {c}");

        Assert.True(GiveawayCapabilities.CanVerify("kick", GiveawayCapabilities.Roles));
        foreach (var c in GiveawayCapabilities.All.Where(c => c != GiveawayCapabilities.Roles))
            Assert.False(GiveawayCapabilities.CanVerify("kick", c), $"Kick no puede comprobar {c}");

        Assert.False(GiveawayCapabilities.CanVerify("tiktok", GiveawayCapabilities.Roles)); // plataforma desconocida
    }

    [Fact]
    public void Los_motivos_de_plataforma_tienen_texto_por_defecto()
    {
        foreach (var code in new[] { "platform_disabled", "unverifiable_follower", "unverifiable_follow_age",
            "unverifiable_account_age", "unverifiable_watch_time", "unverifiable_chat_messages" })
            Assert.True(GiveawayRejections.DefaultMessages.ContainsKey(code), $"falta el texto por defecto de «{code}»");
    }

    [Fact]
    public void El_overlay_tiene_tiempos_por_defecto_y_se_leen_del_json()
    {
        var d = GiveawaySettings.Parse("{}").Overlay;
        Assert.Equal(8, d.RevealSeconds);
        Assert.Equal(15, d.ResultSeconds);

        var c = GiveawaySettings.Parse("{\"overlay\":{\"revealSeconds\":3}}").Overlay;
        Assert.Equal(3, c.RevealSeconds);
        Assert.Equal(15, c.ResultSeconds);
    }

    [Fact]
    public void El_overlay_usa_por_defecto_el_tema_de_Song_Request()
    {
        var o = GiveawaySettings.Parse("{}").Overlay;
        Assert.Equal("#39ff14", o.Theme.Accent);
        Assert.Equal("rgba(10, 10, 15, 0.85)", o.Theme.PanelBackground);
        Assert.Equal(18, o.Theme.PanelRadius);
        Assert.Equal("Inter", o.Font);
        Assert.Equal("fade", o.Enter.Type);
        Assert.Equal(600, o.Exit.DurationMs);

        var c = GiveawaySettings.Parse("{\"overlay\":{\"theme\":{\"accent\":\"#ff0000\"}}}").Overlay;
        Assert.Equal("#ff0000", c.Theme.Accent);
        Assert.Equal(18, c.Theme.PanelRadius); // lo que falta queda por defecto
    }

    [Fact]
    public void Las_fechas_del_overlay_salen_en_UTC_con_la_Z()
    {
        // La base devuelve «sin zona»; sin la Z el navegador las lee como hora local y la ruleta nunca arranca (bug 2026-10-22)
        var sinZona = new DateTime(2026, 10, 23, 0, 9, 11, DateTimeKind.Unspecified);
        var json = System.Text.Json.JsonSerializer.Serialize(Decatron.Services.GiveawayOverlayService.AsUtc(sinZona));
        Assert.EndsWith("Z\"", json);
        Assert.Null(Decatron.Services.GiveawayOverlayService.AsUtc((DateTime?)null));
    }

    [Fact]
    public void Los_comandos_de_chat_tienen_valores_por_defecto_y_aceptan_cambios()
    {
        var c = GiveawaySettings.Parse("{}").Commands;
        Assert.True(c.Enabled);
        Assert.Equal("!giveaway", c.Root);
        Assert.Equal("!ganadores", c.WinnersCommand);
        Assert.Equal(1, c.MinRank); // moderadores (y por encima)
        Assert.Contains("Uso:", c.Text("usage"));

        var custom = GiveawaySettings.Parse("{\"commands\":{\"root\":\"!sorteo2\",\"minRole\":\"broadcaster\",\"texts\":{\"none_active\":\"Nada en curso\",\"usage\":\"  \"}}}").Commands;
        Assert.Equal("!sorteo2", custom.Root);
        Assert.Equal(3, custom.MinRank);
        Assert.Equal("Nada en curso", custom.Text("none_active"));
        Assert.Contains("Uso:", custom.Text("usage")); // texto en blanco = el de por defecto
        Assert.Equal(2, GiveawaySettings.Parse("{\"commands\":{\"minRole\":\"lead_moderator\"}}").Commands.MinRank);
    }

    [Fact]
    public void Los_nombres_de_comando_se_normalizan()
    {
        Assert.Equal("!giveaway", GiveawayCommandRules.Normalize("  ", "!giveaway"));
        Assert.Equal("!sorteo", GiveawayCommandRules.Normalize("Sorteo", "!giveaway"));
        Assert.Equal("!sorteo", GiveawayCommandRules.Normalize("!SORTEO", "!giveaway"));
    }

    [Fact]
    public void Todo_texto_de_comando_por_defecto_tiene_su_clave()
    {
        // El panel muestra estas claves (COMMAND_TEXTS); una que falte aquí respondería vacío en el chat
        foreach (var key in new[] { "usage", "no_config", "no_prize", "already_active", "none_active", "cancel_done", "no_one_to_reroll", "pick_missing",
            "pick_not_found", "status_open", "status_drawing", "status_none", "remaining_timed", "remaining_manual", "leave_done", "leave_not_in",
            "leave_closed", "me_in", "me_out", "winners", "winners_none" })
            Assert.False(string.IsNullOrWhiteSpace(new GiveawayCommandRules().Text(key)), key);
    }
}
