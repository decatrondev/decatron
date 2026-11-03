using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Helpers;
using Xunit;

namespace Decatron.Tests;

/// <summary>Sincronización de seguidores: reglas puras (altas, regresos, renombres, unfollows y protecciones).</summary>
public class FollowersSyncPlannerTests
{
    private static SyncRemoteFollower R(string id, string name = null, string login = null) =>
        new(id, name ?? "u" + id, login ?? "u" + id);

    private static SyncKnownFollower K(string id, bool unfollowed = false, string name = null, string login = null) =>
        new(id, name ?? "u" + id, login ?? "u" + id, unfollowed);

    private static List<SyncKnownFollower> Known(int n) =>
        Enumerable.Range(1, n).Select(i => K(i.ToString())).ToList();

    private static List<SyncRemoteFollower> Remote(int from, int to) =>
        Enumerable.Range(from, to - from + 1).Select(i => R(i.ToString())).ToList();

    [Fact]
    public void SeguidorNuevo_SeAgrega()
    {
        var p = FollowersSyncPlanner.Plan(new[] { R("1"), R("2") }, new[] { K("1") }, true, 2);
        Assert.Equal(new[] { "2" }, p.NewIds);
        Assert.Empty(p.UnfollowIds);
    }

    [Fact]
    public void QuienVuelve_SeMarcaRetornado()
    {
        var p = FollowersSyncPlanner.Plan(new[] { R("1") }, new[] { K("1", unfollowed: true) }, true, 1);
        Assert.Equal(new[] { "1" }, p.ReturnedIds);
    }

    [Fact]
    public void CambioDeNombre_SeDetectaPorId()
    {
        var p = FollowersSyncPlanner.Plan(
            new[] { R("501", "sebadeotradimension", "sebadeotradimension") },
            new[] { K("501", name: "sebaguz92", login: "sebaguz92") }, true, 1);
        var r = Assert.Single(p.Renames);
        Assert.Equal("501", r.UserId);
        Assert.Equal("sebadeotradimension", r.NewName);
        Assert.Equal("sebadeotradimension", r.NewLogin);
        Assert.Empty(p.NewIds);
    }

    [Fact]
    public void SoloCambiaMayusculas_TambienSeActualiza()
    {
        var p = FollowersSyncPlanner.Plan(new[] { R("1", "Ana", "ana") }, new[] { K("1", name: "ana", login: "ana") }, true, 1);
        Assert.Single(p.Renames);
    }

    [Fact]
    public void NombreVacioDeLaPlataforma_NoBorraElGuardado()
    {
        var p = FollowersSyncPlanner.Plan(new[] { new SyncRemoteFollower("1", "", "") }, new[] { K("1", name: "ana", login: "ana") }, true, 1);
        Assert.Empty(p.Renames);
    }

    [Fact]
    public void QuienYaNoEsta_ConListaCompleta_EsUnfollow()
    {
        var p = FollowersSyncPlanner.Plan(Remote(1, 99), Known(100), true, 99);
        Assert.Equal(new[] { "100" }, p.UnfollowIds);
        Assert.Equal(SyncUnfollowSkipReason.None, p.UnfollowSkipped);
    }

    [Fact]
    public void ListaIncompleta_NoMarcaUnfollows_PeroSiAgregaYRenombra()
    {
        var known = Known(100);
        known[0] = K("1", name: "viejo", login: "viejo");
        var remote = new List<SyncRemoteFollower> { R("1", "nuevo", "nuevo"), R("500") };
        var p = FollowersSyncPlanner.Plan(remote, known, false, 100);
        Assert.Empty(p.UnfollowIds);
        Assert.Equal(SyncUnfollowSkipReason.IncompleteList, p.UnfollowSkipped);
        Assert.Equal(new[] { "500" }, p.NewIds);
        Assert.Single(p.Renames);
    }

    [Fact]
    public void ListaVacia_ConActivosGuardados_NoMarcaUnfollows()
    {
        var p = FollowersSyncPlanner.Plan(new List<SyncRemoteFollower>(), Known(10), true, 0);
        Assert.Empty(p.UnfollowIds);
        Assert.Equal(SyncUnfollowSkipReason.EmptyList, p.UnfollowSkipped);
    }

    [Fact]
    public void ListaVacia_SinActivosGuardados_NoEsProblema()
    {
        var p = FollowersSyncPlanner.Plan(new List<SyncRemoteFollower>(), new List<SyncKnownFollower>(), true, 0);
        Assert.Equal(SyncUnfollowSkipReason.None, p.UnfollowSkipped);
    }

    [Fact]
    public void MenosDeLoQueDiceLaPlataforma_SeConsideraIncompleta()
    {
        // Twitch dice 3000 pero solo llegaron 2000 (aunque no hubo error visible).
        var p = FollowersSyncPlanner.Plan(Remote(1, 2000), Known(3000), true, 3000);
        Assert.Empty(p.UnfollowIds);
        Assert.Equal(SyncUnfollowSkipReason.CountMismatch, p.UnfollowSkipped);
    }

    [Fact]
    public void DiferenciaPequenaConElTotal_Se_Tolera()
    {
        // Entró alguien durante la paginación: el total sube y la lista trae uno menos.
        var p = FollowersSyncPlanner.Plan(Remote(1, 2999), Known(3000), true, 3001);
        Assert.Equal(SyncUnfollowSkipReason.None, p.UnfollowSkipped);
        Assert.Single(p.UnfollowIds);
    }

    [Fact]
    public void BajaMasivaDeGolpe_EsSospechosa()
    {
        // 3000 guardados y de golpe faltan 400 (más del 10 %) con la lista «completa».
        var p = FollowersSyncPlanner.Plan(Remote(1, 2600), Known(3000), true, 2600);
        Assert.Empty(p.UnfollowIds);
        Assert.Equal(SyncUnfollowSkipReason.SuspiciousDrop, p.UnfollowSkipped);
        Assert.Equal(400, p.MissingCount);
    }

    [Fact]
    public void CanalChico_HastaElMinimoAbsoluto_NoEsSospechoso()
    {
        // 15 guardados, se van 10: es gente real aunque sea más del 10 %.
        var p = FollowersSyncPlanner.Plan(Remote(1, 5), Known(15), true, 5);
        Assert.Equal(10, p.UnfollowIds.Count);
        Assert.Equal(SyncUnfollowSkipReason.None, p.UnfollowSkipped);
    }

    [Fact]
    public void QuienYaEraUnfollow_NoSeVuelveAMarcar()
    {
        var known = new List<SyncKnownFollower> { K("1"), K("2", unfollowed: true) };
        var p = FollowersSyncPlanner.Plan(new[] { R("1") }, known, true, 1);
        Assert.Empty(p.UnfollowIds);
    }
}
