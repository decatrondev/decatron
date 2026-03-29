using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using Newtonsoft.Json;
using System.Collections.Generic;
using Decatron.Core.Models;
using System.Data;
using Microsoft.EntityFrameworkCore;
using Decatron.Data;

namespace Decatron.Core.Helpers
{
    public static class UtilsCrear
    {
        private static readonly HttpClient _httpClient = new HttpClient();

        public static async Task<CustomCommand> GetCustomCommand(DecatronDbContext context, string commandName, string channelName)
        {
            try
            {
                var command = await context.CustomCommands
                    .FirstOrDefaultAsync(c => c.CommandName == commandName && c.ChannelName == channelName);

                return command;
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        public static async Task<bool> CommandExists(DecatronDbContext context, string commandName, string channelName)
        {
            try
            {
                return await context.CustomCommands
                    .AnyAsync(c => c.CommandName == commandName && c.ChannelName == channelName);
            }
            catch (Exception ex)
            {
                return false;
            }
        }

        public static async Task<bool> CreateCustomCommand(DecatronDbContext context, CustomCommand command)
        {
            try
            {
                context.CustomCommands.Add(command);
                var result = await context.SaveChangesAsync();
                return result > 0;
            }
            catch (Exception ex)
            {
                return false;
            }
        }

        public static async Task<bool> UpdateCustomCommand(DecatronDbContext context, CustomCommand command)
        {
            try
            {
                context.CustomCommands.Update(command);
                var result = await context.SaveChangesAsync();
                return result > 0;
            }
            catch (Exception ex)
            {
                return false;
            }
        }

        public static async Task<bool> DeleteCustomCommand(DecatronDbContext context, string commandName, string channelName)
        {
            try
            {
                var command = await GetCustomCommand(context, commandName, channelName);
                if (command != null)
                {
                    context.CustomCommands.Remove(command);
                    var result = await context.SaveChangesAsync();
                    return result > 0;
                }
                return false;
            }
            catch (Exception ex)
            {
                return false;
            }
        }
    }
}