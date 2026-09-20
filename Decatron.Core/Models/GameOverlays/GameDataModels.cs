using System;
using System.Collections.Generic;

namespace Decatron.Core.Models.GameOverlays;

// Modelo NORMALIZADO del modulo Game Overlays: es lo unico que ven el overlay,
// los comandos de chat y el panel. Cada proveedor (Riot, FACEIT, manual...)
// traduce su respuesta a esto — asi agregar un juego es escribir un adaptador
// y nada mas. Ver .dev/plans/GAME_OVERLAYS_PLAN.md §3.

/// <summary>Que sabe hacer un proveedor. El overlay/panel ocultan lo que no aplica.</summary>
public class ProviderCapabilities
{
    public bool HasRank { get; set; }
    /// <summary>Puntos exactos (LP/ELO). false = rango derivado o manual (Valorant, manual).</summary>
    public bool HasExactPoints { get; set; }
    public bool HasRecentMatches { get; set; }
    public bool HasKda { get; set; }
    public bool HasLiveGame { get; set; }
    /// <summary>true = el proveedor no consulta nada, el rango lo fija el streamer.</summary>
    public bool IsManualOnly { get; set; }
    /// <summary>Necesita verificacion de propiedad (icono de invocador / RSO).</summary>
    public bool RequiresVerification { get; set; }
    /// <summary>Necesita region de plataforma (Riot).</summary>
    public bool RequiresRegion { get; set; }
    /// <summary>Colas que el streamer puede elegir ("solo", "flex"...). Vacio = una sola, sin selector.</summary>
    public string[] SupportedQueues { get; set; } = System.Array.Empty<string>();
}

/// <summary>Resultado de resolver "nombre que escribio el streamer" -> id externo.</summary>
public class ResolvedAccount
{
    public string ExternalId { get; set; } = "";
    public string ExternalName { get; set; } = "";
    public string? ExternalTag { get; set; }
    public string? Region { get; set; }
}

public class RankInfo
{
    /// <summary>Tier en mayusculas tal como lo da el juego: "DIAMOND", "CHAMPION", "LEVEL_10"...</summary>
    public string Tier { get; set; } = "UNRANKED";
    /// <summary>"I".."IV" en Riot, null si no aplica.</summary>
    public string? Division { get; set; }
    public int? Points { get; set; }
    /// <summary>"LP" | "RR" | "ELO" | "" — para pintar "45 LP".</summary>
    public string PointsLabel { get; set; } = "";
    public int Wins { get; set; }
    public int Losses { get; set; }
    /// <summary>Cola a la que corresponde el rango ("RANKED_SOLO_5x5", "competitive"...).</summary>
    public string? Queue { get; set; }
    /// <summary>Ruta del emblema en el frontend (/games/lol/ranks/diamond.png).</summary>
    public string? Emblem { get; set; }
    /// <summary>false cuando es derivado (Valorant: ultima partida) o manual.</summary>
    public bool IsExact { get; set; } = true;
    /// <summary>"api" | "manual" | "derived"</summary>
    public string Source { get; set; } = "api";

    public bool IsUnranked => Tier == "UNRANKED";

    public double? WinRate => (Wins + Losses) > 0 ? Math.Round(100.0 * Wins / (Wins + Losses), 1) : null;
}

public class MatchSummary
{
    public string Id { get; set; } = "";
    /// <summary>"win" | "loss" | "draw" | "remake". En TFT top-4 cuenta como win.</summary>
    public string Result { get; set; } = "";
    public int? Kills { get; set; }
    public int? Deaths { get; set; }
    public int? Assists { get; set; }
    /// <summary>Campeon / agente / heroe / (null si no aplica).</summary>
    public string? Character { get; set; }
    /// <summary>Posicion final (TFT, battle royale). Null en juegos de equipo.</summary>
    public int? Placement { get; set; }
    /// <summary>Id numerico de la cola (420 solo, 440 flex...) o nombre en otros juegos.</summary>
    public string? Queue { get; set; }
    public DateTime EndedAt { get; set; }
    public int DurationSeconds { get; set; }
    /// <summary>Cambio de puntos que produjo esta partida, cuando se puede calcular.</summary>
    public int? PointsDelta { get; set; }
    /// <summary>Icono del campeon/agente (URL absoluta, Data Dragon en LoL). Null si el juego no tiene.</summary>
    public string? CharacterIcon { get; set; }
    /// <summary>Rol/posicion jugada ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY") si el juego lo da.</summary>
    public string? Role { get; set; }
    public int? Cs { get; set; }
    public double? CsPerMin { get; set; }
    public int? Damage { get; set; }
    public int? VisionScore { get; set; }

    public double? Kda => Deaths.HasValue && Kills.HasValue && Assists.HasValue
        ? Math.Round(Deaths.Value == 0 ? Kills.Value + Assists.Value : (Kills.Value + Assists.Value) / (double)Deaths.Value, 2)
        : null;
}

