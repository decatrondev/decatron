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
}
