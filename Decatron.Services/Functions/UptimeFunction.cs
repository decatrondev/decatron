// UptimeFunction.cs adaptado
using System;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Microsoft.Extensions.Configuration;
using System.Collections.Generic;
using Decatron.Core.Helpers;

namespace Decatron.Core.Functions
{
    public class UptimeFunction
    {
        private readonly IConfiguration _configuration;
        private static readonly HttpClient _httpClient = new HttpClient();

        public UptimeFunction(IConfiguration configuration)
        {
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        }

        public async Task<string> Execute(string channelName, string? targetChannelName = null)
        {
            try
            {
                if (string.IsNullOrEmpty(channelName))
                {
                    throw new ArgumentException("El nombre del canal no puede ser nulo o vacío", nameof(channelName));
                }

                string channelToCheck = targetChannelName ?? channelName;

                var accessToken = await Utils.GetAccessTokenFromDatabaseAsync(_configuration, channelName);
                if (string.IsNullOrEmpty(accessToken))
                {
                    return "Error: No se pudo obtener el token de acceso";
                }

                var clientId = _configuration["TwitchSettings:ClientId"];
                if (string.IsNullOrEmpty(clientId))
                {
                    return "Error: Configuración incompleta";
                }

                Utils.ConfigureTwitchApiHeaders(_httpClient, _configuration, accessToken);

                var streamResponse = await _httpClient.GetAsync($"https://api.twitch.tv/helix/streams?user_login={channelToCheck}");
                if (!streamResponse.IsSuccessStatusCode)
                {
                    return $"Error al obtener información del stream: {streamResponse.StatusCode}";
                }

                var streamContent = await streamResponse.Content.ReadAsStringAsync();
                var streamJson = JObject.Parse(streamContent);

                if (streamJson["data"] == null || !streamJson["data"].HasValues)
                {
                    return "El canal no está en directo actualmente.";
                }

                var startedAt = DateTime.Parse(streamJson["data"][0]["started_at"].ToString());
                var uptime = DateTime.UtcNow - startedAt;

                return FormatUptime(uptime);
            }
            catch (Exception ex)
            {
                return $"Error al calcular el tiempo en directo: {ex.Message}";
            }
        }

        private string FormatUptime(TimeSpan duration)
        {
            int days = (int)duration.TotalDays;
            int hours = duration.Hours;
            int minutes = duration.Minutes;
            int seconds = duration.Seconds;

            List<string> parts = new List<string>();

            if (days > 0)
                parts.Add($"{days} {(days == 1 ? "día" : "días")}");
            if (hours > 0)
                parts.Add($"{hours} {(hours == 1 ? "hora" : "horas")}");
            if (minutes > 0)
                parts.Add($"{minutes} {(minutes == 1 ? "minuto" : "minutos")}");
            if (seconds > 0)
                parts.Add($"{seconds} {(seconds == 1 ? "segundo" : "segundos")}");

            string durationString = string.Join(", ", parts);

            int lastCommaIndex = durationString.LastIndexOf(", ");
            if (lastCommaIndex != -1)
            {
                durationString = durationString.Substring(0, lastCommaIndex) + " y" + durationString.Substring(lastCommaIndex + 1);
            }

            return $"{durationString}.";
        }
    }
}