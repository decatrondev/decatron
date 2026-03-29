// GameFunction.cs adaptado
using System;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Microsoft.Extensions.Configuration;
using Decatron.Core.Helpers;

namespace Decatron.Core.Functions
{
    public class GameFunction
    {
        private readonly IConfiguration _configuration;
        private static readonly HttpClient _httpClient = new HttpClient();

        public GameFunction(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<string> Execute(string channelName, string? targetChannelName = null)
        {
            try
            {
                string channelToCheck = targetChannelName ?? channelName;

                var accessToken = await Utils.GetAccessTokenFromDatabaseAsync(_configuration, channelName);

                if (string.IsNullOrEmpty(accessToken))
                {
                    return "Desconocido";
                }

                var clientId = _configuration["TwitchSettings:ClientId"];
                Utils.ConfigureTwitchApiHeaders(_httpClient, _configuration, accessToken);

                // First request to get user ID
                var userResponse = await _httpClient.GetAsync($"https://api.twitch.tv/helix/users?login={channelToCheck}");
                if (!userResponse.IsSuccessStatusCode)
                {
                    return "Desconocido";
                }

                var userContent = await userResponse.Content.ReadAsStringAsync();
                var userJson = JObject.Parse(userContent);
                var userId = userJson["data"][0]["id"].ToString();

                // Second request to get channel info
                var channelResponse = await _httpClient.GetAsync($"https://api.twitch.tv/helix/channels?broadcaster_id={userId}");
                if (!channelResponse.IsSuccessStatusCode)
                {
                    return "Desconocido";
                }

                var channelContent = await channelResponse.Content.ReadAsStringAsync();
                var channelJson = JObject.Parse(channelContent);
                var gameName = channelJson["data"][0]["game_name"].ToString();

                return gameName;
            }
            catch (Exception ex)
            {
                return "Desconocido";
            }
        }
    }
}