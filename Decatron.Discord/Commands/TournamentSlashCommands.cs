using DSharpPlus.Entities;
using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services.Tournament;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord.Commands;

/// <summary>
/// Milestone 2 del modulo de Torneos — comandos /torneo. Ver
/// .dev/torneos/08-discord-integracion.md. Subset implementado: inscribirme,
/// estado, normas. NO implementados todavia: checkin, vincular-riot,
/// lanzar-castigo (quedan para cuando se necesiten — el servicio de Blue Shell ya
/// existe, agregar el comando es querer directo, no hace falta diseno nuevo).
///
/// Reusa TournamentRegistrationService (mismo servicio que el form web, fase 5) —
/// nunca reimplementa la logica de alta, solo arma el request desde los parametros
/// del slash command.
/// </summary>
public class TournamentSlashCommands
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TournamentSlashCommands> _logger;

    private static readonly DiscordColor DecatronColor = new("#2563eb");
    private static readonly DiscordColor ErrorColor = new("#ef4444");
    private static readonly DiscordColor SuccessColor = new("#22c55e");

    public TournamentSlashCommands(IServiceProvider serviceProvider, ILogger<TournamentSlashCommands> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    private async Task<(long channelOwnerId, string channelName)?> ResolveChannelAsync(DecatronDbContext db, ulong guildId)
    {
        var config = await db.DiscordGuildConfigs
            .Where(g => g.GuildId == guildId.ToString() && g.IsActive)
            .OrderByDescending(g => g.IsDefault)
            .ThenBy(g => g.CreatedAt)
            .FirstOrDefaultAsync();

        if (config == null) return null;

        var user = await db.Users.FirstOrDefaultAsync(u => u.Login.ToLower() == config.ChannelName.ToLower());
        return user == null ? null : (user.Id, user.Login);
    }

    public async Task<DiscordEmbedBuilder> HandleInscribirme(DSharpPlus.Entities.DiscordInteraction interaction, string riotId, string riotTagLine, string? displayName)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        var registrationService = scope.ServiceProvider.GetRequiredService<TournamentRegistrationService>();

        var channel = await ResolveChannelAsync(db, interaction.Guild.Id);
        if (channel == null)
            return ErrorEmbed("Este servidor no tiene un canal de Decatron vinculado todavía.");

        var edition = await db.TournamentEditions
            .Where(e => e.ChannelOwnerId == channel.Value.channelOwnerId && e.Status == "registration_open")
            .OrderByDescending(e => e.CreatedAt)
            .FirstOrDefaultAsync();

        if (edition == null)
            return ErrorEmbed("No hay ningún torneo con inscripciones abiertas en este canal ahora mismo.");

        // El caller puede o no tener una cuenta de Decatron vinculada a su Discord —
        // si la tiene, se linkea por AccountId (misma persona en web y Discord); si
        // no, queda solo el DiscordUserId (fase 5, seccion 2).
        var discordUserId = interaction.User.Id.ToString();
        var linkedUser = await db.Users.FirstOrDefaultAsync(u => u.DiscordId == discordUserId);

        var result = await registrationService.RegisterAsync(db, edition, new RegisterParticipantRequest
        {
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? interaction.User.Username : displayName,
            RiotId = riotId,
            RiotTagLine = riotTagLine,
            AccountId = linkedUser?.AccountId,
            DiscordUserId = discordUserId,
        }, source: "discord_bot");

        if (!result.Success)
            return ErrorEmbed(result.Error ?? "No se pudo completar la inscripción.");

        return new DiscordEmbedBuilder()
            .WithTitle("✅ Inscripción recibida")
            .WithDescription($"Te anotaste a **{edition.Name}**. Queda pendiente de aprobación del organizador.")
            .WithColor(SuccessColor);
    }

    public async Task<DiscordEmbedBuilder> HandleEstado(DSharpPlus.Entities.DiscordInteraction interaction)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
        var standings = scope.ServiceProvider.GetRequiredService<TournamentStandingsService>();

        var channel = await ResolveChannelAsync(db, interaction.Guild.Id);
        if (channel == null)
            return ErrorEmbed("Este servidor no tiene un canal de Decatron vinculado todavía.");

        var discordUserId = interaction.User.Id.ToString();
        var linkedUser = await db.Users.FirstOrDefaultAsync(u => u.DiscordId == discordUserId);

        var editionIds = await db.TournamentEditions
            .Where(e => e.ChannelOwnerId == channel.Value.channelOwnerId)
            .Select(e => e.Id)
            .ToListAsync();

        var participant = await db.TournamentParticipants
            .Where(p => editionIds.Contains(p.TournamentEditionId)
                && (p.DiscordUserId == discordUserId || (linkedUser != null && p.AccountId == linkedUser.AccountId)))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        if (participant == null)
            return ErrorEmbed("No estás inscripto en ningún torneo de este canal todavía. Usá `/torneo inscribirme`.");

        var edition = await db.TournamentEditions.FirstAsync(e => e.Id == participant.TournamentEditionId);
        var rank = await standings.GetRankAsync(db, edition.Id, participant.Id);
        var inventory = await db.TournamentShellInventories.FirstOrDefaultAsync(i => i.TournamentParticipantId == participant.Id);
        var activePunishment = await db.TournamentShellEvents
            .Where(e => e.TargetParticipantId == participant.Id && e.Type == "received" && e.FulfilledAt == null)
            .OrderByDescending(e => e.CreatedAt)
            .FirstOrDefaultAsync();

        var statusLabels = new Dictionary<string, string>
        {
            ["pending_approval"] = "Pendiente de aprobación",
            ["approved"] = "Aprobado",
            ["rejected"] = "Rechazado",
        };

        var embed = new DiscordEmbedBuilder()
            .WithTitle($"Tu estado en {edition.Name}")
            .WithColor(DecatronColor)
            .AddField("Estado", statusLabels.GetValueOrDefault(participant.Status, participant.Status), true);

        if (rank.HasValue)
            embed.AddField("Puesto", $"#{rank.Value}", true);

        if (inventory != null)
            embed.AddField($"{edition.ShellItemName}s", $"{inventory.Count} en inventario", true);

        if (activePunishment != null)
            embed.AddField("Castigo activo", "Tenés un castigo sin cumplir todavía", false);

        return embed;
    }

    public async Task<DiscordEmbedBuilder> HandleNormas(DSharpPlus.Entities.DiscordInteraction interaction)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

        var channel = await ResolveChannelAsync(db, interaction.Guild.Id);
        if (channel == null)
            return ErrorEmbed("Este servidor no tiene un canal de Decatron vinculado todavía.");

        var edition = await db.TournamentEditions
            .Where(e => e.ChannelOwnerId == channel.Value.channelOwnerId && e.Status != "draft" && e.Status != "archived")
            .OrderByDescending(e => e.CreatedAt)
            .FirstOrDefaultAsync();

        if (edition == null)
            return ErrorEmbed("No hay ningún torneo activo en este canal ahora mismo.");

        var doc = await db.TournamentRuleDocuments
            .FirstOrDefaultAsync(d => d.TournamentEditionId == edition.Id && d.Type == "general");

        if (doc == null || string.IsNullOrWhiteSpace(doc.ContentMarkdown))
            return ErrorEmbed($"{edition.Name} todavía no tiene normas cargadas.");

        // Discord limita el embed a 4096 caracteres en la descripcion — se recorta,
        // no se trunca en silencio, se avisa que hay mas en la web.
        var content = doc.ContentMarkdown.Length > 3800
            ? doc.ContentMarkdown[..3800] + "\n\n*(recortado — ver la página del torneo para el texto completo)*"
            : doc.ContentMarkdown;

        return new DiscordEmbedBuilder()
            .WithTitle($"Normas — {edition.Name}")
            .WithDescription(content)
            .WithColor(DecatronColor);
    }

    private static DiscordEmbedBuilder ErrorEmbed(string message) =>
        new DiscordEmbedBuilder().WithTitle("❌ Torneos").WithDescription(message).WithColor(ErrorColor);
}
