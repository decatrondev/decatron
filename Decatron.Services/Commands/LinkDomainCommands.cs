using System;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Core.Services.Moderation;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !addlink dominio / !dellink dominio — editan los dominios permitidos del filtro de links
    /// </summary>
    public class LinkDomainCommand : ModerationCommandBase
    {
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        private readonly bool _add;
        public override string Name => _add ? "!addlink" : "!dellink";
        public override string Description => _add ? "Permite un dominio en el filtro de links" : "Quita un dominio permitido del filtro de links";
        protected override string ConfigKey => ModerationCommandsConfig.Links;

        public LinkDomainCommand(bool add, ILogger<LinkDomainCommand> logger, IServiceScopeFactory serviceScopeFactory) : base(logger, serviceScopeFactory)
        {
            _add = add;
        }

        protected override async Task RunAsync(Run run)
        {
            var domain = run.Args.Length > 0 ? LinkDetector.NormalizeDomain(run.Args[0]) : null;
            if (domain == null)
            {
                await run.ReplyAsync($"🔗 @{run.Mod}, uso: {Name} dominio (ejemplo: {Name} youtube.com)");
                return;
            }
            if (run.Context.ChannelUserId == null)
                return;

            var channel = run.Key;
            var db = run.Services.GetRequiredService<DecatronDbContext>();
            var row = await db.ModerationFilters.FirstOrDefaultAsync(f => f.ChannelName == channel && f.FilterKey == LinkFilter.FilterKey);
            var settings = LinkFilterSettings.Parse(row?.Settings);

            if (_add == settings.AllowedDomains.Contains(domain))
            {
                await run.ReplyAsync(_add
                    ? $"🔗 @{run.Mod}, {domain} ya estaba permitido."
                    : $"🔗 @{run.Mod}, {domain} no estaba en la lista de permitidos.");
                return;
            }

            if (_add) settings.AllowedDomains.Add(domain);
            else settings.AllowedDomains.Remove(domain);

            if (row == null)
            {
                // Se crea apagado: agregar un dominio no enciende el filtro
                row = new ModerationFilter { UserId = run.Context.ChannelUserId.Value, ChannelName = channel, FilterKey = LinkFilter.FilterKey };
                db.ModerationFilters.Add(row);
            }
            row.Settings = JsonSerializer.Serialize(settings, JsonOptions);
            row.UpdatedAt = DateTime.Now;
            await db.SaveChangesAsync();
            ModerationCache.Invalidate(channel);

            await run.Moderation.LogCommandActionAsync(channel, run.Context.ChannelUserId.Value, run.Mod, domain, "comando",
                _add ? "add_link" : "del_link", LinkFilter.FilterKey, run.Mod);

            await run.ReplyAsync(_add ? $"🔗 {domain} ahora está permitido en el chat." : $"🔗 {domain} ya no está permitido.");
        }
    }
}
