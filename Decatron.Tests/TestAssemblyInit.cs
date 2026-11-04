using System.Runtime.CompilerServices;

namespace Decatron.Tests;

/// <summary>
/// Npgsql lee el interruptor de marcas de tiempo una sola vez, la primera vez que se usa. El bot lo activa
/// al arrancar (Program.cs), asi que las pruebas de base tienen que verlo activo desde el inicio: si una clase
/// que no lo activa toca Npgsql antes, el valor queda fijo en falso para toda la corrida y las pruebas del
/// Timer fallan segun el orden en que se ejecuten.
/// </summary>
internal static class TestAssemblyInit
{
    [ModuleInitializer]
    internal static void Init() => AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
}
