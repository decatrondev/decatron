namespace Decatron.Controllers.Dtos
{
    public class EventAlertsConfigDto
    {
        public object? Data { get; set; }
        public bool IsEnabled { get; set; }
    }

    public class EventAlertsSaveRequest
    {
        public object Config { get; set; } = new();
    }

    public class EventAlertsModeRequest
    {
        /// <summary>"unified" o "separate"</summary>
        public string? Mode { get; set; }
    }
}
