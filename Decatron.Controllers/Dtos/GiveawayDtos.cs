using System.Text.Json;
using System.ComponentModel.DataAnnotations;

namespace Decatron.Controllers.Dtos
{
    public class GiveawayConfigInput
    {
        // Información básica
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = "Nuevo Giveaway";

        [Required]
        [MaxLength(500)]
        public string PrizeName { get; set; } = string.Empty;

        public string? PrizeDescription { get; set; }

        // Duración
        [Required]
        [MaxLength(10)]
        public string DurationType { get; set; } = "timed";

        public int DurationMinutes { get; set; } = 10;

        // Participantes
        public int MaxParticipants { get; set; } = 1000;
        public bool MaxParticipantsEnabled { get; set; } = false;
        public bool AllowMultipleEntries { get; set; } = false;

        // Ganadores
        public int NumberOfWinners { get; set; } = 1;
        public bool HasBackupWinners { get; set; } = true;
        public int NumberOfBackupWinners { get; set; } = 2;

        // Método de entrada
        [MaxLength(100)]
        public string EntryCommand { get; set; } = "!join";

        public bool AllowAutoEntry { get; set; } = false;

        // Requisitos y Pesos (recibidos como JsonElement/dynamic para aceptar objetos)
        public JsonElement Requirements { get; set; }
        public JsonElement Weights { get; set; }

        // Cooldown
        public bool WinnerCooldownEnabled { get; set; } = true;
        public int WinnerCooldownDays { get; set; } = 7;

        // Anuncios
        public bool AnnounceOnStart { get; set; } = true;
        public bool AnnounceReminders { get; set; } = true;
        public int ReminderIntervalMinutes { get; set; } = 3;
        public bool AnnounceParticipantCount { get; set; } = true;

        // Mensajes
        public string? StartMessage { get; set; }
        public string? ReminderMessage { get; set; }
        public string? WinnerMessage { get; set; }
        public string? NoResponseMessage { get; set; }

        // Timeout
        public int WinnerResponseTimeout { get; set; } = 60;
        public bool AutoRerollOnTimeout { get; set; } = true;
    }
}
