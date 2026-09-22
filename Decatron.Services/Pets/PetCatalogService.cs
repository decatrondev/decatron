using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Decatron.Core.Models.Pets;
using Decatron.Core.Settings;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace Decatron.Services.Pets
{
    /// <summary>
    /// Catálogo de modelos de mascotas en pets-assets/ (fuera de ClientApp/public y fuera de git).
    /// Los archivos no se sirven por nginx: el backend los entrega solo con una URL firmada de corta duración.
    /// </summary>
    public class PetCatalogService
    {
        private readonly string _root;
        private readonly ILogger<PetCatalogService> _logger;
        private readonly byte[] _signingKey;
        private readonly object _lock = new();
        private Dictionary<string, PetManifest>? _cache;

        private static readonly JsonSerializerSettings JsonSettings = new()
        {
            ContractResolver = new CamelCasePropertyNamesContractResolver()
        };

        public PetCatalogService(IHostEnvironment env, IOptions<JwtSettings> jwt, ILogger<PetCatalogService> logger)
        {
            _root = Path.Combine(env.ContentRootPath, "pets-assets");
            _logger = logger;
            // Derivada del secreto JWT para no agregar otro secreto; nunca se usa como JWT.
            _signingKey = SHA256.HashData(Encoding.UTF8.GetBytes("pets-model-url:" + (jwt.Value.SecretKey ?? "")));
        }

        public IReadOnlyCollection<PetManifest> GetAll()
        {
            return Load().Values.OrderBy(m => m.Name).ToList();
        }

        public PetManifest? Get(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return null;
            return Load().TryGetValue(id.ToLowerInvariant(), out var m) ? m : null;
        }

        public void Invalidate()
        {
            lock (_lock) _cache = null;
        }

        /// <summary>Ruta absoluta del glb de un modelo, o null si no existe o el id es inválido.</summary>
        public string? GetModelPath(string id)
        {
            var manifest = Get(id);
            if (manifest == null) return null;
            var file = Path.GetFileName(manifest.File); // sin rutas relativas
            var full = Path.Combine(_root, manifest.Id, file);
            return File.Exists(full) ? full : null;
        }

        // ---- URL firmada ----

        public (long expires, string signature) Sign(string id, TimeSpan ttl)
        {
            var expires = DateTimeOffset.UtcNow.Add(ttl).ToUnixTimeSeconds();
            return (expires, ComputeSignature(id, expires));
        }

        public bool Verify(string id, long expires, string? signature)
        {
            if (string.IsNullOrEmpty(signature)) return false;
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expires) return false;
            var expected = ComputeSignature(id, expires);
            return CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(signature));
        }

        private string ComputeSignature(string id, long expires)
        {
            using var hmac = new HMACSHA256(_signingKey);
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{id.ToLowerInvariant()}:{expires}"));
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        // ---- carga ----

        private Dictionary<string, PetManifest> Load()
        {
            lock (_lock)
            {
                if (_cache != null) return _cache;
                var result = new Dictionary<string, PetManifest>();
                if (!Directory.Exists(_root))
                {
                    _logger.LogWarning("[PETS] No existe {Root}; catálogo vacío", _root);
                    _cache = result;
                    return result;
                }

                foreach (var dir in Directory.GetDirectories(_root))
                {
                    var manifestPath = Path.Combine(dir, "manifest.json");
                    if (!File.Exists(manifestPath)) continue;
                    try
                    {
                        var manifest = JsonConvert.DeserializeObject<PetManifest>(File.ReadAllText(manifestPath), JsonSettings);
                        if (manifest == null || string.IsNullOrWhiteSpace(manifest.Id)) continue;
                        manifest.Id = manifest.Id.ToLowerInvariant();
                        if (manifest.Id != Path.GetFileName(dir).ToLowerInvariant())
                        {
                            _logger.LogWarning("[PETS] {Dir}: el id del manifest ({Id}) no coincide con la carpeta, se ignora", dir, manifest.Id);
                            continue;
                        }
                        if (!File.Exists(Path.Combine(dir, Path.GetFileName(manifest.File))))
                        {
                            _logger.LogWarning("[PETS] {Id}: falta el archivo {File}, se ignora", manifest.Id, manifest.File);
                            continue;
                        }
                        result[manifest.Id] = manifest;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[PETS] manifest inválido en {Path}", manifestPath);
                    }
                }

                _logger.LogInformation("[PETS] Catálogo cargado: {Count} modelo(s)", result.Count);
                _cache = result;
                return result;
            }
        }
    }
}
