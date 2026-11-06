using System;
using System.Net;
using System.Net.Http.Headers;
using Decatron.Core.Helpers;
using Xunit;

namespace Decatron.Tests;

/// <summary>Cuándo se deja de llamar a Spotify y cómo se interpretan sus errores: reglas puras.</summary>
public class SpotifyPollGuardTests
{
    private static readonly DateTime T0 = new(2026, 11, 6, 12, 0, 0, DateTimeKind.Utc);
    private static readonly TimeSpan Base = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan Max = TimeSpan.FromMinutes(5);

    [Fact]
    public void Sin_fallos_no_hay_ninguna_demora()
    {
        Assert.True(new SpotifyPollGuard().CanCall("canal", T0));
    }

    [Fact]
    public void El_429_respeta_el_RetryAfter_completo_aunque_pase_de_una_hora()
    {
        var guard = new SpotifyPollGuard();
        var wait = guard.PauseApp(TimeSpan.FromHours(3), T0);

        Assert.Equal(TimeSpan.FromHours(3), wait);
        Assert.False(guard.CanCall("canal", T0.AddHours(3).AddSeconds(-1)));
        Assert.True(guard.CanCall("canal", T0.AddHours(3)));
    }

    [Fact]
    public void El_429_detiene_a_todos_los_canales_porque_el_limite_es_de_la_app()
    {
        var guard = new SpotifyPollGuard();
        guard.PauseApp(TimeSpan.FromMinutes(1), T0);

        Assert.False(guard.CanCall("uno", T0.AddSeconds(30)));
        Assert.False(guard.CanCall("otro", T0.AddSeconds(30)));
    }

    [Fact]
    public void Un_429_mas_corto_no_acorta_la_pausa_en_curso()
    {
        var guard = new SpotifyPollGuard();
        guard.PauseApp(TimeSpan.FromMinutes(10), T0);
        guard.PauseApp(TimeSpan.FromSeconds(5), T0.AddSeconds(1));

        Assert.False(guard.CanCall("canal", T0.AddMinutes(9)));
    }

    [Fact]
    public void Sin_RetryAfter_la_pausa_crece_mientras_sigan_los_429()
    {
        var guard = new SpotifyPollGuard();

        Assert.Equal(TimeSpan.FromSeconds(30), guard.PauseApp(null, T0));
        var t = T0.AddMinutes(1);
        Assert.Equal(TimeSpan.FromSeconds(60), guard.PauseApp(null, t));
        t = t.AddMinutes(2);
        Assert.Equal(TimeSpan.FromSeconds(120), guard.PauseApp(null, t));
    }

    [Fact]
    public void Un_fallo_solo_detiene_a_ese_canal()
    {
        var guard = new SpotifyPollGuard();
        guard.RecordFailure("malo", T0, Base, Max);

        Assert.False(guard.CanCall("malo", T0.AddSeconds(14)));
        Assert.True(guard.CanCall("malo", T0.AddSeconds(15)));
        Assert.True(guard.CanCall("bueno", T0));
    }

    [Fact]
    public void Los_fallos_seguidos_duplican_la_espera_hasta_el_maximo()
    {
        var guard = new SpotifyPollGuard();
        double[] esperados = { 15, 30, 60, 120, 240, 300, 300 };
        foreach (var segundos in esperados)
            Assert.Equal(segundos, guard.RecordFailure("canal", T0, Base, Max).TotalSeconds);
    }

    [Fact]
    public void Una_respuesta_correcta_borra_los_fallos()
    {
        var guard = new SpotifyPollGuard();
        guard.RecordFailure("canal", T0, Base, Max);
        guard.RecordFailure("canal", T0, Base, Max);
        guard.RecordSuccess("canal");

        Assert.True(guard.CanCall("canal", T0));
        Assert.Equal(15, guard.RecordFailure("canal", T0, Base, Max).TotalSeconds);
    }

    [Fact]
    public void Reconectar_quita_la_espera_del_canal_pero_no_la_pausa_de_la_app()
    {
        var guard = new SpotifyPollGuard();
        guard.RecordFailure("canal", T0, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));
        guard.ForgetChannel("canal");
        Assert.True(guard.CanCall("canal", T0));

        guard.PauseApp(TimeSpan.FromMinutes(1), T0);
        guard.ForgetChannel("canal");
        Assert.False(guard.CanCall("canal", T0));
    }

    [Fact]
    public void Invalid_grant_pide_reconectar_y_conserva_el_detalle()
    {
        var r = SpotifyTokenResponse.ClassifyFailure(HttpStatusCode.BadRequest,
            "{\"error\":\"invalid_grant\",\"error_description\":\"Refresh token revoked\"}", null);

        Assert.Equal(SpotifyRefreshOutcome.ReauthRequired, r.Outcome);
        Assert.Equal("invalid_grant: Refresh token revoked", r.Error);
    }

    [Fact]
    public void Otro_400_no_marca_la_cuenta_para_reconectar()
    {
        var r = SpotifyTokenResponse.ClassifyFailure(HttpStatusCode.BadRequest, "{\"error\":\"invalid_client\"}", null);

        Assert.Equal(SpotifyRefreshOutcome.Failed, r.Outcome);
        Assert.Equal("invalid_client", r.Error);
    }

    [Fact]
    public void El_429_al_renovar_trae_su_espera()
    {
        var r = SpotifyTokenResponse.ClassifyFailure(HttpStatusCode.TooManyRequests, "", TimeSpan.FromSeconds(90));

        Assert.Equal(SpotifyRefreshOutcome.RateLimited, r.Outcome);
        Assert.Equal(TimeSpan.FromSeconds(90), r.RetryAfter);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadGateway, "<html>Bad gateway</html>")]
    [InlineData(HttpStatusCode.BadRequest, "no es json")]
    [InlineData(HttpStatusCode.InternalServerError, "")]
    [InlineData(HttpStatusCode.BadRequest, "[1,2]")]
    public void Una_respuesta_rara_es_un_fallo_temporal(HttpStatusCode status, string body)
    {
        var r = SpotifyTokenResponse.ClassifyFailure(status, body, null);

        Assert.Equal(SpotifyRefreshOutcome.Failed, r.Outcome);
        Assert.Equal(status.ToString(), r.Error);
    }

    [Fact]
    public void RetryAfter_se_lee_en_segundos_o_como_fecha()
    {
        var now = new DateTimeOffset(T0);

        Assert.Equal(TimeSpan.FromSeconds(40), SpotifyTokenResponse.ParseRetryAfter(new RetryConditionHeaderValue(TimeSpan.FromSeconds(40)), now));
        Assert.Equal(TimeSpan.FromMinutes(2), SpotifyTokenResponse.ParseRetryAfter(new RetryConditionHeaderValue(now.AddMinutes(2)), now));
        Assert.Null(SpotifyTokenResponse.ParseRetryAfter(new RetryConditionHeaderValue(now.AddMinutes(-2)), now));
        Assert.Null(SpotifyTokenResponse.ParseRetryAfter(null, now));
    }

    [Fact]
    public void La_autorizacion_vence_a_los_seis_meses_y_sin_fecha_no_se_inventa()
    {
        Assert.Equal(new DateTime(2027, 5, 6, 12, 0, 0, DateTimeKind.Utc), SpotifyConnectionStatus.AuthorizationExpiresAt(T0));
        Assert.Null(SpotifyConnectionStatus.AuthorizationExpiresAt(null));
    }
}
