using System;
using System.Linq;
using Decatron.Services.Promo;
using Xunit;

namespace Decatron.Tests;

/// <summary>Promociones F6: el informe CSV de publicidad de terceros (sin base de datos).</summary>
public class PromoReportTests
{
    private static readonly DateTime Hoy = new(2026, 10, 29);

    [Fact(DisplayName = "Promo: el informe CSV lista por anunciante, pieza y día, con fila TOTAL")]
    public void CsvConTotal()
    {
        var csv = PromoReport.ToCsv(new[]
        {
            new PromoReportRow("Tienda Sol", 7, "Oferta", new DateTime(2026, 10, 2), 10, 80, 1),
            new PromoReportRow("Tienda Sol", 7, "Oferta", new DateTime(2026, 10, 1), 5, 40, 0),
        });
        var lines = csv.TrimEnd('\n').Split('\n');
        Assert.Equal(PromoReport.Header, lines[0]);
        Assert.Equal("Tienda Sol,7,Oferta,2026-10-01,5,40,0", lines[1]);
        Assert.Equal("Tienda Sol,7,Oferta,2026-10-02,10,80,1", lines[2]);
        Assert.Equal("TOTAL,,,,15,120,1", lines[3]);
    }

    [Fact(DisplayName = "Promo: el informe vacío trae solo el encabezado")]
    public void CsvVacio() => Assert.Equal(PromoReport.Header + "\n", PromoReport.ToCsv(Array.Empty<PromoReportRow>()));

    [Theory(DisplayName = "Promo: el CSV escapa comas, comillas y fórmulas de hoja de cálculo")]
    [InlineData("Casa, Hogar", "\"Casa, Hogar\"")]
    [InlineData("Dice \"hola\"", "\"Dice \"\"hola\"\"\"")]
    [InlineData("=SUMA(A1)", "'=SUMA(A1)")]
    [InlineData("@usuario", "'@usuario")]
    [InlineData("Normal", "Normal")]
    public void CsvEscapa(string entrada, string esperado) => Assert.Equal(esperado, PromoReport.Field(entrada));

    [Fact(DisplayName = "Promo: el rango del informe usa 30 días por defecto y rechaza lo invertido o mayor a un año")]
    public void Rango()
    {
        var (f, t, e) = PromoReport.Range(null, null, Hoy);
        Assert.Null(e); Assert.Equal(Hoy, t); Assert.Equal(Hoy.AddDays(-29), f);
        Assert.Equal("rangeOrder", PromoReport.Range(Hoy, Hoy.AddDays(-1), Hoy).Error);
        Assert.Equal("rangeTooLong", PromoReport.Range(Hoy.AddDays(-400), Hoy, Hoy).Error);
        Assert.Null(PromoReport.Range(Hoy.AddDays(-365), Hoy, Hoy).Error);
    }
}
