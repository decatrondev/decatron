namespace Decatron.Core.Helpers
{
    public static class UniqueIdGenerator
    {
        /// <summary>
        /// Genera un ID único en formato: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
        /// 25 caracteres alfanuméricos en 5 segmentos
        /// </summary>
        public static string Generate()
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var random = new Random();
            var segments = new List<string>();

            for (int i = 0; i < 5; i++)
            {
                var segment = new string(Enumerable.Range(0, 5)
                    .Select(_ => chars[random.Next(chars.Length)])
                    .ToArray());
                segments.Add(segment);
            }

            return string.Join("-", segments);
        }

        /// <summary>
        /// Valida si un ID único tiene el formato correcto
        /// </summary>
        public static bool IsValid(string uniqueId)
        {
            if (string.IsNullOrWhiteSpace(uniqueId))
                return false;

            if (uniqueId.Length != 29) // 5*5 + 4 guiones
                return false;

            var segments = uniqueId.Split('-');
            if (segments.Length != 5)
                return false;

            foreach (var segment in segments)
            {
                if (segment.Length != 5)
                    return false;

                if (!segment.All(c => char.IsLetterOrDigit(c)))
                    return false;
            }

            return true;
        }
    }
}