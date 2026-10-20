namespace Decatron.Services.Tts
{
    /// <summary>Quién puede tener voces de personaje propias: el rango Patrocinador o superior.</summary>
    public static class FishVoiceAccess
    {
        public const int DefaultMaxPrivateVoices = 10;

        public static bool CanUsePrivateVoices(string? tier) => tier is "patrocinador" or "fundador" or "admin";
    }
}
