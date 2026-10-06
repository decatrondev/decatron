using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services;
using Decatron.Core.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    public class DuplicateWheelDto
    {
        public string? Name { get; set; }
    }

    public class ChangeSlugDto
    {
        public string Slug { get; set; } = string.Empty;
    }

    /// <summary>Fija el saldo de una billetera. Se fija, no se suma.</summary>
    public class SetWalletDto
    {
        public int Credits { get; set; }
    }

    public class CreateWheelDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Mode { get; set; }
        public string? Slug { get; set; }
    }

    public class UpdateWheelDto
    {
        public string? Name { get; set; }
        public bool? IsEnabled { get; set; }
        public bool? IsActive { get; set; }
        public string? CreditLabel { get; set; }
        public int? SpinPrice { get; set; }

        // Economía (Fase 2)
        public bool? IsAccumulable { get; set; }
        public string? OverflowPolicy { get; set; }
        public string? MultiFitPolicy { get; set; }
        public string? CreditExpiry { get; set; }
        public int? CreditExpiryDays { get; set; }

        // Disparadores y topes (Fase 2)
        public string? SpinCommand { get; set; }
        public string? BalanceCommand { get; set; }
        public string? BuyCommand { get; set; }
        public bool? CommandEnabled { get; set; }
        public bool? AutoSpin { get; set; }
        public int? SpinCooldownSeconds { get; set; }
        public int? MaxSpinsPerStream { get; set; }
        public int? MaxCoinsPerHour { get; set; }

        // Reglas de giro (Fase 7)
        public string? Slug { get; set; }
        public string? NoRepeatScope { get; set; }
        public bool? PityEnabled { get; set; }
        public int? PityThreshold { get; set; }
        public bool? AllowMultiSpin { get; set; }
        public int? MaxMultiSpin { get; set; }

        public JsonElement? VisualConfig { get; set; }
        public JsonElement? AnnounceConfig { get; set; }
    }

    public class SourceDto
    {
        /// <summary>0 para una fila nueva. Las de puntos de canal se identifican por id.</summary>
        public int Id { get; set; }
        public string Source { get; set; } = string.Empty;
        public string? ChannelPointsRewardTitle { get; set; }
        public bool IsEnabled { get; set; }
        public int RateNumerator { get; set; } = 1;
        public int RateDenominator { get; set; } = 1;
        public int? CapPerEvent { get; set; }
        public string? ChannelPointsRewardId { get; set; }

        // Multiplicadores por tier de sub. Solo tienen efecto en gift_sub.
        public decimal Tier2Multiplier { get; set; } = 1m;
        public decimal Tier3Multiplier { get; set; } = 1m;
    }

    public class MessageDto
    {
        public string? Es { get; set; }
        public string? En { get; set; }
    }

    public class RaffleConfigDto
    {
        public string? EntryCommand { get; set; }
        public JsonElement? EntryMethods { get; set; }
        public string? WindowMode { get; set; }
        public int? WindowSeconds { get; set; }
        public int? EntryCostCredits { get; set; }
        public int? MaxEntriesPerViewer { get; set; }
        public JsonElement? WeightSources { get; set; }
        public JsonElement? Requirements { get; set; }
        public int? WinnersCount { get; set; }
        public string? DrawMode { get; set; }
        public bool? RemoveWinnerFromPool { get; set; }
        public bool? ClearOnStreamEnd { get; set; }
    }

    public class RaffleWindowDto
    {
        public bool Open { get; set; }
    }

    public class RaffleEntryDto
    {
        public string? Viewer { get; set; }
    }

    public class RaffleMultiplierDto
    {
        public decimal Multiplier { get; set; } = 1m;
    }

    public class DeliveryDto
    {
        /// <summary>done | cancelled | pending</summary>
        public string? Status { get; set; }
        public string? Notes { get; set; }
    }

    public class SimulateDto
    {
        /// <summary>bits | gift_sub | donation | channel_points | deca_coins</summary>
        public string Source { get; set; } = string.Empty;
        /// <summary>Bits, cantidad de subs regalados, monto donado, o 1 para un canje.</summary>
        public long Amount { get; set; }
        /// <summary>Vacío = se usa el propio canal, para probar sin involucrar a nadie.</summary>
        public string? ViewerLogin { get; set; }
        /// <summary>Solo para canjes: qué recompensa se simula.</summary>
        public string? RewardId { get; set; }
    }

    public class ManualSpinDto
    {
        public string ViewerLogin { get; set; } = string.Empty;
        /// <summary>Girar sin cobrarle: es un regalo del streamer, no una compra.</summary>
        public bool Free { get; set; }
    }

    public class SegmentDto
    {
        public int Id { get; set; }
        public string Label { get; set; } = string.Empty;
        public decimal Weight { get; set; } = 1m;
        public string? Color { get; set; }
        public string? Icon { get; set; }
        public JsonElement? Prize { get; set; }
        public bool IsEnabled { get; set; } = true;

        // Stock (Fase 7). null = ilimitado.
        public int? StockTotal { get; set; }
        public int? StockPerViewer { get; set; }
        public string StockWindow { get; set; } = "ever";
    }
}
