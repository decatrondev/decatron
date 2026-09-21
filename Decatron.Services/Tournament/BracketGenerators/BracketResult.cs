namespace Decatron.Services.Tournament.BracketGenerators
{
    public class BracketResult
    {
        public bool Success { get; set; }
        public string? Error { get; set; }
        public int MatchesCreated { get; set; }
        public int LeftOverParticipants { get; set; }
    }
}
