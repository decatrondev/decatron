namespace Decatron.Controllers.Dtos
{
    public class LanguageDto
    {
        public string? Language { get; set; }
    }

    public class UpdateLanguageDto
    {
        public string Language { get; set; } = string.Empty;
    }

    public class UpdateLanguageResponseDto
    {
        public string Language { get; set; } = string.Empty;
        public bool Updated { get; set; }
    }
}
