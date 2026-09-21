using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services
{
    // Firma URLs de imagenes de cards de corta duracion — plan seccion 11: nunca se
    // exponen rutas estaticas permanentes, para que no se pueda scrapear el catalogo
    // completo enumerando ids. El secreto es propio (no reusa el de JWT) para no
    // mezclar el trust boundary de autenticacion con el de este link temporal.
    //
    // El filename resuelto (que carta -> que archivo en disco) viaja DENTRO de la
    // firma, no se vuelve a resolver en el endpoint de imagen. Antes cada <img>
    // disparaba una consulta a la DB para ese lookup; con una coleccion de cientos
    // de cartas renderizando de una, cientos de requests concurrentes agotaban el
    // pool de Postgres ("sorry, too many clients already"). Firmando el filename,
    // GET /api/tcg/images/... queda sin ninguna consulta a la DB.
    public class TcgImageSigningService
    {
        private readonly byte[] _secret;
        private static readonly TimeSpan LinkLifetime = TimeSpan.FromMinutes(15);

        public TcgImageSigningService(IConfiguration configuration)
        {
            var secret = configuration["TcgSettings:ImageSigningSecret"] ?? "";
            _secret = Encoding.UTF8.GetBytes(secret);
        }

        public (long Expires, string Signature) Sign(Guid cardId, short level, string filename)
        {
            var expires = DateTimeOffset.UtcNow.Add(LinkLifetime).ToUnixTimeSeconds();
            return (expires, ComputeSignature(cardId, level, filename, expires));
        }

        public bool Validate(Guid cardId, short level, string filename, long expires, string signature)
        {
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expires)
                return false;

            var expected = ComputeSignature(cardId, level, filename, expires);
            var expectedBytes = Encoding.UTF8.GetBytes(expected);
            var actualBytes   = Encoding.UTF8.GetBytes(signature ?? "");

            // Comparacion en tiempo constante — timing attacks contra la firma no son
            // el riesgo mas probable aca, pero es gratis hacerlo bien.
            return expectedBytes.Length == actualBytes.Length && CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes);
        }

        private string ComputeSignature(Guid cardId, short level, string filename, long expires)
        {
            var payload = $"{cardId:N}|{level}|{filename}|{expires}";
            using var hmac = new HMACSHA256(_secret);
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
            return Convert.ToHexString(hash).ToLowerInvariant();
        }
    }
}
