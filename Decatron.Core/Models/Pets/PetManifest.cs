using System.Collections.Generic;

namespace Decatron.Core.Models.Pets
{
    /// <summary>
    /// manifest.json de un modelo de mascota (pets-assets/{id}/manifest.json).
    /// Es la única fuente de verdad sobre qué clips tiene el modelo: el overlay nunca asume nombres.
    /// </summary>
    public class PetManifest
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public PetCredit Credit { get; set; } = new();
        public string File { get; set; } = "model.glb";
        public int Triangles { get; set; }
        public double Scale { get; set; } = 1.0;
        public double GroundOffset { get; set; }
        public Dictionary<string, PetStateDef> States { get; set; } = new();
        public Dictionary<string, string?> Skins { get; set; } = new();
    }

    public class PetCredit
    {
        public string Title { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public string AuthorUrl { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public string License { get; set; } = string.Empty;
        public string LicenseUrl { get; set; } = string.Empty;
    }

    public class PetStateDef
    {
        /// <summary>Nombre del clip dentro del glb. null = el modelo no lo trae, usar Fallback.</summary>
        public string? Clip { get; set; }
        public bool Loop { get; set; } = true;
        public double Speed { get; set; } = 1.0;
        /// <summary>Estado al que pasa cuando termina un clip sin loop.</summary>
        public string? Next { get; set; }
        public string? Fallback { get; set; }
    }
}
