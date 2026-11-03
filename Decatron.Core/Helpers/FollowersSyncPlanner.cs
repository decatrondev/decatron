using System;
using System.Collections.Generic;
using System.Linq;

namespace Decatron.Core.Helpers
{
    /// <summary>Seguidor tal como lo devuelve la plataforma en esta sincronización.</summary>
    public record SyncRemoteFollower(string UserId, string UserName, string UserLogin);

    /// <summary>Seguidor ya guardado en la base.</summary>
    public record SyncKnownFollower(string UserId, string UserName, string UserLogin, bool IsFollowing);

    /// <summary>Por qué se omitió la detección de unfollows en una sincronización (None = se hizo).</summary>
    public enum SyncUnfollowSkipReason
    {
        None = 0,
        /// <summary>La plataforma cortó la lista a mitad (error, token, red).</summary>
        IncompleteList = 1,
        /// <summary>La plataforma devolvió cero seguidores y la base tiene activos.</summary>
        EmptyList = 2,
        /// <summary>Se obtuvieron menos seguidores de los que la plataforma dice tener.</summary>
        CountMismatch = 3,
        /// <summary>Faltarían demasiados de golpe: casi seguro es una lista mala, no gente real.</summary>
        SuspiciousDrop = 4,
    }

    public record SyncRename(string UserId, string NewName, string NewLogin);

    public record FollowersSyncPlan(
        IReadOnlyList<string> NewIds,
        IReadOnlyList<string> ReturnedIds,
        IReadOnlyList<SyncRename> Renames,
        IReadOnlyList<string> UnfollowIds,
        SyncUnfollowSkipReason UnfollowSkipped,
        int MissingCount);

    /// <summary>
    /// Regla pura de sincronización de seguidores (sin red, sin base de datos): compara la lista de la
    /// plataforma con la guardada y decide qué altas, regresos, renombres y unfollows aplicar.
    /// Los unfollows solo se deciden si la lista de la plataforma es confiable.
    /// </summary>
    public static class FollowersSyncPlanner
    {
        /// <summary>Mínimo absoluto de faltantes antes de considerar «sospechosa» una baja.</summary>
        public const int SuspiciousMinMissing = 25;
        /// <summary>Fracción de los activos guardados que, al faltar de golpe, hace sospechosa la baja.</summary>
        public const double SuspiciousFraction = 0.10;

        public static FollowersSyncPlan Plan(
            IReadOnlyCollection<SyncRemoteFollower> remote,
            IReadOnlyCollection<SyncKnownFollower> known,
            bool listComplete,
            int reportedTotal)
        {
            var knownById = known.GroupBy(k => k.UserId).ToDictionary(g => g.Key, g => g.First());
            var remoteIds = new HashSet<string>(remote.Select(r => r.UserId));

            var newIds = new List<string>();
            var returned = new List<string>();
            var renames = new List<SyncRename>();

            foreach (var r in remote)
            {
                if (!knownById.TryGetValue(r.UserId, out var k))
                {
                    newIds.Add(r.UserId);
                    continue;
                }
                if (k.IsFollowing) returned.Add(r.UserId);

                var nameChanged = !string.IsNullOrWhiteSpace(r.UserName) && !string.Equals(r.UserName, k.UserName, StringComparison.Ordinal);
                var loginChanged = !string.IsNullOrWhiteSpace(r.UserLogin) && !string.Equals(r.UserLogin, k.UserLogin, StringComparison.Ordinal);
                if (nameChanged || loginChanged)
                {
                    renames.Add(new SyncRename(
                        r.UserId,
                        string.IsNullOrWhiteSpace(r.UserName) ? k.UserName : r.UserName,
                        string.IsNullOrWhiteSpace(r.UserLogin) ? k.UserLogin : r.UserLogin));
                }
            }

            var activeKnown = known.Where(k => !k.IsFollowing).ToList();
            var missing = activeKnown.Where(k => !remoteIds.Contains(k.UserId)).Select(k => k.UserId).ToList();

            var skip = SyncUnfollowSkipReason.None;
            if (!listComplete)
                skip = SyncUnfollowSkipReason.IncompleteList;
            else if (remote.Count == 0 && activeKnown.Count > 0)
                skip = SyncUnfollowSkipReason.EmptyList;
            else if (reportedTotal > 0 && remote.Count < reportedTotal - Math.Max(5, (int)(reportedTotal * 0.01)))
                skip = SyncUnfollowSkipReason.CountMismatch;
            else if (missing.Count > Math.Max(SuspiciousMinMissing, (int)(activeKnown.Count * SuspiciousFraction)))
                skip = SyncUnfollowSkipReason.SuspiciousDrop;

            return new FollowersSyncPlan(
                newIds,
                returned,
                renames,
                skip == SyncUnfollowSkipReason.None ? missing : new List<string>(),
                skip,
                missing.Count);
        }
    }
}
