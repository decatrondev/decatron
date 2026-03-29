namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Helper to handle DateTime timezone issues with PostgreSQL.
    ///
    /// The problem: EnableLegacyTimestampBehavior=true + PostgreSQL timezone=America/Lima
    /// - We write DateTime.UtcNow (e.g., 07:00 UTC)
    /// - PostgreSQL receives it without timezone info, assumes Lima, stores as 07:00-05
    /// - On read, Npgsql returns 07:00 with Kind=Unspecified
    /// - The value IS already what we wrote (UTC), just missing the Kind flag
    ///
    /// Solution: Just stamp it as UTC (don't convert — it's already the right value)
    /// </summary>
    public static class TimerDateTimeHelper
    {
        private static readonly TimeZoneInfo LimaZone =
            TimeZoneInfo.FindSystemTimeZoneById("America/Lima");

        /// <summary>
        /// Converts a DateTime from the DB to UTC.
        ///
        /// With EnableLegacyTimestampBehavior + PostgreSQL timezone=America/Lima:
        /// - timestamptz values are read as Lima local time with Kind=Unspecified
        /// - Example: DB has "01:33-05" → Npgsql returns DateTime(01:33, Unspecified)
        /// - This IS Lima time (01:33), which is 06:33 UTC
        ///
        /// We convert Lima → UTC so arithmetic with DateTime.UtcNow works correctly.
        /// </summary>
        public static DateTime NormalizeToUtc(DateTime dt)
        {
            if (dt.Kind == DateTimeKind.Utc)
                return dt;
            if (dt.Kind == DateTimeKind.Local)
                return dt.ToUniversalTime();
            // Unspecified — this is Lima time from PostgreSQL, convert to UTC
            return TimeZoneInfo.ConvertTimeToUtc(dt, LimaZone);
        }

        /// <summary>
        /// Returns the current time as Lima local time for writing to PostgreSQL.
        ///
        /// Since PostgreSQL assumes incoming timestamps are Lima time,
        /// we must write Lima time (not UTC) so that:
        /// - DB stores it as "02:00-05" (correct: 02:00 Lima = 07:00 UTC)
        /// - On read, NormalizeToUtc(02:00) → 07:00 UTC ✓
        ///
        /// If we wrote DateTime.UtcNow (07:00), DB would store "07:00-05"
        /// which is wrong (07:00 Lima = 12:00 UTC, not our intended 07:00 UTC).
        /// </summary>
        public static DateTime NowForDb()
        {
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, LimaZone);
        }
    }
}
