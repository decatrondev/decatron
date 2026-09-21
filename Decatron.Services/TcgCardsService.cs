using Decatron.Core.Models.Tcg;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    // Abrir sobres del TCG de cards coleccionables — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md
    public class TcgCardsService
    {
        private readonly DecatronDbContext _db;
        private readonly CoinService _coinService;
        private readonly ILogger<TcgCardsService> _logger;

        // Orden de rareza validado contra el generador real (tables.js, lado de
        // generacion) — MR es el techo real, no LR. Ver plan seccion 2.
        private static readonly string[] RarityOrder = { "N", "R", "SR", "SSR", "UR", "LR", "MR" };

        private static readonly (string Rarity, double Weight)[] PullWeights =
        {
            ("N", 45.0), ("R", 30.0), ("SR", 15.0), ("SSR", 6.0), ("UR", 2.5), ("LR", 1.0), ("MR", 0.5),
        };

        private const int PityThreshold = 20;
        private const string PitySafeRarity = "SR"; // garantia: "SR o superior"

        // Tope por compra — evita que un error de UI (o un click repetido) vacie el
        // balance de golpe. No es un limite de cuantos sobres se pueden acumular.
        private const int MaxPacksPerPurchase = 50;

        // Claim gratis (plan seccion 4.2). La tabla esta deliberadamente aplastada
        // hacia rareza baja: existe para retencion diaria, no como via real de
        // conseguir lo bueno. Y toda carta de claim vale 1 de catalogo para siempre
        // (seccion 6.4) — se puede upgradear para pelear, nunca para valer.
        private const int ClaimCooldownHours = 24;
        private const int ClaimCatalogValue = 1;

        /// <summary>
        /// Origen de las cartas que salen de un sobre gratis. Deliberadamente distinto de
        /// "claimed": el cooldown del claim diario se calcula buscando la ultima instancia
        /// con ese origen, asi que si compartieran uno, abrir un sobre gratis le resetearia
        /// el cooldown a la carta diaria.
        /// </summary>
        private const string FreePackOrigin = "free_pack";
        private static readonly (string Rarity, double Weight)[] ClaimWeights =
        {
            ("N", 78.0), ("R", 17.0), ("SR", 4.0), ("SSR", 0.9), ("UR", 0.09), ("LR", 0.009), ("MR", 0.001),
        };

        // Una carta, UN SOLO intento de upgrade en toda su vida (plan seccion 6).
        // El intento es gratis y el resultado sale al instante; lo que se paga es
        // CONFIRMARLO, y para eso hay esta ventana. Si no paga, la carta se destruye
        // igual: el riesgo es el punto del sistema.
        //
        // El nivel 10 es la excepción: espera a que se suba su ilustración, y recién
        // ahí arranca su ventana de pago (ver ReleaseArtWaitersAsync). El tiempo que
        // tarde el dueño en generarla no se le descuenta al jugador.
        private const int UpgradePaymentWindowHours = 24;

        // Resultado de la tirada unica: 0 = destruida, 1-10 = nivel que le tocó.
        // Pesos sobre 100 — nivel alto exponencialmente mas raro, igual que el resto
        // del sistema (sección 6.5).
        private static readonly (short Level, double Weight)[] GradingOutcomeWeights =
        {
            (0, 15.0),  // fail / destruida
            (1, 30.0), (2, 18.0), (3, 12.0), (4, 8.0), (5, 6.0),
            (6, 4.5), (7, 3.0), (8, 2.0), (9, 1.0), (10, 0.5),
        };

        private static readonly Dictionary<string, int> RarityMultiplier = new()
        {
            ["N"] = 1, ["R"] = 2, ["SR"] = 4, ["SSR"] = 8, ["UR"] = 16, ["LR"] = 32, ["MR"] = 64,
        };

        // ── Economía del gradeo (redefinida 2026-08-11) ──────────────────────────
        //
        // Todo sale del valor base de la carta (rareza x10). Dos curvas separadas sobre
        // esa base: una da lo que cuesta confirmar, otra da cuánto pasa a valer.
        //
        // Lo importante es que el valor NO incluye lo que se pagó. Antes era
        // "base + costo", y como el costo aplastaba a la base el valor terminaba siendo
        // el costo con otro nombre: pagabas 160.000 para que valiera 160.040. Un ranking
        // de colección más valiosa habría sido un ranking de quién gastó más, que es
        // justo lo que el plan (sección 6.5) quería evitar.
        //
        // Además el ratio entre valor y costo sube con el grado (x2 en el 1, x8 en el
        // 10): así conviene pagar los grados altos, y de paso el costo no delata el
        // valor — que el jugador recién ve DESPUÉS de pagar.

        /// <summary>Cuánto multiplica al valor base cada grado (índice 0 = grado 1).</summary>
        private static readonly double[] GradeValueMultiplier = { 1.5, 2, 3, 4, 6, 9, 14, 22, 40, 100 };

        /// <summary>Cuánto multiplica al valor base el costo de confirmar (índice 0 = grado 1).</summary>
        private static readonly double[] GradeCostFactor = { 0.75, 1, 1.25, 1.5, 2, 2.5, 3.5, 4.5, 6.5, 12.5 };

        /// <summary>Lo que cuesta confirmar ese grado en esa rareza.</summary>
        public static int UpgradeCostFor(string rarity, short grade)
        {
            if (grade < 1 || grade > GradeCostFactor.Length) return 0;
            return (int)Math.Round(BaseValueForRarity(rarity) * GradeCostFactor[grade - 1], MidpointRounding.AwayFromZero);
        }

        /// <summary>
        /// En cuánto queda el valor de catálogo al confirmar ese grado. Las cartas que no
        /// se compraron —claim diario y sobres gratis— son la excepción: valen 1 para
        /// siempre (plan sección 6.4), se pueden gradear para pelear mejor pero nunca para
        /// valer. La vista de detalle lo avisa ANTES del botón de pagar, porque el valor
        /// recién se revela después del pago y si no gastarías a ciegas por nada.
        /// </summary>
        public static int CatalogValueFor(string origin, string rarity, short grade)
        {
            // Todo lo que no se compro vale 1 para siempre. Va por "no es pulled" y no
            // enumerando origenes gratuitos a proposito: si mañana aparece otra via de
            // regalar cartas, entra sola en la regla en vez de imprimir valor por olvido.
            if (origin != "pulled") return ClaimCatalogValue;
            if (grade < 1 || grade > GradeValueMultiplier.Length) return BaseValueForRarity(rarity);
            return (int)Math.Round(BaseValueForRarity(rarity) * GradeValueMultiplier[grade - 1], MidpointRounding.AwayFromZero);
        }

        // Arte nuevo SOLO en nivel 10 (rediseño 2026-08-11). Del 1 al 9 se muestra el
        // arte base dentro de una cápsula tipo PSA con el número de grado, que dibuja
        // el frontend — no pide nada al lado de generación. Antes eran tres milestones
        // (3/6/9) y eso obligaba a generar arte en el ~25% de los upgrades; ahora solo
        // en el 0.5% que saca un 10.
        public const short ArtMilestoneLevel = 10;

        /// <summary>
        /// El nivel cuyo arte corresponde mostrar. Del 0 al 9 es siempre el arte base;
        /// el 10 tiene el suyo propio.
        /// </summary>
        public static short EffectiveArtLevel(short level) => level >= ArtMilestoneLevel ? ArtMilestoneLevel : (short)0;

        public TcgCardsService(DecatronDbContext db, CoinService coinService, ILogger<TcgCardsService> logger)
        {
            _db          = db;
            _coinService = coinService;
            _logger      = logger;
        }

        public async Task<List<CardSobreTier>> GetActiveSobreTiersAsync()
        {
            return await _db.CardSobreTiers
                .Where(t => t.Active)
                .OrderBy(t => t.PriceCoins)
                .ToListAsync();
        }

        /// <summary>
        /// Cobra uno o mas sobres y los deja en el inventario del jugador, sin abrirlos.
        /// Comprar y abrir son dos acciones separadas: se puede acumular sobres y abrirlos
        /// cuando se quiera. Si el cobro se hizo pero no se pudieron guardar los sobres, se
        /// reembolsa automaticamente en vez de dejar a alguien pagando por nada — son dos
        /// pasos, no una sola transaccion, asi que la compensacion es la forma correcta de
        /// mantenerlo atomico de cara al jugador.
        /// </summary>
        public async Task<List<PlayerPackInventory>> BuyPacksAsync(long userId, int sobreTierId, int quantity)
        {
            if (quantity < 1 || quantity > MaxPacksPerPurchase)
                throw new InvalidOperationException($"Cantidad invalida (1 a {MaxPacksPerPurchase} por compra)");

            var tier = await _db.CardSobreTiers.FirstOrDefaultAsync(t => t.Id == sobreTierId && t.Active);
            if (tier == null)
                throw new InvalidOperationException("Sobre no disponible");

            var totalCost = tier.PriceCoins * quantity;

            await _coinService.SpendCoinsAsync(
                userId, totalCost, "tcg_sobre_purchase",
                quantity == 1
                    ? $"Sobre {tier.Name} ({tier.CardCount} cartas)"
                    : $"{quantity}x Sobre {tier.Name} ({tier.CardCount} cartas c/u)");

            try
            {
                var now = DateTime.UtcNow;
                var packs = Enumerable.Range(0, quantity).Select(_ => new PlayerPackInventory
                {
                    OwnerAccountId = userId,
                    SobreTierId    = tier.Id,
                    PurchasedAt    = now,
                    PricePaid      = tier.PriceCoins,
                }).ToList();

                _db.PlayerPackInventories.AddRange(packs);
                await _db.SaveChangesAsync();

                _logger.LogInformation(
                    "Sobres comprados: User={UserId}, Tier={Tier}, Cantidad={Quantity}, Total={Total}",
                    userId, tier.Name, quantity, totalCost);
                return packs;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Fallo guardando {Quantity} sobre(s) {Tier} de user {UserId} DESPUES de cobrar {Coins} coins — reembolsando",
                    quantity, tier.Name, userId, totalCost);

                await _coinService.GiveCoinsAsync(
                    userId, totalCost,
                    $"Reembolso automatico — fallo al comprar sobre {tier.Name}", null);

                throw new InvalidOperationException("No se pudo completar la compra, se reembolsaron tus coins. Intenta de nuevo.");
            }
        }

        /// <summary>
        /// Los sobres sin abrir del jugador, agrupados por tier (la vista de abrir
        /// muestra "Legendario x3", no tres filas identicas).
        /// </summary>
        public async Task<List<(CardSobreTier Tier, bool IsFree, int Count)>> GetPackInventoryAsync(long userId)
        {
            // Se agrupa por (tier, gratis) y no solo por tier: un jugador puede tener a la
            // vez sobres pagos y gratis del mismo tipo, y no dan lo mismo al abrirlos.
            var counts = await _db.PlayerPackInventories
                .Where(p => p.OwnerAccountId == userId)
                .GroupBy(p => new { p.SobreTierId, p.IsFree })
                .Select(g => new { g.Key.SobreTierId, g.Key.IsFree, Count = g.Count() })
                .ToListAsync();

            if (counts.Count == 0)
                return new List<(CardSobreTier, bool, int)>();

            var tierIds = counts.Select(c => c.SobreTierId).Distinct().ToList();
            var tiers = await _db.CardSobreTiers
                .Where(t => tierIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id);

            return counts
                .Where(c => tiers.ContainsKey(c.SobreTierId))
                .Select(c => (tiers[c.SobreTierId], c.IsFree, c.Count))
                .OrderBy(x => x.Item2)          // los pagos primero
                .ThenBy(x => x.Item1.PriceCoins)
                .ToList();
        }

        /// <summary>
        /// Consume un sobre del inventario y entrega sus cartas. No cobra nada — ya se
        /// pago al comprarlo. Si la entrega falla, el sobre vuelve al inventario en vez de
        /// desaparecer sin dar nada.
        /// </summary>
        public async Task<(CardSobreTier Tier, List<PlayerCardInstance> Cards)> OpenPackAsync(long userId, int sobreTierId, bool isFree = false)
        {
            var pack = await _db.PlayerPackInventories
                .Where(p => p.OwnerAccountId == userId && p.SobreTierId == sobreTierId && p.IsFree == isFree)
                .OrderBy(p => p.PurchasedAt)
                .FirstOrDefaultAsync();

            if (pack == null)
                throw new InvalidOperationException("No tenes ningun sobre de ese tipo sin abrir");

            var tier = await _db.CardSobreTiers.FirstOrDefaultAsync(t => t.Id == sobreTierId);
            if (tier == null)
                throw new InvalidOperationException("Sobre no disponible");

            // Se saca del inventario ANTES de entregar las cartas: si dos pestañas mandan
            // "abrir" a la vez, la segunda ya no encuentra el sobre y falla, en vez de
            // entregar las cartas dos veces por el mismo sobre.
            _db.PlayerPackInventories.Remove(pack);
            await _db.SaveChangesAsync();

            try
            {
                var instances = await GrantSobreCardsAsync(userId, tier, pack.IsFree);
                _logger.LogInformation(
                    "Sobre abierto: User={UserId}, Tier={Tier}, Gratis={IsFree}, Cartas={Count}",
                    userId, tier.Name, pack.IsFree, instances.Count);
                return (tier, instances);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Fallo entregando cartas de sobre {Tier} a user {UserId} — devolviendo el sobre al inventario",
                    tier.Name, userId);

                _db.PlayerPackInventories.Add(new PlayerPackInventory
                {
                    OwnerAccountId = pack.OwnerAccountId,
                    SobreTierId    = pack.SobreTierId,
                    PurchasedAt    = pack.PurchasedAt,
                    PricePaid      = pack.PricePaid,
                    IsFree         = pack.IsFree,
                });
                await _db.SaveChangesAsync();

                throw new InvalidOperationException("No se pudo abrir el sobre. Sigue en tu inventario, intenta de nuevo.");
            }
        }

        /// <summary>
        /// Tira y entrega las cartas de un sobre. Con <paramref name="isFree"/> el sobre
        /// es la version reclamada gratis: sus cartas valen 1 de catalogo, no hay piso de
        /// rareza garantizado y el pity ni se lee ni se toca. Esos tres frenos son lo que
        /// separa al sobre gratis del pago — el contenido y la cantidad son identicos.
        /// </summary>
        private async Task<List<PlayerCardInstance>> GrantSobreCardsAsync(long userId, CardSobreTier tier, bool isFree = false)
        {
            var now = DateTime.UtcNow;
            var activeEventIds = await _db.CardEventBanners
                .Where(b => b.Active && b.StartsAt <= now && b.EndsAt >= now)
                .Select(b => b.EventId)
                .ToListAsync();

            var eligibleCards = await _db.Cards
                .Where(c => string.IsNullOrEmpty(c.EventId) || activeEventIds.Contains(c.EventId))
                .Select(c => new { c.Id, c.Rarity })
                .ToListAsync();

            var byRarity = eligibleCards
                .GroupBy(c => c.Rarity)
                .ToDictionary(g => g.Key, g => g.Select(c => c.Id).ToList());

            // El pity es la garantia que se compra con los sobres pagos. Si el sobre gratis
            // lo moviera, se podria farmear el SR+ asegurado sin gastar un coin.
            PlayerPityCounter? pity = null;
            if (!isFree)
            {
                pity = await _db.PlayerPityCounters.FirstOrDefaultAsync(p => p.OwnerAccountId == userId);
                if (pity == null)
                {
                    pity = new PlayerPityCounter { OwnerAccountId = userId, CardsSinceLastSrPlus = 0 };
                    _db.PlayerPityCounters.Add(pity);
                }
            }

            var random = new Random();
            var srIndex = Array.IndexOf(RarityOrder, PitySafeRarity);
            var pulledRarities = new List<string>();

            for (var i = 0; i < tier.CardCount; i++)
            {
                string rarity;

                // Pity: si el proximo tiro llega al umbral sin haber sacado SR+, se
                // fuerza SR+ ahi mismo en vez de esperar a que la probabilidad lo de.
                if (pity != null && pity.CardsSinceLastSrPlus + 1 >= PityThreshold)
                    rarity = RollWeightedAmong(RarityOrder.Skip(srIndex).ToArray(), random);
                else
                    rarity = RollWeightedAmong(RarityOrder, random);

                pulledRarities.Add(rarity);

                if (pity == null)
                    continue;

                if (Array.IndexOf(RarityOrder, rarity) >= srIndex)
                {
                    pity.CardsSinceLastSrPlus = 0;
                    pity.LastResetAt = now;
                }
                else
                {
                    pity.CardsSinceLastSrPlus++;
                }
            }

            // Piso garantizado del sobre: si ninguna carta llego a la rareza minima
            // prometida, se fuerza la ultima a esa rareza o superior. El sobre gratis no
            // lo tiene — tira a probabilidad pura, y esa es la diferencia que le deja algo
            // propio al pago.
            var floorIndex = isFree ? -1 : Array.IndexOf(RarityOrder, tier.GuaranteedFloorRarity);
            if (floorIndex > 0 && !pulledRarities.Any(r => Array.IndexOf(RarityOrder, r) >= floorIndex))
                pulledRarities[^1] = RollWeightedAmong(RarityOrder.Skip(floorIndex).ToArray(), random);

            var instances = new List<PlayerCardInstance>();
            foreach (var rarity in pulledRarities)
            {
                if (!byRarity.TryGetValue(rarity, out var pool) || pool.Count == 0)
                    throw new InvalidOperationException($"No hay cartas disponibles de rareza {rarity} en este momento");

                var cardId = pool[random.Next(pool.Count)];

                instances.Add(new PlayerCardInstance
                {
                    CardId         = cardId,
                    OwnerAccountId = userId,
                    Level          = 0,
                    Origin         = isFree ? FreePackOrigin : "pulled",
                    CatalogValue   = isFree ? ClaimCatalogValue : BaseValueForRarity(rarity),
                    Status         = "active",
                    AcquiredAt     = now,
                    CreatedAt      = now,
                    UpdatedAt      = now,
                });
            }

            _db.PlayerCardInstances.AddRange(instances);
            await _db.SaveChangesAsync();

            return instances;
        }

        // ─── Sobres gratis con cooldown por tier ────────────────────────────────────

        /// <summary>Un sobre gratis y su estado de cooldown para este jugador.</summary>
        public record FreePackStatus(CardSobreTier Tier, int CooldownHours, DateTime? AvailableAt);

        /// <summary>
        /// Los sobres que tienen version gratis, con el momento en que cada uno vuelve a
        /// estar disponible (null = se puede reclamar ya). Los cooldowns son
        /// independientes entre tiers: gastar el Mini de hoy no toca al Legendario.
        /// </summary>
        public async Task<List<FreePackStatus>> GetFreePackStatusAsync(long userId)
        {
            var tiers = await _db.CardSobreTiers
                .Where(t => t.Active && t.FreeCooldownHours != null)
                .OrderBy(t => t.PriceCoins)
                .ToListAsync();

            if (tiers.Count == 0)
                return new List<FreePackStatus>();

            var tierIds = tiers.Select(t => t.Id).ToList();
            var claims = await _db.TcgFreePackClaims
                .Where(c => c.OwnerAccountId == userId && tierIds.Contains(c.SobreTierId))
                .ToDictionaryAsync(c => c.SobreTierId, c => c.ClaimedAt);

            var now = DateTime.UtcNow;
            return tiers.Select(t =>
            {
                var cooldown = t.FreeCooldownHours!.Value;
                DateTime? availableAt = null;

                if (claims.TryGetValue(t.Id, out var claimedAt))
                {
                    var next = DateTime.SpecifyKind(claimedAt, DateTimeKind.Utc).AddHours(cooldown);
                    if (next > now) availableAt = next;
                }

                return new FreePackStatus(t, cooldown, availableAt);
            }).ToList();
        }

        /// <summary>
        /// Entrega el sobre gratis de un tier al inventario, sin cobrar. El sobre queda
        /// marcado como gratis para que al abrirlo sus cartas valgan 1 y no tengan piso.
        ///
        /// <para>El cooldown se registra ANTES de crear el sobre a proposito: si algo
        /// falla en el medio, el costo es un cooldown perdido y no una fabrica de sobres
        /// a fuerza de reintentos. Mismo criterio que <see cref="OpenPackAsync"/>, que
        /// saca el sobre del inventario antes de entregar las cartas.</para>
        ///
        /// <para>Y se registra con un upsert condicional, no leyendo y despues escribiendo:
        /// dos clicks simultaneos leerian los dos el mismo cooldown vencido y se llevarian
        /// dos sobres.</para>
        /// </summary>
        public async Task<PlayerPackInventory> ClaimFreePackAsync(long userId, int sobreTierId)
        {
            var tier = await _db.CardSobreTiers.FirstOrDefaultAsync(t => t.Id == sobreTierId && t.Active);
            if (tier == null)
                throw new InvalidOperationException("Sobre no disponible");

            if (tier.FreeCooldownHours == null)
                throw new InvalidOperationException($"El sobre {tier.Name} no tiene version gratis");

            // Un solo statement atomico en vez de leer-comprobar-escribir: la version en
            // dos pasos deja pasar dos reclamos si llegan a la vez desde dos pestañas,
            // porque ambos leen el mismo cooldown vencido antes de que ninguno escriba.
            // Aca el propio UPDATE lleva la condicion, asi que el segundo afecta 0 filas.
            var now = DateTime.UtcNow;
            var claimed = await _db.Database.ExecuteSqlRawAsync(@"
                INSERT INTO tcg_free_pack_claims (owner_account_id, sobre_tier_id, claimed_at)
                VALUES ({0}, {1}, {2})
                ON CONFLICT (owner_account_id, sobre_tier_id) DO UPDATE
                    SET claimed_at = EXCLUDED.claimed_at
                    WHERE tcg_free_pack_claims.claimed_at <= {2} - make_interval(hours => {3})",
                userId, sobreTierId, now, tier.FreeCooldownHours.Value);

            if (claimed == 0)
                throw new InvalidOperationException($"Todavia no podes reclamar el sobre {tier.Name} gratis");

            var pack = new PlayerPackInventory
            {
                OwnerAccountId = userId,
                SobreTierId    = tier.Id,
                PurchasedAt    = now,
                PricePaid      = 0,
                IsFree         = true,
            };

            _db.PlayerPackInventories.Add(pack);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Sobre gratis reclamado: User={UserId}, Tier={Tier}", userId, tier.Name);
            return pack;
        }

        // ─── Claim gratis cada 24h (plan seccion 4.2) ───────────────────────────────

        /// <summary>
        /// Cuando el jugador va a poder volver a reclamar, o null si ya puede. El
        /// cooldown se calcula desde la ultima carta de origen "claimed" que tenga:
        /// no hace falta una tabla de cooldown aparte, ese dato ya es la propia carta.
        /// Se mira DestroyedAt tambien, para que destruir la carta en un upgrade no
        /// resetee el cooldown.
        /// </summary>
        public async Task<DateTime?> GetClaimAvailableAtAsync(long userId)
        {
            var lastClaimAt = await _db.PlayerCardInstances
                .Where(i => i.OwnerAccountId == userId && i.Origin == "claimed")
                .OrderByDescending(i => i.AcquiredAt)
                .Select(i => (DateTime?)i.AcquiredAt)
                .FirstOrDefaultAsync();

            if (lastClaimAt == null)
                return null;

            var availableAt = DateTime.SpecifyKind(lastClaimAt.Value, DateTimeKind.Utc).AddHours(ClaimCooldownHours);
            return availableAt <= DateTime.UtcNow ? null : availableAt;
        }

        /// <summary>
        /// Entrega la carta gratis del dia. Vale 1 de catalogo para siempre sin importar
        /// la rareza que salga ni el nivel al que llegue (plan seccion 6.4): sirve para
        /// jugar y para pelear, nunca para valer. No toca el contador de pity — el pity
        /// es una garantia que se compra con los sobres, no algo que el claim deba mover.
        /// </summary>
        public async Task<PlayerCardInstance> ClaimFreeCardAsync(long userId)
        {
            var availableAt = await GetClaimAvailableAtAsync(userId);
            if (availableAt != null)
                throw new InvalidOperationException("Todavia no podes reclamar tu carta gratis");

            var now = DateTime.UtcNow;
            var activeEventIds = await _db.CardEventBanners
                .Where(b => b.Active && b.StartsAt <= now && b.EndsAt >= now)
                .Select(b => b.EventId)
                .ToListAsync();

            var random = new Random();
            var rarity = RollWeightedAmong(
                ClaimWeights.Select(w => w.Rarity).ToArray(),
                random,
                ClaimWeights.ToDictionary(w => w.Rarity, w => w.Weight));

            var pool = await _db.Cards
                .Where(c => c.Rarity == rarity && (string.IsNullOrEmpty(c.EventId) || activeEventIds.Contains(c.EventId)))
                .Select(c => c.Id)
                .ToListAsync();

            if (pool.Count == 0)
                throw new InvalidOperationException($"No hay cartas disponibles de rareza {rarity} en este momento");

            var instance = new PlayerCardInstance
            {
                CardId         = pool[random.Next(pool.Count)],
                OwnerAccountId = userId,
                Level          = 0,
                Origin         = "claimed",
                CatalogValue   = ClaimCatalogValue,
                Status         = "active",
                AcquiredAt     = now,
                CreatedAt      = now,
                UpdatedAt      = now,
            };

            _db.PlayerCardInstances.Add(instance);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Claim gratis: User={UserId}, Rareza={Rarity}", userId, rarity);
            return instance;
        }

        // ─── Upgrade — una carta, un solo intento en toda su vida (plan seccion 6) ──

        /// <summary>
        /// Destruye los upgrades de este jugador que quedaron sin pagar a tiempo — se
        /// llama antes de listar la colección.
        ///
        /// <para>Ya no hay nada que "revelar" por tiempo: del 1 al 9 el resultado sale
        /// al instante, y el 10 espera a que se suba la ilustración, no al reloj.</para>
        /// </summary>
        public async Task ResolveDueUpgradesForUserAsync(long userId)
        {
            var now = DateTime.UtcNow;
            var due = await _db.PlayerCardInstances
                .Where(i => i.OwnerAccountId == userId
                         && i.Status == "frozen_pending_payment"
                         && i.PaymentDeadlineAt != null
                         && i.PaymentDeadlineAt <= now)
                .ToListAsync();

            foreach (var instance in due)
                await ExpireIfNeededAsync(instance);
        }

        /// <summary>
        /// Igual que <see cref="ResolveDueUpgradesForUserAsync"/> pero para TODOS los
        /// jugadores — sin esto, un pago vencido solo se resuelve cuando el dueño de esa
        /// carta vuelve a entrar a su colección, y la tabla de admin mostraría cartas
        /// "esperando pago" que en realidad ya perdieron el plazo.
        /// </summary>
        public async Task ResolveAllDueUpgradesAsync()
        {
            var now = DateTime.UtcNow;
            var due = await _db.PlayerCardInstances
                .Where(i => i.Status == "frozen_pending_payment"
                         && i.PaymentDeadlineAt != null
                         && i.PaymentDeadlineAt <= now)
                .ToListAsync();

            foreach (var instance in due)
                await ExpireIfNeededAsync(instance);
        }

        public async Task<PlayerCardInstance> GetOwnedInstanceAsync(long userId, long instanceId)
        {
            var instance = await _db.PlayerCardInstances
                .FirstOrDefaultAsync(i => i.Id == instanceId && i.OwnerAccountId == userId);
            if (instance == null)
                throw new InvalidOperationException("Carta no encontrada");

            await ExpireIfNeededAsync(instance);
            return instance;
        }

        /// <summary>
        /// Si una carta quedo esperando pago y ya vencieron las 24h, se destruye aca
        /// mismo (expiracion perezosa: se revisa cada vez que se toca la instancia).
        /// </summary>
        private async Task ExpireIfNeededAsync(PlayerCardInstance instance)
        {
            if (instance.Status != "frozen_pending_payment") return;
            if (instance.PaymentDeadlineAt == null || instance.PaymentDeadlineAt > DateTime.UtcNow) return;

            var now = DateTime.UtcNow;

            _db.UpgradeAttemptLogs.Add(new UpgradeAttemptLog
            {
                InstanceId              = instance.Id,
                OwnerAccountId          = instance.OwnerAccountId,
                CardId                  = instance.CardId,
                FromLevel               = 0,
                ToLevel                 = instance.PendingTargetLevel ?? 0,
                Result                  = "success_expired_unpaid",
                SuccessProbabilityUsed  = (decimal)(instance.PendingTargetLevel is short lvl
                    ? GradingOutcomeWeights.FirstOrDefault(w => w.Level == lvl).Weight
                    : 0),
                CostCharged             = null,
                RolledAt                = instance.UpdatedAt,
                ResolvedAt              = now,
            });

            instance.Status              = "destroyed";
            instance.DestroyedAt         = now;
            instance.PendingTargetLevel  = null;
            instance.PaymentAmountDue    = null;
            instance.PaymentDeadlineAt   = null;
            instance.UpdatedAt           = now;

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Upgrade vencido sin pagar: Instance={InstanceId}, User={UserId} — carta destruida",
                instance.Id, instance.OwnerAccountId);
        }

        private static short RollGradingOutcome()
        {
            var total = GradingOutcomeWeights.Sum(w => w.Weight);
            var roll = Random.Shared.NextDouble() * total;
            double cumulative = 0;
            foreach (var (level, weight) in GradingOutcomeWeights)
            {
                cumulative += weight;
                if (roll <= cumulative) return level;
            }
            return GradingOutcomeWeights[^1].Level;
        }

        /// <summary>
        /// El unico intento de upgrade que va a tener esta carta en su vida — gratis.
        /// El resultado sale AL INSTANTE (rediseño 2026-08-11), con una sola excepción:
        ///
        /// <list type="bullet">
        /// <item>Fallo → la carta se destruye ahí mismo.</item>
        /// <item>Nivel 1-9 → pasa directo a esperar pago. No hay espera: el arte es el
        /// base y la cápsula PSA la dibuja el frontend, así que no hay nada que preparar.</item>
        /// <item>Nivel 10 → queda "en gradeo" hasta que el dueño suba la ilustración.
        /// Lo que la destraba es el archivo, NO el reloj: antes se prometía resultado a
        /// las 24h aunque el arte no existiera. Las 24h ahora son un estimado que se le
        /// muestra al jugador, no un plazo que resuelve solo.</item>
        /// </list>
        /// </summary>
        public async Task<PlayerCardInstance> AttemptUpgradeAsync(long userId, long instanceId)
        {
            var instance = await GetOwnedInstanceAsync(userId, instanceId);

            if (instance.Status != "active")
                throw new InvalidOperationException("Esta carta no esta disponible para upgrade en este momento");
            if (instance.UpgradeUsed)
                throw new InvalidOperationException("Esta carta ya uso su unico intento de upgrade");

            var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == instance.CardId)
                ?? throw new InvalidOperationException("Carta base no encontrada");

            var now = DateTime.UtcNow;
            var outcome = RollGradingOutcome();

            instance.UpgradeUsed        = true;
            instance.AttemptStartedAt   = now;
            instance.PendingTargetLevel = outcome;
            instance.UpdatedAt          = now;

            if (outcome == 0)
            {
                instance.Status             = "destroyed";
                instance.DestroyedAt        = now;
                instance.PendingTargetLevel = null;

                _db.UpgradeAttemptLogs.Add(new UpgradeAttemptLog
                {
                    InstanceId             = instance.Id,
                    OwnerAccountId         = userId,
                    CardId                 = instance.CardId,
                    FromLevel              = 0,
                    ToLevel                = 0,
                    Result                 = "fail",
                    SuccessProbabilityUsed = (decimal)GradingOutcomeWeights.First(w => w.Level == 0).Weight,
                    RolledAt               = now,
                    ResolvedAt             = now,
                });

                await _db.SaveChangesAsync();
                _logger.LogInformation("Upgrade fallido: Instance={InstanceId}, User={UserId} — carta destruida", instance.Id, userId);
                return instance;
            }

            instance.PaymentAmountDue = UpgradeCostFor(card.Rarity, outcome);

            if (outcome == ArtMilestoneLevel)
            {
                // Espera al arte, no al reloj. PaymentDeadlineAt queda en null a
                // propósito: la ventana de pago recién arranca cuando la ilustración
                // está subida, si no el jugador perdería la carta esperando algo que
                // depende del dueño, no de él.
                instance.Status = "grading_in_progress";

                var alreadyRequested = await _db.CardLevelArts
                    .AnyAsync(a => a.CardId == instance.CardId && a.Level == ArtMilestoneLevel);

                if (!alreadyRequested)
                {
                    _db.CardLevelArts.Add(new CardLevelArt
                    {
                        CardId      = instance.CardId,
                        Level       = ArtMilestoneLevel,
                        Status      = "pending",
                        RequestedAt = now,
                    });
                }

                await _db.SaveChangesAsync();
                _logger.LogWarning(
                    "¡NIVEL 10! Instance={InstanceId}, User={UserId}, Card={CardId} — esperando ilustración para completarse",
                    instance.Id, userId, instance.CardId);
                return instance;
            }

            instance.Status            = "frozen_pending_payment";
            instance.PaymentDeadlineAt = now.AddHours(UpgradePaymentWindowHours);

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Upgrade exitoso, esperando pago: Instance={InstanceId}, User={UserId}, Nivel={Level}",
                instance.Id, userId, outcome);

            return instance;
        }

        /// <summary>
        /// La ilustración de nivel 10 ya está subida: todas las cartas de ese diseño que
        /// estaban esperándola pasan a poder pagarse, con su ventana de 24h arrancando
        /// recién ahora. Lo llama el endpoint de subida de arte.
        /// </summary>
        /// <returns>Cuántas instancias se destrabaron.</returns>
        public async Task<int> ReleaseArtWaitersAsync(Guid cardId)
        {
            var waiting = await _db.PlayerCardInstances
                .Where(i => i.CardId == cardId
                         && i.Status == "grading_in_progress"
                         && i.PendingTargetLevel == ArtMilestoneLevel)
                .ToListAsync();

            if (waiting.Count == 0) return 0;

            var now = DateTime.UtcNow;
            foreach (var instance in waiting)
            {
                instance.Status            = "frozen_pending_payment";
                instance.PaymentDeadlineAt = now.AddHours(UpgradePaymentWindowHours);
                instance.UpdatedAt         = now;
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Arte de nivel 10 subido para {CardId}: {Count} carta(s) destrabadas y esperando pago",
                cardId, waiting.Count);

            return waiting.Count;
        }

        /// <summary>
        /// Confirma el pago de un gradeo que ya salio con nivel. Si no paga a tiempo,
        /// <see cref="ExpireIfNeededAsync"/> se encarga de destruirla en el proximo
        /// toque — acá solo se paga dentro de la ventana.
        /// </summary>
        public async Task<PlayerCardInstance> PayUpgradeAsync(long userId, long instanceId)
        {
            var instance = await GetOwnedInstanceAsync(userId, instanceId);

            if (instance.Status != "frozen_pending_payment" || instance.PendingTargetLevel == null || instance.PaymentAmountDue == null)
                throw new InvalidOperationException("Esta carta no tiene un upgrade pendiente de pago");

            var toLevel = instance.PendingTargetLevel.Value;
            var cost = instance.PaymentAmountDue.Value;

            await _coinService.SpendCoinsAsync(
                userId, cost, "tcg_upgrade_payment",
                $"Upgrade a nivel {toLevel} (carta {instance.CardId})");

            var now = DateTime.UtcNow;

            instance.Level               = toLevel;
            instance.Status              = "active";
            instance.PendingTargetLevel  = null;
            instance.PaymentAmountDue    = null;
            instance.PaymentDeadlineAt   = null;
            instance.UpdatedAt           = now;

            // El valor sale de rareza x grado, sin sumar lo que se pagó (ver comentario
            // en GradeValueMultiplier). El jugador lo ve recién acá, después de pagar.
            var rarity = await _db.Cards
                .Where(c => c.Id == instance.CardId)
                .Select(c => c.Rarity)
                .FirstOrDefaultAsync();

            instance.CatalogValue = CatalogValueFor(instance.Origin, rarity ?? "N", toLevel);

            _db.UpgradeAttemptLogs.Add(new UpgradeAttemptLog
            {
                InstanceId             = instance.Id,
                OwnerAccountId         = userId,
                CardId                 = instance.CardId,
                FromLevel               = 0,
                ToLevel                 = toLevel,
                Result                  = "success_paid",
                SuccessProbabilityUsed  = (decimal)GradingOutcomeWeights.First(w => w.Level == toLevel).Weight,
                CostCharged             = cost,
                RolledAt                = instance.UpdatedAt,
                ResolvedAt              = now,
            });

            // El pendiente de arte para milestones ya se disparó en AttemptUpgradeAsync
            // (al momento de la tirada, no acá) — le da al dueño las 24h de gradeo
            // completas como margen, no recién ahora que el jugador ya está pagando.

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Upgrade pagado y confirmado: Instance={InstanceId}, User={UserId}, Nivel {ToLevel}",
                instance.Id, userId, toLevel);

            return instance;
        }

        // Sin tabla propia usa PullWeights (los sobres). El claim pasa la suya, mucho
        // mas aplastada hacia rareza baja (plan seccion 4.2).
        private static string RollWeightedAmong(
            string[] rarities, Random random, IReadOnlyDictionary<string, double>? customWeights = null)
        {
            var weights = customWeights != null
                ? rarities.Where(customWeights.ContainsKey).Select(r => (Rarity: r, Weight: customWeights[r])).ToArray()
                : PullWeights.Where(w => rarities.Contains(w.Rarity)).ToArray();

            var total = weights.Sum(w => w.Weight);
            var roll    = random.NextDouble() * total;
            double cumulative = 0;
            foreach (var (rarity, weight) in weights)
            {
                cumulative += weight;
                if (roll <= cumulative) return rarity;
            }
            return weights[^1].Rarity;
        }

        // Valor base = RarityMultiplier x10 — mismos multiplicadores que la tabla de
        // costos de upgrade (plan seccion 6.3/6.5), una sola fuente de numeros.
        private static int BaseValueForRarity(string rarity) =>
            (RarityMultiplier.TryGetValue(rarity, out var mult) ? mult : 1) * 10;
    }
}
