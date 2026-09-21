using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>
    /// Los textos que la Rueda escribe en el chat.
    ///
    /// <para>Cada mensaje tiene una base de Decatron en español e inglés, y el streamer
    /// puede reemplazarlo por el suyo. Si deja el campo vacío vuelve a salir el de
    /// Decatron: no hay forma de terminar con un mensaje en blanco, que es peor que uno
    /// genérico.</para>
    ///
    /// <para>Vive en <c>wheels.announce_config</c> bajo la clave <c>chat</c>, con la
    /// forma <c>{ "chat": { "win": { "es": "...", "en": "..." } } }</c>.</para>
    /// </summary>
    public static class WheelMessages
    {
        // ----------------------------------------------------------------
        // Las claves
        // ----------------------------------------------------------------
        public const string Win = "win";
        public const string WinCoins = "winCoins";
        public const string WinPending = "winPending";

        /// <summary>Resumen de un "girar x N". Un mensaje por giro seria spam.</summary>
        public const string WinMulti = "winMulti";

        /// <summary>Aporte acreditado con `viewer_choice`: hay giros, decide el espectador.</summary>
        public const string ChoiceReady = "choiceReady";

        /// <summary>Compra de creditos con deca coins.</summary>
        public const string Bought = "bought";
        public const string NotEnoughCoins = "notEnoughCoins";
        public const string BuyTooSmall = "buyTooSmall";
        public const string BuyNoAccount = "buyNoAccount";
        public const string Balance = "balance";
        public const string BalanceLow = "balanceLow";
        public const string NoCredits = "noCredits";
        public const string Cooldown = "cooldown";
        public const string StreamLimit = "streamLimit";
        public const string WheelOff = "wheelOff";

        // --- modo Sorteo (Fase 4) ---
        public const string RaffleJoined   = "raffleJoined";
        public const string RaffleClosed   = "raffleClosed";
        public const string RaffleAlready  = "raffleAlready";
        public const string RaffleNeedSub  = "raffleNeedSub";
        public const string RaffleNeedFollow = "raffleNeedFollow";
        public const string RaffleNeedTime = "raffleNeedTime";
        public const string RaffleOpened   = "raffleOpened";
        public const string RaffleWinner   = "raffleWinner";
        public const string RaffleEmpty    = "raffleEmpty";

        /// <summary>
        /// Qué variable acepta cada mensaje. El panel las muestra para que el streamer
        /// no tenga que adivinarlas, y sirven para avisarle si escribe una que no existe.
        /// </summary>
        public static readonly IReadOnlyDictionary<string, string[]> Placeholders = new Dictionary<string, string[]>
        {
            [Win]         = new[] { "user", "label", "balance", "credits", "wheel" },
            [WinCoins]    = new[] { "user", "label", "coins", "balance", "credits", "wheel" },
            [WinPending]  = new[] { "user", "label", "balance", "credits", "wheel" },
            [WinMulti]    = new[] { "user", "spins", "labels", "coins", "balance", "credits", "wheel" },
            [ChoiceReady] = new[] { "user", "spins", "balance", "credits", "wheel", "command" },
            [Bought]      = new[] { "user", "coins", "added", "balance", "credits", "wheel" },
            [NotEnoughCoins] = new[] { "user", "coins", "wheel" },
            [BuyTooSmall] = new[] { "user", "credits", "wheel" },
            [BuyNoAccount] = new[] { "user" },
            [Balance]     = new[] { "user", "balance", "spins", "price", "credits", "wheel" },
            [BalanceLow]  = new[] { "user", "balance", "price", "credits", "wheel" },
            [NoCredits]   = new[] { "user", "balance", "price", "credits", "wheel" },
            [Cooldown]    = new[] { "user", "seconds", "wheel" },
            [StreamLimit] = new[] { "user", "wheel" },
            [WheelOff]    = new[] { "user", "wheel" },

            [RaffleJoined]     = new[] { "user", "entries", "weight", "pool", "wheel" },
            [RaffleClosed]     = new[] { "user", "wheel" },
            [RaffleAlready]    = new[] { "user", "entries", "wheel" },
            [RaffleNeedSub]    = new[] { "user", "wheel" },
            [RaffleNeedFollow] = new[] { "user", "wheel" },
            [RaffleNeedTime]   = new[] { "user", "minutes", "wheel" },
            [RaffleOpened]     = new[] { "command", "wheel" },
            [RaffleWinner]     = new[] { "winner", "pool", "wheel" },
            [RaffleEmpty]      = new[] { "user", "wheel" },
        };

        public static IEnumerable<string> Keys => Placeholders.Keys;

        // ----------------------------------------------------------------
        // Las bases de Decatron
        // ----------------------------------------------------------------
        private static readonly Dictionary<string, (string Es, string En)> Defaults = new()
        {
            [Win] = (
                "🎡 @{user} giró la rueda y sacó: {label} — te quedan {balance} {credits}.",
                "🎡 @{user} spun the wheel and got: {label} — you have {balance} {credits} left."),

            [WinCoins] = (
                "🎡 @{user} giró la rueda y sacó: {label} (+{coins} coins) — te quedan {balance} {credits}.",
                "🎡 @{user} spun the wheel and got: {label} (+{coins} coins) — you have {balance} {credits} left."),

            [ChoiceReady] = (
                "🎡 @{user}, te quedaron {balance} {credits}: alcanzan para {spins} giros. Tú decides cuántos gastas — usa {command} 3, por ejemplo.",
                "🎡 @{user}, you have {balance} {credits} left: enough for {spins} spins. You decide how many to spend — try {command} 3."),

            [Bought] = (
                "🪙 @{user} cambió {coins} deca coins por {added} {credits} — ahora tienes {balance}.",
                "🪙 @{user} traded {coins} deca coins for {added} {credits} — you now have {balance}."),

            [NotEnoughCoins] = (
                "🪙 @{user}, no te alcanzan los deca coins: tienes {coins}.",
                "🪙 @{user}, you don't have enough deca coins: you have {coins}."),

            [BuyTooSmall] = (
                "🪙 @{user}, esa cantidad no llega ni a un {credits}. Prueba con más.",
                "🪙 @{user}, that amount doesn't even buy one {credits}. Try a bigger one."),

            [BuyNoAccount] = (
                "🪙 @{user}, para esto necesitas una cuenta en Decatron.",
                "🪙 @{user}, you need a Decatron account for this."),

            [WinMulti] = (
                "🎡 @{user} giró {spins} veces y sacó: {labels} — te quedan {balance} {credits}.",
                "🎡 @{user} spun {spins} times and got: {labels} — you have {balance} {credits} left."),

            [WinPending] = (
                "🎡 @{user} giró la rueda y sacó: {label} — el streamer te lo entrega a mano. Te quedan {balance} {credits}.",
                "🎡 @{user} spun the wheel and got: {label} — the streamer will hand it to you. You have {balance} {credits} left."),

            [Balance] = (
                "@{user}, tienes {balance} {credits} — te alcanza para {spins} giro(s).",
                "@{user}, you have {balance} {credits} — enough for {spins} spin(s)."),

            [BalanceLow] = (
                "@{user}, tienes {balance} {credits}. Un giro cuesta {price}.",
                "@{user}, you have {balance} {credits}. A spin costs {price}."),

            [NoCredits] = (
                "@{user}, te faltan {credits}: tienes {balance} y el giro cuesta {price}.",
                "@{user}, not enough {credits}: you have {balance} and a spin costs {price}."),

            [Cooldown] = (
                "@{user}, espera {seconds}s para volver a girar.",
                "@{user}, wait {seconds}s before spinning again."),

            [StreamLimit] = (
                "@{user}, ya usaste todos tus giros de este stream.",
                "@{user}, you've used all your spins for this stream."),

            [WheelOff] = (
                "@{user}, la rueda no está disponible ahora mismo.",
                "@{user}, the wheel isn't available right now."),

            // --- modo Sorteo ---
            [RaffleJoined] = (
                "🎟️ @{user} entró al sorteo — {entries} boleto(s), peso {weight}. Van {pool} participantes.",
                "🎟️ @{user} joined the raffle — {entries} ticket(s), weight {weight}. {pool} people in."),

            [RaffleClosed] = (
                "@{user}, la inscripción está cerrada.",
                "@{user}, entries are closed."),

            [RaffleAlready] = (
                "@{user}, ya estás dentro con {entries} boleto(s).",
                "@{user}, you're already in with {entries} ticket(s)."),

            [RaffleNeedSub] = (
                "@{user}, este sorteo es solo para subs.",
                "@{user}, this raffle is subs only."),

            [RaffleNeedFollow] = (
                "@{user}, tienes que seguir el canal para entrar.",
                "@{user}, you need to follow the channel to enter."),

            [RaffleNeedTime] = (
                "@{user}, te faltan {minutes} minuto(s) de watchtime para entrar.",
                "@{user}, you need {minutes} more watchtime minute(s) to enter."),

            [RaffleOpened] = (
                "🎟️ ¡Sorteo abierto! Escribe {command} para participar.",
                "🎟️ Raffle open! Type {command} to join."),

            [RaffleWinner] = (
                "🎉 ¡Ganó @{winner}! (de {pool} participantes)",
                "🎉 @{winner} won! (out of {pool} entries)"),

            [RaffleEmpty] = (
                "@{user}, no hay suficientes participantes para sortear.",
                "@{user}, not enough entries to draw."),
        };

        /// <summary>El texto de Decatron para una clave y un idioma.</summary>
        public static string Default(string key, string lang)
        {
            if (!Defaults.TryGetValue(key, out var par)) return string.Empty;
            return lang == "en" ? par.En : par.Es;
        }

        /// <summary>Las bases completas, para que el panel pueda mostrarlas y restaurarlas.</summary>
        public static object AllDefaults() =>
            Defaults.ToDictionary(kv => kv.Key, kv => (object)new { es = kv.Value.Es, en = kv.Value.En });

        // ----------------------------------------------------------------
        // Resolución
        // ----------------------------------------------------------------

        /// <summary>
        /// El texto que toca escribir: el del streamer si lo puso, el de Decatron si no,
        /// ya con las variables reemplazadas.
        /// </summary>
        public static string Render(string? announceConfigJson, string key, string lang, IDictionary<string, object?> valores)
        {
            var plantilla = Custom(announceConfigJson, key, lang) ?? Default(key, lang);
            return Fill(plantilla, valores);
        }

        /// <summary>El texto propio del streamer, o null si no puso ninguno.</summary>
        public static string? Custom(string? announceConfigJson, string key, string lang)
        {
            if (string.IsNullOrWhiteSpace(announceConfigJson)) return null;

            try
            {
                using var doc = JsonDocument.Parse(announceConfigJson);
                if (!doc.RootElement.TryGetProperty("chat", out var chat)) return null;
                if (!chat.TryGetProperty(key, out var entrada)) return null;

                // Se acepta tanto { "es": "...", "en": "..." } como un texto suelto, que
                // es lo que quedaría si alguien edita el jsonb a mano.
                var texto = entrada.ValueKind == JsonValueKind.String
                    ? entrada.GetString()
                    : entrada.TryGetProperty(lang, out var porIdioma) ? porIdioma.GetString() : null;

                // Vacío cuenta como "no configurado": borrar el campo devuelve la base
                // de Decatron en vez de dejar al bot mudo.
                return string.IsNullOrWhiteSpace(texto) ? null : texto;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Reemplaza <c>{variable}</c> por su valor. Una variable que no existe se deja
        /// tal cual: es más fácil ver <c>{usuario}</c> en el chat y entender el error que
        /// ver un hueco donde debía ir un nombre.
        /// </summary>
        public static string Fill(string plantilla, IDictionary<string, object?> valores)
        {
            if (string.IsNullOrEmpty(plantilla)) return string.Empty;

            var sb = new System.Text.StringBuilder(plantilla.Length + 32);
            for (var i = 0; i < plantilla.Length; i++)
            {
                if (plantilla[i] != '{') { sb.Append(plantilla[i]); continue; }

                var cierre = plantilla.IndexOf('}', i + 1);
                if (cierre < 0) { sb.Append(plantilla[i]); continue; }

                var nombre = plantilla[(i + 1)..cierre];
                if (valores.TryGetValue(nombre, out var valor))
                {
                    sb.Append(valor?.ToString() ?? string.Empty);
                    i = cierre;
                }
                else
                {
                    sb.Append(plantilla[i]);
                }
            }

            return sb.ToString();
        }
    }
}
