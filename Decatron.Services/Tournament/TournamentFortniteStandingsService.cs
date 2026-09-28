using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Tabla de posiciones de Fortnite (.dev/torneos/15-fortnite.md F5). Se calcula
    /// al vuelo desde los resultados oficiales (F4) con la tabla de puntos y los
    /// desempates de la edicion. Hay una tabla por "ambito": un solo lobby (sesiones
    /// sin grupo), cada grupo, y la final. El match point se evalua en la final, o en
    /// el lobby unico si no hay grupos.
    /// </summary>
    public class TournamentFortniteStandingsService
    {
        private readonly TournamentFortniteFormatService _format;

        public TournamentFortniteStandingsService(TournamentFortniteFormatService format)
        {
            _format = format;
        }

        public class Row
        {
            public int Rank { get; set; }
            public long TeamId { get; set; }
            public string TeamName { get; set; } = "";
            public List<string> Members { get; set; } = new();
            public int Points { get; set; }
            public int GamesPlayed { get; set; }
            public int Wins { get; set; }
            public int Eliminations { get; set; }
            public double? AvgPlacement { get; set; }
            public int? BestPlacement { get; set; }
            public int? LastGamePlacement { get; set; }
            public bool MatchPoint { get; set; }
            public bool Champion { get; set; }
            // Grupos: entra en los que pasan a la final.
            public bool Qualifies { get; set; }
        }

        public class Scope
        {
            // "all" | "group:{id}"
            public string Key { get; set; } = "all";
            public string Name { get; set; } = "";
            public long? GroupId { get; set; }
            public bool IsFinal { get; set; }
            public int? QualifyCount { get; set; }
            public int GamesPlanned { get; set; }
            public int GamesWithResults { get; set; }
            public bool UsesMatchPoint { get; set; }
            public List<Row> Rows { get; set; } = new();
        }

        public class GameResultLine
        {
            public long GameId { get; set; }
            public string SessionName { get; set; } = "";
            public int GameNumber { get; set; }
            public string Status { get; set; } = "";
            public int? Placement { get; set; }
            public int Eliminations { get; set; }
            public int Points { get; set; }
        }

        private class GameInfo
        {
            public long Id { get; set; }
            public long SessionId { get; set; }
            public int GameNumber { get; set; }
            public int SessionOrder { get; set; }
            public long? GroupId { get; set; }
            public string SessionName { get; set; } = "";
        }

        /// <param name="excludeSessionId">Calcula la tabla como si esa sesion no se hubiera
        /// jugado (para la remontada de F6: puesto antes vs. despues de la sesion).</param>
        public async Task<List<Scope>> ComputeAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default, long? excludeSessionId = null)
        {
            var config = await _format.GetOrCreateConfigAsync(db, edition, ct);
            var ranges = TournamentFortniteFormatService.ParsePlacement(config.PlacementPoints);

            var sessions = await db.TournamentFortniteSessions.Where(s => s.TournamentEditionId == edition.Id).ToListAsync(ct);
            var sessionIds = sessions.Select(s => s.Id).ToList();
            var games = (await db.TournamentFortniteGames.Where(g => sessionIds.Contains(g.SessionId)).ToListAsync(ct))
                .Select(g =>
                {
                    var s = sessions.First(x => x.Id == g.SessionId);
                    return new GameInfo { Id = g.Id, SessionId = s.Id, GameNumber = g.GameNumber, SessionOrder = s.SortOrder, GroupId = s.GroupId, SessionName = s.Name };
                })
                .Where(g => excludeSessionId == null || g.SessionId != excludeSessionId)
                .OrderBy(g => g.SessionOrder).ThenBy(g => g.SessionId).ThenBy(g => g.GameNumber)
                .ToList();
            var gameIds = games.Select(g => g.Id).ToList();
            var results = await db.TournamentFortniteResults.Where(r => gameIds.Contains(r.GameId)).ToListAsync(ct);

            var groups = await db.TournamentFortniteGroups.Where(g => g.TournamentEditionId == edition.Id).OrderBy(g => g.SortOrder).ToListAsync(ct);
            var groupIds = groups.Select(g => g.Id).ToList();
            var groupTeams = await db.TournamentFortniteGroupTeams.Where(gt => groupIds.Contains(gt.GroupId)).ToListAsync(ct);

            var teams = await db.TournamentTeams.Where(t => t.TournamentEditionId == edition.Id).ToDictionaryAsync(t => t.Id, t => t.Name, ct);
            var members = (await db.TournamentParticipants
                    .Where(p => p.TournamentEditionId == edition.Id && p.TeamId != null && p.Status == "approved")
                    .Select(p => new { p.TeamId, p.DisplayName })
                    .ToListAsync(ct))
                .GroupBy(p => p.TeamId!.Value)
                .ToDictionary(g => g.Key, g => g.Select(x => x.DisplayName).ToList());
            var playingTeamIds = members.Keys.ToList();

            var finalGroup = groups.FirstOrDefault(g => g.IsFinal);
            var hasStageGroups = groups.Any(g => !g.IsFinal);
            var scopes = new List<Scope>();

            // Lobby unico: sesiones sin grupo. Se muestra si hay sesiones asi, o si no
            // hay grupos (para ver a los equipos aunque todavia no se juegue).
            if (games.Any(g => g.GroupId == null) || groups.Count == 0)
            {
                scopes.Add(BuildScope(new Scope { Key = "all", Name = "Clasificación", UsesMatchPoint = !hasStageGroups && finalGroup == null },
                    games.Where(g => g.GroupId == null).ToList(), playingTeamIds, results, config, ranges, teams, members));
            }

            foreach (var group in groups.Where(g => !g.IsFinal).Append(finalGroup).Where(g => g != null))
            {
                var inGroup = groupTeams.Where(gt => gt.GroupId == group!.Id).Select(gt => gt.TeamId).ToList();
                var scope = BuildScope(new Scope
                {
                    Key = $"group:{group!.Id}",
                    Name = group.Name,
                    GroupId = group.Id,
                    IsFinal = group.IsFinal,
                    QualifyCount = group.QualifyCount,
                    UsesMatchPoint = group.IsFinal,
                }, games.Where(g => g.GroupId == group.Id).ToList(), inGroup, results, config, ranges, teams, members);
                if (!group.IsFinal && group.QualifyCount is > 0)
                    foreach (var r in scope.Rows.Where(r => r.Rank <= group.QualifyCount)) r.Qualifies = true;
                scopes.Add(scope);
            }

            return scopes;
        }

        private static Scope BuildScope(
            Scope scope, List<GameInfo> games, List<long> baseTeamIds, List<TournamentFortniteResult> allResults,
            TournamentFortniteConfig config, List<FortnitePlacementRange> ranges, Dictionary<long, string> teams, Dictionary<long, List<string>> members)
        {
            var gameIds = games.Select(g => g.Id).ToHashSet();
            var results = allResults.Where(r => gameIds.Contains(r.GameId)).ToList();
            scope.GamesPlanned = games.Count;
            scope.GamesWithResults = results.Select(r => r.GameId).Distinct().Count();

            var teamIds = baseTeamIds.Concat(results.Select(r => r.TeamId)).Distinct().ToList();
            var rows = teamIds.Select(id => new Row
            {
                TeamId = id,
                TeamName = teams.GetValueOrDefault(id, $"Equipo {id}"),
                Members = members.GetValueOrDefault(id, new List<string>()),
            }).ToDictionary(r => r.TeamId);

            // Recorre las partidas en orden: suma puntos y, si aplica, evalua el match
            // point (quien ya estaba en match point antes de la partida y la gana, gana
            // el torneo).
            var inMatchPoint = new HashSet<long>();
            var threshold = scope.UsesMatchPoint ? config.MatchPointThreshold : null;
            var champion = (long?)null;
            var placements = new Dictionary<long, List<int>>();

            foreach (var game in games)
            {
                var gameResults = results.Where(r => r.GameId == game.Id).ToList();
                if (gameResults.Count == 0) continue;

                foreach (var r in gameResults)
                {
                    var row = rows[r.TeamId];
                    row.GamesPlayed++;
                    if (r.Status != "approved" || r.Placement == null) continue;

                    var placement = (int)r.Placement.Value;
                    row.Points += TournamentFortniteFormatService.PointsFor(ranges, config.PointsPerElimination, placement, r.Eliminations);
                    row.Eliminations += r.Eliminations;
                    row.LastGamePlacement = placement;
                    if (placement == 1) row.Wins++;
                    row.BestPlacement = row.BestPlacement == null ? placement : Math.Min(row.BestPlacement.Value, placement);
                    if (!placements.ContainsKey(r.TeamId)) placements[r.TeamId] = new List<int>();
                    placements[r.TeamId].Add(placement);

                    if (threshold != null && champion == null && placement == 1 && inMatchPoint.Contains(r.TeamId))
                        champion = r.TeamId;
                }

                if (threshold != null)
                    foreach (var row in rows.Values.Where(x => x.Points >= threshold)) inMatchPoint.Add(row.TeamId);
            }

            foreach (var (teamId, list) in placements)
                rows[teamId].AvgPlacement = Math.Round(list.Average(), 2);
            foreach (var row in rows.Values)
            {
                row.MatchPoint = inMatchPoint.Contains(row.TeamId);
                row.Champion = champion == row.TeamId;
            }

            scope.Rows = Sort(rows.Values, config.Tiebreakers, champion).ToList();
            for (var i = 0; i < scope.Rows.Count; i++) scope.Rows[i].Rank = i + 1;
            return scope;
        }

        /// <summary>El campeon por match point va primero; despues puntos y los desempates en el orden elegido.</summary>
        private static IEnumerable<Row> Sort(IEnumerable<Row> rows, string[] tiebreakers, long? champion)
        {
            var ordered = rows.OrderByDescending(r => r.TeamId == champion).ThenByDescending(r => r.Points);
            foreach (var t in tiebreakers)
            {
                ordered = t switch
                {
                    "wins" => ordered.ThenByDescending(r => r.Wins),
                    "eliminations" => ordered.ThenByDescending(r => r.Eliminations),
                    "avg_placement" => ordered.ThenBy(r => r.AvgPlacement ?? double.MaxValue),
                    "last_game_placement" => ordered.ThenBy(r => r.LastGamePlacement ?? int.MaxValue),
                    _ => ordered,
                };
            }
            return ordered.ThenBy(r => r.TeamName);
        }

        /// <summary>
        /// Puesto actual de un equipo: en la final si ya esta ahi y se jugo algo, si no
        /// en el ambito donde tiene mas partidas (su grupo o el lobby unico).
        /// </summary>
        public async Task<int?> TeamRankAsync(DecatronDbContext db, TournamentEdition edition, long teamId, CancellationToken ct = default)
        {
            var scopes = await ComputeAsync(db, edition, ct);
            var final = scopes.FirstOrDefault(s => s.IsFinal && s.GamesWithResults > 0 && s.Rows.Any(r => r.TeamId == teamId));
            if (final != null) return final.Rows.First(r => r.TeamId == teamId).Rank;
            return scopes
                .Select(s => s.Rows.FirstOrDefault(r => r.TeamId == teamId))
                .Where(r => r != null)
                .OrderByDescending(r => r!.GamesPlayed)
                .FirstOrDefault()?.Rank;
        }

        /// <summary>Partida por partida de un equipo, en orden.</summary>
        public async Task<List<GameResultLine>> TeamHistoryAsync(DecatronDbContext db, TournamentEdition edition, long teamId, CancellationToken ct = default)
        {
            var config = await _format.GetOrCreateConfigAsync(db, edition, ct);
            var ranges = TournamentFortniteFormatService.ParsePlacement(config.PlacementPoints);

            var rows = await (
                from r in db.TournamentFortniteResults
                where r.TeamId == teamId
                join g in db.TournamentFortniteGames on r.GameId equals g.Id
                join s in db.TournamentFortniteSessions on g.SessionId equals s.Id
                where s.TournamentEditionId == edition.Id
                orderby s.SortOrder, g.GameNumber
                select new { r, g.GameNumber, SessionName = s.Name }
            ).ToListAsync(ct);

            return rows.Select(x => new GameResultLine
            {
                GameId = x.r.GameId,
                SessionName = x.SessionName,
                GameNumber = x.GameNumber,
                Status = x.r.Status,
                Placement = x.r.Placement,
                Eliminations = x.r.Eliminations,
                Points = x.r.Status == "approved" && x.r.Placement != null
                    ? TournamentFortniteFormatService.PointsFor(ranges, config.PointsPerElimination, x.r.Placement.Value, x.r.Eliminations)
                    : 0,
            }).ToList();
        }

        /// <summary>
        /// Pasa a la final a los que clasifican de cada grupo (los primeros N segun
        /// "pasan a la final"). Reemplaza a los equipos que ya estaban en la final.
        /// </summary>
        public async Task<(int added, string? error)> FillFinalAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            var final = await db.TournamentFortniteGroups.FirstOrDefaultAsync(g => g.TournamentEditionId == edition.Id && g.IsFinal, ct);
            if (final == null) return (0, "Primero crea la final");
            if (await db.TournamentFortniteSessions.AnyAsync(s => s.GroupId == final.Id && s.Status != "scheduled", ct))
                return (0, "La final ya empezó: no se pueden cambiar sus equipos");

            var scopes = await ComputeAsync(db, edition, ct);
            var qualified = scopes.Where(s => s.GroupId != null && !s.IsFinal).SelectMany(s => s.Rows.Where(r => r.Qualifies)).Select(r => r.TeamId).Distinct().ToList();
            if (qualified.Count == 0) return (0, "Todavía no hay clasificados: revisa cuántos pasan por grupo");

            var config = await _format.GetOrCreateConfigAsync(db, edition, ct);
            var capacity = TournamentFortniteFormatService.TeamsPerLobby(config, edition);
            if (qualified.Count > capacity)
                return (0, $"Clasifican {qualified.Count} equipos y la final admite {capacity}: baja cuántos pasan por grupo");

            db.TournamentFortniteGroupTeams.RemoveRange(await db.TournamentFortniteGroupTeams.Where(gt => gt.GroupId == final.Id).ToListAsync(ct));
            foreach (var teamId in qualified)
                db.TournamentFortniteGroupTeams.Add(new TournamentFortniteGroupTeam { GroupId = final.Id, TeamId = teamId });
            await db.SaveChangesAsync(ct);
            return (qualified.Count, null);
        }
    }
}
