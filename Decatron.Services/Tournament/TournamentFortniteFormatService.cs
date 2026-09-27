using System.Text.Json;
using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Formato por puntos de Fortnite (.dev/torneos/15-fortnite.md F2): tabla de
    /// puntos por puesto y eliminacion, desempates, armado de equipos (sorteo de
    /// solos), grupos cuando no entran todos en un lobby, y sesiones con N partidas.
    /// Los resultados de cada partida (F4) y la tabla de posiciones (F5) se apoyan
    /// en PointsFor de aca.
    /// </summary>
    public class TournamentFortniteFormatService
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private static readonly Random _random = new();

        public static readonly string[] ValidTiebreakers = { "wins", "eliminations", "avg_placement", "last_game_placement" };

        public const int MaxGamesPerSession = 20;

        private readonly TournamentTeamService _teamService;

        public TournamentFortniteFormatService(TournamentTeamService teamService)
        {
            _teamService = teamService;
        }

        // ─── Plantillas de puntos ───────────────────────────────────────────────

        public class PointsPreset
        {
            public string Id { get; set; } = "";
            public string Name { get; set; } = "";
            public string Description { get; set; } = "";
            public List<FortnitePlacementRange> PlacementPoints { get; set; } = new();
            public int PointsPerElimination { get; set; }
        }

        // Sugerencias para arrancar rapido; el streamer las edita a gusto. No son
        // tablas oficiales de Epic.
        public static readonly List<PointsPreset> Presets = new()
        {
            new PointsPreset
            {
                Id = "classic",
                Name = "Clásica",
                Description = "Puesto y eliminaciones pesan parecido. 1 punto por eliminación.",
                PointsPerElimination = 1,
                PlacementPoints = new()
                {
                    new() { From = 1, To = 1, Points = 25 },
                    new() { From = 2, To = 2, Points = 20 },
                    new() { From = 3, To = 3, Points = 16 },
                    new() { From = 4, To = 4, Points = 14 },
                    new() { From = 5, To = 5, Points = 12 },
                    new() { From = 6, To = 6, Points = 10 },
                    new() { From = 7, To = 7, Points = 9 },
                    new() { From = 8, To = 8, Points = 8 },
                    new() { From = 9, To = 9, Points = 7 },
                    new() { From = 10, To = 10, Points = 6 },
                    new() { From = 11, To = 15, Points = 4 },
                    new() { From = 16, To = 20, Points = 3 },
                    new() { From = 21, To = 25, Points = 2 },
                },
            },
            new PointsPreset
            {
                Id = "kills",
                Name = "Carrera de eliminaciones",
                Description = "Lo que más suma son las eliminaciones (3 puntos cada una); el puesto da un extra.",
                PointsPerElimination = 3,
                PlacementPoints = new()
                {
                    new() { From = 1, To = 1, Points = 10 },
                    new() { From = 2, To = 5, Points = 5 },
                    new() { From = 6, To = 10, Points = 2 },
                },
            },
            new PointsPreset
            {
                Id = "placement",
                Name = "Solo puesto",
                Description = "Solo cuenta el puesto; las eliminaciones no suman.",
                PointsPerElimination = 0,
                PlacementPoints = new()
                {
                    new() { From = 1, To = 1, Points = 30 },
                    new() { From = 2, To = 2, Points = 24 },
                    new() { From = 3, To = 3, Points = 20 },
                    new() { From = 4, To = 5, Points = 16 },
                    new() { From = 6, To = 10, Points = 12 },
                    new() { From = 11, To = 15, Points = 8 },
                    new() { From = 16, To = 25, Points = 4 },
                    new() { From = 26, To = 50, Points = 1 },
                },
            },
        };

        // ─── Config ─────────────────────────────────────────────────────────────

        public async Task<TournamentFortniteConfig> GetOrCreateConfigAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            var config = await db.TournamentFortniteConfigs.FirstOrDefaultAsync(c => c.TournamentEditionId == edition.Id, ct);
            if (config != null) return config;

            var classic = Presets[0];
            config = new TournamentFortniteConfig
            {
                TournamentEditionId = edition.Id,
                PlacementPoints = JsonSerializer.Serialize(classic.PlacementPoints, Json),
                PointsPerElimination = classic.PointsPerElimination,
            };
            db.TournamentFortniteConfigs.Add(config);
            await db.SaveChangesAsync(ct);
            return config;
        }

        public static List<FortnitePlacementRange> ParsePlacement(string json)
        {
            try { return JsonSerializer.Deserialize<List<FortnitePlacementRange>>(json, Json) ?? new(); }
            catch { return new(); }
        }

        /// <summary>null = valido; si no, el mensaje de error para el streamer.</summary>
        public static string? ValidatePlacement(List<FortnitePlacementRange> ranges)
        {
            if (ranges.Count > 100) return "Demasiados tramos de puestos";
            var sorted = ranges.OrderBy(r => r.From).ToList();
            for (var i = 0; i < sorted.Count; i++)
            {
                var r = sorted[i];
                if (r.From < 1 || r.To < r.From || r.To > 100)
                    return $"Tramo inválido: del puesto {r.From} al {r.To}";
                if (r.Points < 0 || r.Points > 1000)
                    return "Los puntos por puesto tienen que estar entre 0 y 1000";
                if (i > 0 && r.From <= sorted[i - 1].To)
                    return $"Los tramos se pisan en el puesto {r.From}";
            }
            return null;
        }

        /// <summary>Puntos de un equipo en una partida.</summary>
        public static int PointsFor(List<FortnitePlacementRange> ranges, int pointsPerElimination, int placement, int eliminations)
        {
            var placementPoints = ranges.FirstOrDefault(r => placement >= r.From && placement <= r.To)?.Points ?? 0;
            return placementPoints + Math.Max(0, eliminations) * pointsPerElimination;
        }

        /// <summary>Cuantos equipos entran en un lobby segun el tamaño de equipo.</summary>
        public static int TeamsPerLobby(TournamentFortniteConfig config, TournamentEdition edition) =>
            Math.Max(1, config.MaxPlayersPerLobby / Math.Max(1, (int)(edition.TeamSize ?? 1)));

        // ─── Equipos ────────────────────────────────────────────────────────────

        public class BuildTeamsResult
        {
            public int CreatedTeams { get; set; }
            // Jugadores que quedaron en un equipo incompleto (sobraban para uno completo).
            public int IncompleteTeamPlayers { get; set; }
            // Solos que quedaron sin equipo porque el sorteo esta apagado.
            public int SolosWithoutTeam { get; set; }
        }

        /// <summary>
        /// Arma los equipos con los inscritos aprobados. Solo: un equipo por jugador.
        /// Duo o mas: si el sorteo esta prendido, completa los equipos armados por
        /// codigo y arma equipos nuevos con los solos (mismo sorteo que ARAM); lo
        /// que sobra forma un equipo incompleto, que en Fortnite igual puede jugar.
        /// Se puede correr varias veces: solo toca a quien todavia no tiene equipo.
        /// </summary>
        public async Task<BuildTeamsResult> BuildTeamsAsync(DecatronDbContext db, TournamentEdition edition, TournamentFortniteConfig config, CancellationToken ct = default)
        {
            var result = new BuildTeamsResult();
            var teamSize = edition.TeamSize ?? 1;

            if (teamSize == 1)
            {
                var solos = await db.TournamentParticipants
                    .Where(p => p.TournamentEditionId == edition.Id && p.Status == "approved" && p.TeamId == null)
                    .ToListAsync(ct);
                foreach (var p in solos)
                {
                    var team = new TournamentTeam { TournamentEditionId = edition.Id, Name = p.DisplayName };
                    db.TournamentTeams.Add(team);
                    await db.SaveChangesAsync(ct);
                    p.TeamId = team.Id;
                    p.IsCaptain = true;
                }
                await db.SaveChangesAsync(ct);
                result.CreatedTeams = solos.Count;
                return result;
            }

            if (!config.FillSolosRandomly)
            {
                result.SolosWithoutTeam = await db.TournamentParticipants.CountAsync(p =>
                    p.TournamentEditionId == edition.Id && p.Status == "approved" && p.TeamId == null, ct);
                return result;
            }

            var (created, _) = await _teamService.AutoAssignRandomTeamsAsync(db, edition, ct);
            result.CreatedTeams = created.Count;

            var leftovers = await db.TournamentParticipants
                .Where(p => p.TournamentEditionId == edition.Id && p.Status == "approved" && p.TeamId == null)
                .ToListAsync(ct);
            if (leftovers.Count > 0)
            {
                var teamCount = await db.TournamentTeams.CountAsync(t => t.TournamentEditionId == edition.Id, ct);
                var team = new TournamentTeam { TournamentEditionId = edition.Id, Name = $"Equipo {teamCount + 1}" };
                db.TournamentTeams.Add(team);
                await db.SaveChangesAsync(ct);
                foreach (var p in leftovers) p.TeamId = team.Id;
                await db.SaveChangesAsync(ct);
                result.CreatedTeams++;
                result.IncompleteTeamPlayers = leftovers.Count;
            }

            return result;
        }

        /// <summary>Equipos con al menos un jugador aprobado: los que juegan.</summary>
        public Task<List<TournamentTeam>> GetPlayingTeamsAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default) =>
            db.TournamentTeams
                .Where(t => t.TournamentEditionId == edition.Id &&
                            db.TournamentParticipants.Any(p => p.TeamId == t.Id && p.Status == "approved"))
                .OrderBy(t => t.Id)
                .ToListAsync(ct);

        // ─── Grupos ─────────────────────────────────────────────────────────────

        /// <summary>
        /// true si alguna sesion del grupo (o de la edicion, si groupId es null) ya
        /// arranco — a partir de ahi no se rearman los grupos para no desordenar
        /// partidas jugadas.
        /// </summary>
        public Task<bool> HasStartedSessionsAsync(DecatronDbContext db, long editionId, CancellationToken ct = default) =>
            db.TournamentFortniteSessions.AnyAsync(s => s.TournamentEditionId == editionId && s.Status != "scheduled", ct);

        /// <summary>
        /// Reparte al azar los equipos que juegan en grupos (respetando los equipos
        /// ya armados). Borra los grupos que no son final y sus sesiones.
        /// </summary>
        public async Task<(List<TournamentFortniteGroup>? groups, string? error)> GenerateGroupsAsync(
            DecatronDbContext db, TournamentEdition edition, TournamentFortniteConfig config, int? groupCount, int? qualifyCount, CancellationToken ct = default)
        {
            if (await HasStartedSessionsAsync(db, edition.Id, ct))
                return (null, "Ya hay sesiones empezadas: no se pueden rearmar los grupos");

            var teams = await GetPlayingTeamsAsync(db, edition, ct);
            if (teams.Count == 0)
                return (null, "Todavía no hay equipos: primero arma los equipos");

            var perLobby = TeamsPerLobby(config, edition);
            var count = groupCount ?? (int)Math.Ceiling(teams.Count / (double)perLobby);
            if (count < 2)
                return (null, $"Entran todos en un solo lobby ({teams.Count} de {perLobby} equipos): no hace falta dividir en grupos");
            if (count > teams.Count)
                return (null, "Hay más grupos que equipos");
            if ((int)Math.Ceiling(teams.Count / (double)count) > perLobby)
                return (null, $"Con {count} grupos no entran: cada lobby admite {perLobby} equipos");

            var oldGroups = await db.TournamentFortniteGroups.Where(g => g.TournamentEditionId == edition.Id && !g.IsFinal).ToListAsync(ct);
            db.TournamentFortniteGroups.RemoveRange(oldGroups);
            await db.SaveChangesAsync(ct);

            for (var i = teams.Count - 1; i > 0; i--)
            {
                var j = _random.Next(i + 1);
                (teams[i], teams[j]) = (teams[j], teams[i]);
            }

            var qualify = qualifyCount ?? Math.Max(1, perLobby / count);
            var groups = new List<TournamentFortniteGroup>();
            for (var g = 0; g < count; g++)
            {
                var group = new TournamentFortniteGroup
                {
                    TournamentEditionId = edition.Id,
                    Name = $"Grupo {GroupLetter(g)}",
                    SortOrder = (short)g,
                    QualifyCount = (short)qualify,
                };
                db.TournamentFortniteGroups.Add(group);
                groups.Add(group);
            }
            await db.SaveChangesAsync(ct);

            for (var i = 0; i < teams.Count; i++)
                db.TournamentFortniteGroupTeams.Add(new TournamentFortniteGroupTeam { GroupId = groups[i % count].Id, TeamId = teams[i].Id });
            await db.SaveChangesAsync(ct);

            return (groups, null);
        }

        private static string GroupLetter(int index) =>
            index < 26 ? ((char)('A' + index)).ToString() : (index + 1).ToString();

        public async Task<TournamentFortniteGroup> CreateFinalAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            var existing = await db.TournamentFortniteGroups.FirstOrDefaultAsync(g => g.TournamentEditionId == edition.Id && g.IsFinal, ct);
            if (existing != null) return existing;

            var maxOrder = await db.TournamentFortniteGroups.Where(g => g.TournamentEditionId == edition.Id).MaxAsync(g => (short?)g.SortOrder, ct) ?? -1;
            var final = new TournamentFortniteGroup
            {
                TournamentEditionId = edition.Id,
                Name = "Final",
                IsFinal = true,
                SortOrder = (short)(maxOrder + 1),
            };
            db.TournamentFortniteGroups.Add(final);
            await db.SaveChangesAsync(ct);
            return final;
        }

        /// <summary>
        /// Pone un equipo en un grupo. En la fase de grupos un equipo esta en un solo
        /// grupo (se mueve); la final es aparte y convive con su grupo.
        /// </summary>
        public async Task<string?> AddTeamToGroupAsync(DecatronDbContext db, TournamentEdition edition, TournamentFortniteGroup group, long teamId, CancellationToken ct = default)
        {
            var team = await db.TournamentTeams.FirstOrDefaultAsync(t => t.Id == teamId && t.TournamentEditionId == edition.Id, ct);
            if (team == null) return "Equipo no encontrado";

            var config = await GetOrCreateConfigAsync(db, edition, ct);
            var inGroup = await db.TournamentFortniteGroupTeams.CountAsync(gt => gt.GroupId == group.Id, ct);
            if (inGroup >= TeamsPerLobby(config, edition))
                return "Ese grupo ya está lleno";

            if (!group.IsFinal)
            {
                var otherGroupIds = await db.TournamentFortniteGroups
                    .Where(g => g.TournamentEditionId == edition.Id && !g.IsFinal && g.Id != group.Id)
                    .Select(g => g.Id).ToListAsync(ct);
                var old = await db.TournamentFortniteGroupTeams.Where(gt => gt.TeamId == teamId && otherGroupIds.Contains(gt.GroupId)).ToListAsync(ct);
                db.TournamentFortniteGroupTeams.RemoveRange(old);
            }

            if (!await db.TournamentFortniteGroupTeams.AnyAsync(gt => gt.GroupId == group.Id && gt.TeamId == teamId, ct))
                db.TournamentFortniteGroupTeams.Add(new TournamentFortniteGroupTeam { GroupId = group.Id, TeamId = teamId });

            await db.SaveChangesAsync(ct);
            return null;
        }

        // ─── Sesiones ───────────────────────────────────────────────────────────

        public async Task<TournamentFortniteSession> CreateSessionAsync(
            DecatronDbContext db, TournamentEdition edition, long? groupId, string name, DateTime? scheduledAt, int games, CancellationToken ct = default)
        {
            var maxOrder = await db.TournamentFortniteSessions.Where(s => s.TournamentEditionId == edition.Id).MaxAsync(s => (short?)s.SortOrder, ct) ?? -1;
            var session = new TournamentFortniteSession
            {
                TournamentEditionId = edition.Id,
                GroupId = groupId,
                Name = name.Trim(),
                ScheduledAt = scheduledAt,
                SortOrder = (short)(maxOrder + 1),
            };
            db.TournamentFortniteSessions.Add(session);
            await db.SaveChangesAsync(ct);

            await SetGameCountAsync(db, session, games, ct);
            return session;
        }

        /// <summary>
        /// Ajusta la cantidad de partidas de una sesion: agrega al final o quita las
        /// ultimas que todavia no empezaron.
        /// </summary>
        public async Task<string?> SetGameCountAsync(DecatronDbContext db, TournamentFortniteSession session, int games, CancellationToken ct = default)
        {
            var current = await db.TournamentFortniteGames.Where(g => g.SessionId == session.Id).OrderBy(g => g.GameNumber).ToListAsync(ct);
            if (games > current.Count)
            {
                for (var n = current.Count + 1; n <= games; n++)
                    db.TournamentFortniteGames.Add(new TournamentFortniteGame { SessionId = session.Id, GameNumber = (short)n });
            }
            else if (games < current.Count)
            {
                var toRemove = current.Skip(games).ToList();
                if (toRemove.Any(g => g.Status != "waiting"))
                    return "No se pueden quitar partidas que ya empezaron";
                db.TournamentFortniteGames.RemoveRange(toRemove);
            }
            await db.SaveChangesAsync(ct);
            return null;
        }
    }
}