public class LiveGameInfo
{
    public bool InGame { get; set; }
    public string? Character { get; set; }
    public string? CharacterIcon { get; set; }
    public string? Queue { get; set; }
    public DateTime? StartedAt { get; set; }
}

/// <summary>Un punto del grafico de LP/puntos de la sesion.</summary>
public class PointsSample
{
    public DateTime At { get; set; }
    /// <summary>Puntos en escala absoluta del juego (LolRanks.Absolute), para que cruzar de division no rompa la curva.</summary>
    public int Absolute { get; set; }
    /// <summary>Etiqueta corta del rango en ese momento ("G II 45").</summary>
    public string Label { get; set; } = "";
}

/// <summary>Un campeon/agente con su rendimiento reciente.</summary>
public class CharacterStat
{
    public string Name { get; set; } = "";
    public string? Icon { get; set; }
    public int Games { get; set; }
    public int Wins { get; set; }
    public int Losses { get; set; }
    public double? AvgKda { get; set; }
    public double? WinRate => Games > 0 ? Math.Round(100.0 * Wins / Games, 0) : null;
}

/// <summary>Maestria de campeon (LoL). Otros juegos: null.</summary>
public class MasteryInfo
{
    public string Name { get; set; } = "";
    public string? Icon { get; set; }
    public int Level { get; set; }
    public int Points { get; set; }
}

/// <summary>
/// Estadisticas agregadas de una cuenta sobre sus ultimas N partidas (no solo la
/// sesion): lo que op.gg/LoboBot muestran y el overlay basico no tenia. Ver
/// GAME_OVERLAYS_PLAN.md fase "LoL enriquecido".
/// </summary>
public class AccountStats
{
    /// <summary>Cuantas partidas entraron en el promedio.</summary>
    public int SampleSize { get; set; }
    public double? WinRate { get; set; }
    public double? AvgKda { get; set; }
    public double? AvgKills { get; set; }
    public double? AvgDeaths { get; set; }
    public double? AvgAssists { get; set; }
    public double? AvgCsPerMin { get; set; }
    public double? AvgDamage { get; set; }
    public double? AvgVisionScore { get; set; }
    /// <summary>Racha actual: +3 = tres victorias seguidas, -2 = dos derrotas. 0 sin partidas.</summary>
    public int Streak { get; set; }
    /// <summary>Rol mas jugado en la muestra, si el juego lo da.</summary>
    public string? MainRole { get; set; }
    public List<CharacterStat> TopCharacters { get; set; } = new();
    public List<MasteryInfo> Mastery { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Estado de la sesion de UNA cuenta durante el stream actual.</summary>
public class SessionState
{
    public RankInfo? StartRank { get; set; }
    public RankInfo? CurrentRank { get; set; }
    public int Wins { get; set; }
    public int Losses { get; set; }
    public List<MatchSummary> Matches { get; set; } = new();
    public DateTime StreamStartedAt { get; set; }

    /// <summary>
    /// Delta de puntos en la sesion. Solo entre rangos comparables del mismo
    /// tier/division; si cambio de division se calcula sobre la escala absoluta
    /// del juego (ver RankScale) y si no hay escala, null.
    /// </summary>
    public int? PointsDelta { get; set; }

    /// <summary>Muestras de puntos a lo largo de la sesion (una por cambio de LP), para el grafico.</summary>
    public List<PointsSample> PointsHistory { get; set; } = new();

    public double? WinRate => (Wins + Losses) > 0 ? Math.Round(100.0 * Wins / (Wins + Losses), 0) : null;
    /// <summary>Racha dentro de la sesion (misma convencion que AccountStats.Streak).</summary>
    public int Streak
    {
        get
        {
            var n = 0;
            foreach (var m in Matches)
            {
                if (m.Result != "win" && m.Result != "loss") continue;
                if (n == 0) n = m.Result == "win" ? 1 : -1;
                else if ((n > 0) == (m.Result == "win")) n += n > 0 ? 1 : -1;
                else break;
            }
            return n;
        }
    }
}

/// <summary>Lo que el poller entrega al overlay para una cuenta.</summary>
public class AccountOverlayState
{
    public long AccountId { get; set; }
    public string Game { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string ExternalName { get; set; } = "";
    public string? Region { get; set; }
    public RankInfo? Rank { get; set; }
    public SessionState? Session { get; set; }
    public LiveGameInfo? Live { get; set; }
    /// <summary>Promedios de las ultimas partidas, top campeones, maestria. Null si el proveedor no lo da.</summary>
    public AccountStats? Stats { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Estado completo del overlay de un canal (lo que se manda por SignalR).</summary>
public class OverlayState
{
    public string? ActiveGame { get; set; }
    /// <summary>"category" | "manual" | "idle"</summary>
    public string Reason { get; set; } = "idle";
    public long? ActiveAccountId { get; set; }
    public List<AccountOverlayState> Accounts { get; set; } = new();
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Rango fijado a mano (linked_game_accounts.manual_rank).</summary>
public class ManualRank
{
    public string Tier { get; set; } = "UNRANKED";
    public string? Division { get; set; }
    public int? Points { get; set; }
}
