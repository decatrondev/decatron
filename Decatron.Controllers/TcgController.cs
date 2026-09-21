using System.Security.Claims;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Decatron.Controllers
{
    // TCG de cards coleccionables — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md
    // 100% dashboard, nunca comandos de chat (decision de diseno, seccion 1 del plan).
    [ApiController]
    [Route("api/tcg")]
    [Authorize]
    [Decatron.Attributes.TcgAccessExceptionFilter]
    public class TcgController : ControllerBase
    {
        private readonly TcgCardsService _tcgService;
        private readonly TcgImageSigningService _imageSigner;
        private readonly DecatronDbContext _db;
        private readonly IConfiguration _configuration;
        private readonly ILogger<TcgController> _logger;
        private readonly IPermissionService _permissions;

        public TcgController(
            TcgCardsService tcgService, TcgImageSigningService imageSigner, DecatronDbContext db,
            IConfiguration configuration, ILogger<TcgController> logger,
            IPermissionService permissions)
        {
            _tcgService    = tcgService;
            _imageSigner   = imageSigner;
            _db            = db;
            _configuration = configuration;
            _logger        = logger;
            _permissions   = permissions;
        }

        // ─── GET /api/tcg/context ────────────────────────────────────────────────
        // Sobre qué colección se está trabajando. El frontend lo necesita para avisar
        // cuando no es la propia: gastar coins ajenos por error no tiene vuelta atrás.

        [HttpGet("context")]
        public async Task<IActionResult> GetContext()
        {
            var ownId    = await GetOwnAccountIdAsync();
            var targetId = await GetAccountOwnerIdAsync();

            var login = await _db.Users.Where(u => u.Id == targetId).Select(u => u.Login).FirstOrDefaultAsync();

            return Ok(new { login, isOwn = targetId == ownId });
        }

        // ─── GET /api/tcg/sobres ────────────────────────────────────────────────

        [HttpGet("sobres")]
        public async Task<IActionResult> GetSobres()
        {
            var tiers = await _tcgService.GetActiveSobreTiersAsync();
            return Ok(tiers.Select(t => new
            {
                id                     = t.Id,
                name                   = t.Name,
                cardCount              = t.CardCount,
                priceCoins             = t.PriceCoins,
                guaranteedFloorRarity  = t.GuaranteedFloorRarity,
            }));
        }

        // ─── GET /api/tcg/dex ────────────────────────────────────────────────────
        // Catalogo completo del juego, pagineado. El arte SOLO se manda para cartas
        // que el jugador ya tiene — plan seccion 11 (la API es privada, nunca se
        // exponen todas las imagenes para que no se pueda scrapear el catalogo
        // completo enumerando ids). Las no obtenidas se marcan como "sin descubrir",
        // sin imageUrl.

        [HttpGet("dex")]
        public async Task<IActionResult> GetDex(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 30,
            [FromQuery] string? rarity = null,
            [FromQuery] string? owned = null, // "true" | "false" | null (todas)
            [FromQuery] string? search = null)
        {
            var userId = await GetAccountOwnerIdAsync();

            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 60);

            var ownedCardIds = await _db.PlayerCardInstances
                .Where(i => i.OwnerAccountId == userId && i.Status != "destroyed")
                .Select(i => i.CardId)
                .Distinct()
                .ToListAsync();
            var ownedSet = ownedCardIds.ToHashSet();

            var query = _db.Cards.AsQueryable();
            if (!string.IsNullOrWhiteSpace(rarity))
                query = query.Where(c => c.Rarity == rarity);
            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(c => EF.Functions.ILike(c.Name, $"%{search}%"));
            if (owned == "true")
                query = query.Where(c => ownedCardIds.Contains(c.Id));
            else if (owned == "false")
                query = query.Where(c => !ownedCardIds.Contains(c.Id));

            var totalCount = await query.CountAsync();
            var totalCards = await _db.Cards.CountAsync();

            var cards = await query
                .OrderBy(c => c.Rarity).ThenBy(c => c.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var payload = new List<object>();
            foreach (var c in cards)
            {
                var isOwned = ownedSet.Contains(c.Id);
                payload.Add(new
                {
                    cardId    = c.Id,
                    name      = isOwned ? c.Name : null,
                    rarity    = c.Rarity,
                    element   = isOwned ? c.Element : null,
                    cardClass = isOwned ? c.Class : null,
                    animated  = isOwned && c.Animated,
                    owned     = isOwned,
                    imageUrl  = isOwned ? await ResolveImageUrlAsync(c.Id, 0) : null,
                });
            }

            return Ok(new { items = payload, totalCount, totalCards, ownedCount = ownedSet.Count, page, pageSize });
        }

        // ─── POST /api/tcg/sobres/{id}/buy ──────────────────────────────────────
        // Cobra y deja los sobres en el inventario SIN abrirlos. Abrir es otra accion
        // (POST sobres/{id}/open), en otra vista.

        [HttpPost("sobres/{id:int}/buy")]
        public async Task<IActionResult> BuySobre(int id, [FromBody] BuySobreRequest? request)
        {
            var userId = await GetAccountOwnerIdAsync();
            var quantity = request?.Quantity ?? 1;

            try
            {
                var packs = await _tcgService.BuyPacksAsync(userId, id, quantity);
                var uc = await _db.UserCoins.FirstOrDefaultAsync(x => x.UserId == userId);
                return Ok(new { success = true, newBalance = uc?.Balance ?? 0, purchased = packs.Count });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error buying sobre {Id}", id);
                return StatusCode(500, new { error = "Error interno al comprar el sobre" });
            }
        }

        public class BuySobreRequest
        {
            public int Quantity { get; set; } = 1;
        }

        // ─── GET /api/tcg/packs ──────────────────────────────────────────────────
        // Los sobres sin abrir del jugador, agrupados por tier.

        [HttpGet("packs")]
        public async Task<IActionResult> GetPacks()
        {
            var userId = await GetAccountOwnerIdAsync();
            var inventory = await _tcgService.GetPackInventoryAsync(userId);

            return Ok(inventory.Select(x => new
            {
                sobreTierId           = x.Tier.Id,
                name                  = x.Tier.Name,
                cardCount             = x.Tier.CardCount,
                guaranteedFloorRarity = x.Tier.GuaranteedFloorRarity,
                isFree                = x.IsFree,
                count                 = x.Count,
            }));
        }

        // ─── GET /api/tcg/free-packs ─────────────────────────────────────────────
        // Los sobres que se pueden reclamar gratis y cuando vuelve a tocar cada uno.
        // Los cooldowns son independientes entre tiers y salen de card_sobre_tiers.

        [HttpGet("free-packs")]
        public async Task<IActionResult> GetFreePacks()
        {
            var userId = await GetAccountOwnerIdAsync();
            var status = await _tcgService.GetFreePackStatusAsync(userId);

            return Ok(status.Select(x => new
            {
                sobreTierId   = x.Tier.Id,
                name          = x.Tier.Name,
                cardCount     = x.Tier.CardCount,
                cooldownHours = x.CooldownHours,
                available     = x.AvailableAt == null,
                availableAt   = AsUtc(x.AvailableAt),
            }));
        }

        // ─── POST /api/tcg/sobres/{id}/claim-free ────────────────────────────────

        [HttpPost("sobres/{id:int}/claim-free")]
        public async Task<IActionResult> ClaimFreeSobre(int id)
        {
            var userId = await GetAccountOwnerIdAsync();

            try
            {
                var pack = await _tcgService.ClaimFreePackAsync(userId, id);
                return Ok(new { success = true, sobreTierId = pack.SobreTierId });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error claiming free sobre {Id}", id);
                return StatusCode(500, new { error = "Error interno al reclamar el sobre gratis" });
            }
        }

        // ─── POST /api/tcg/sobres/{id}/open ─────────────────────────────────────
        // Consume un sobre del inventario. No cobra: ya se pago al comprarlo.

        [HttpPost("sobres/{id:int}/open")]
        public async Task<IActionResult> OpenSobre(int id, [FromQuery] bool isFree = false)
        {
            var userId = await GetAccountOwnerIdAsync();

            try
            {
                var (_, instances) = await _tcgService.OpenPackAsync(userId, id, isFree);

                var cardIds = instances.Select(i => i.CardId).ToList();
                var cardsById = await _db.Cards
                    .Where(c => cardIds.Contains(c.Id))
                    .ToDictionaryAsync(c => c.Id, c => new { c.Name, c.Rarity, c.Element, c.Class, c.Gender, c.Animated });

                // Cuantos quedan de ESTE stack (mismo tier y misma condicion): el overlay
                // ofrece "abrir otro", y ofrecer uno pago cuando lo que queda es gratis
                // —o al reves— abriria algo distinto de lo que el jugador pidio.
                var remainingPacks = await _db.PlayerPackInventories
                    .CountAsync(p => p.OwnerAccountId == userId && p.SobreTierId == id && p.IsFree == isFree);

                var cardsPayload = new List<object>();
                foreach (var i in instances)
                {
                    cardsById.TryGetValue(i.CardId, out var c);
                    cardsPayload.Add(new
                    {
                        instanceId   = i.Id,
                        cardId       = i.CardId,
                        level        = i.Level,
                        origin       = i.Origin,
                        catalogValue = i.CatalogValue,
                        name         = c?.Name,
                        rarity       = c?.Rarity,
                        element      = c?.Element,
                        cardClass    = c?.Class,
                        gender       = c?.Gender,
                        animated     = c?.Animated ?? false,
                        imageUrl     = await ResolveImageUrlAsync(i.CardId, i.Level),
                    });
                }

                return Ok(new { success = true, remainingPacks, cards = cardsPayload });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error opening sobre {Id} for user", id);
                return StatusCode(500, new { error = "Error interno al abrir el sobre" });
            }
        }

        // ─── GET /api/tcg/claim ──────────────────────────────────────────────────
        // Estado del claim gratis: si esta disponible, y si no, desde cuando.

        [HttpGet("claim")]
        public async Task<IActionResult> GetClaimStatus()
        {
            var availableAt = await _tcgService.GetClaimAvailableAtAsync(await GetAccountOwnerIdAsync());
            return Ok(new { available = availableAt == null, availableAt = AsUtc(availableAt) });
        }

        // ─── POST /api/tcg/claim ─────────────────────────────────────────────────

        [HttpPost("claim")]
        public async Task<IActionResult> Claim()
        {
            var userId = await GetAccountOwnerIdAsync();
            try
            {
                var instance = await _tcgService.ClaimFreeCardAsync(userId);
                var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == instance.CardId);

                return Ok(new
                {
                    success = true,
                    card = new
                    {
                        instanceId   = instance.Id,
                        cardId       = instance.CardId,
                        level        = instance.Level,
                        origin       = instance.Origin,
                        catalogValue = instance.CatalogValue,
                        name         = card?.Name,
                        rarity       = card?.Rarity,
                        element      = card?.Element,
                        cardClass    = card?.Class,
                        gender       = card?.Gender,
                        animated     = card?.Animated ?? false,
                        imageUrl     = await ResolveImageUrlAsync(instance.CardId, instance.Level),
                    },
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error claiming free card for user {UserId}", userId);
                return StatusCode(500, new { error = "Error interno al reclamar la carta" });
            }
        }

        // ─── GET /api/tcg/balance ────────────────────────────────────────────────
        // El saldo de la cuenta sobre la que opera el TCG, que no siempre es la propia.
        //
        // Existe separado de /api/coins/balance a propósito: ese es la billetera de la
        // persona (donde entra lo que compra con tarjeta, con comprobante a su nombre) y
        // NUNCA debe seguir el canal activo. Este es "de qué saldo sale lo que gaste acá".
        // Mostrar el propio mientras se gasta el ajeno daba "Balance insuficiente" sin
        // explicación posible.

        [HttpGet("balance")]
        public async Task<IActionResult> GetTcgBalance()
        {
            var userId = await GetAccountOwnerIdAsync();
            var uc = await _db.UserCoins.FirstOrDefaultAsync(x => x.UserId == userId);
            return Ok(new { balance = uc?.Balance ?? 0 });
        }

        // ─── GET /api/tcg/filters ────────────────────────────────────────────────
        // Valores posibles de elemento y clase. Salen de la tabla `cards`, que la llena
        // el lado de generación: hardcodearlos en el frontend los dejaría desactualizados
        // en cuanto agreguen uno nuevo.

        [HttpGet("filters")]
        public async Task<IActionResult> GetFilters()
        {
            var elements = await _db.Cards
                .Where(c => c.Element != null && c.Element != "")
                .Select(c => c.Element).Distinct().OrderBy(e => e).ToListAsync();

            var classes = await _db.Cards
                .Where(c => c.Class != null && c.Class != "")
                .Select(c => c.Class).Distinct().OrderBy(c => c).ToListAsync();

            return Ok(new { elements, classes });
        }

        // ─── GET /api/tcg/stats ──────────────────────────────────────────────────
        // Resumen de la colección del jugador.

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var userId = await GetAccountOwnerIdAsync();
            await _tcgService.ResolveDueUpgradesForUserAsync(userId);

            var owned =
                from i in _db.PlayerCardInstances
                join c in _db.Cards on i.CardId equals c.Id
                where i.OwnerAccountId == userId && i.Status != "destroyed"
                select new { i.CatalogValue, i.Level, i.Origin, i.CardId, c.Rarity, c.Element };

            var totalCards    = await owned.CountAsync();
            var totalValue    = await owned.SumAsync(x => (long)x.CatalogValue);
            var distinctCards = await owned.Select(x => x.CardId).Distinct().CountAsync();
            var totalInGame   = await _db.Cards.CountAsync();

            var byRarity = await owned
                .GroupBy(x => x.Rarity)
                .Select(g => new { rarity = g.Key, count = g.Count(), value = g.Sum(x => (long)x.CatalogValue) })
                .ToListAsync();

            var byGrade = await owned
                .Where(x => x.Level > 0)
                .GroupBy(x => x.Level)
                .Select(g => new { grade = g.Key, count = g.Count() })
                .OrderBy(g => g.grade)
                .ToListAsync();

            var byElement = await owned
                .GroupBy(x => x.Element)
                .Select(g => new { element = g.Key, count = g.Count() })
                .OrderByDescending(g => g.count)
                .ToListAsync();

            // Historial de gradeos. Es el "cuánto gastó realmente" que el plan (6.5)
            // pide llevar aparte del valor de catálogo, justamente para que el valor no
            // sea un reflejo del gasto.
            var attempts = _db.UpgradeAttemptLogs.Where(l => l.OwnerAccountId == userId);
            var gradeStats = new
            {
                total     = await attempts.CountAsync(),
                exitosos  = await attempts.CountAsync(l => l.Result == "success_paid"),
                fallidos  = await attempts.CountAsync(l => l.Result == "fail"),
                vencidos  = await attempts.CountAsync(l => l.Result == "success_expired_unpaid"),
                gastado   = await attempts.Where(l => l.CostCharged != null).SumAsync(l => (long)l.CostCharged!.Value),
            };

            var best = await owned
                .OrderByDescending(x => x.CatalogValue)
                .Select(x => new { x.CardId, x.Level, x.Rarity, x.CatalogValue })
                .FirstOrDefaultAsync();

            object? bestCard = null;
            if (best != null)
            {
                var name = await _db.Cards.Where(c => c.Id == best.CardId).Select(c => c.Name).FirstOrDefaultAsync();
                bestCard = new
                {
                    name,
                    rarity       = best.Rarity,
                    level        = best.Level,
                    catalogValue = best.CatalogValue,
                    imageUrl     = await ResolveImageUrlAsync(best.CardId, best.Level),
                };
            }

            var unopenedPacks = await _db.PlayerPackInventories.CountAsync(p => p.OwnerAccountId == userId);

            return Ok(new
            {
                totalCards,
                totalValue,
                distinctCards,
                totalInGame,
                unopenedPacks,
                claimedCards = await owned.CountAsync(x => x.Origin == "claimed"),
                gradedCards  = await owned.CountAsync(x => x.Level > 0),
                byRarity,
                byGrade,
                byElement,
                gradeStats,
                bestCard,
            });
        }

        // ─── GET /api/tcg/collection ─────────────────────────────────────────────
        // Pagineada + filtros server-side (rareza/estado/busqueda por nombre) — antes
        // devolvia toda la coleccion de una, lo que ademas de no escalar disparaba
        // cientos de <img> en paralelo (ver comentario en TcgImageSigningService).

        [HttpGet("collection")]
        public async Task<IActionResult> GetCollection(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 24,
            [FromQuery] string? rarity = null,
            [FromQuery] string? status = null,
            [FromQuery] string? search = null,
            [FromQuery] short? grade = null,
            [FromQuery] string? element = null,
            [FromQuery] string? cardClass = null,
            [FromQuery] string? origin = null,
            [FromQuery] bool? animated = null,
            [FromQuery] string? sort = null)
        {
            var userId = await GetAccountOwnerIdAsync();

            // Cualquier upgrade que vencio sin pagarse se destruye acá antes de listar
            // — así el jugador nunca ve una carta "congelada" que en realidad ya perdió.
            await _tcgService.ResolveDueUpgradesForUserAsync(userId);

            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 60);

            var query =
                from i in _db.PlayerCardInstances
                join c in _db.Cards on i.CardId equals c.Id
                where i.OwnerAccountId == userId && i.Status != "destroyed"
                select new { Instance = i, Card = c };

            if (!string.IsNullOrWhiteSpace(rarity))
                query = query.Where(x => x.Card.Rarity == rarity);
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(x => x.Instance.Status == status);
            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(x => EF.Functions.ILike(x.Card.Name, $"%{search}%"));
            if (grade != null)
                query = query.Where(x => x.Instance.Level == grade);
            if (!string.IsNullOrWhiteSpace(element))
                query = query.Where(x => x.Card.Element == element);
            if (!string.IsNullOrWhiteSpace(cardClass))
                query = query.Where(x => x.Card.Class == cardClass);
            if (!string.IsNullOrWhiteSpace(origin))
                query = query.Where(x => x.Instance.Origin == origin);
            if (animated != null)
                query = query.Where(x => x.Card.Animated == animated);

            var totalCount = await query.CountAsync();

            // El orden por rareza no puede ser alfabético (dejaría LR antes que N): se
            // mapea a la posición real en la escala.
            var ordered = sort switch
            {
                "value_desc"  => query.OrderByDescending(x => x.Instance.CatalogValue),
                "value_asc"   => query.OrderBy(x => x.Instance.CatalogValue),
                "grade_desc"  => query.OrderByDescending(x => x.Instance.Level).ThenByDescending(x => x.Instance.CatalogValue),
                "name_asc"    => query.OrderBy(x => x.Card.Name),
                "oldest"      => query.OrderBy(x => x.Instance.AcquiredAt),
                "rarity_desc" => query.OrderByDescending(x =>
                                    x.Card.Rarity == "MR" ? 7 : x.Card.Rarity == "LR" ? 6 : x.Card.Rarity == "UR" ? 5
                                  : x.Card.Rarity == "SSR" ? 4 : x.Card.Rarity == "SR" ? 3 : x.Card.Rarity == "R" ? 2 : 1)
                                 .ThenByDescending(x => x.Instance.Level),
                _             => query.OrderByDescending(x => x.Instance.AcquiredAt),
            };

            var rows = await ordered
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var payload = new List<object>();
            foreach (var x in rows)
            {
                payload.Add(new
                {
                    instanceId          = x.Instance.Id,
                    cardId              = x.Instance.CardId,
                    level               = x.Instance.Level,
                    origin              = x.Instance.Origin,
                    catalogValue        = x.Instance.CatalogValue,
                    status              = x.Instance.Status,
                    acquiredAt          = AsUtc(x.Instance.AcquiredAt),
                    upgradeUsed         = x.Instance.UpgradeUsed,
                    attemptStartedAt    = AsUtc(x.Instance.AttemptStartedAt),
                    pendingTargetLevel  = x.Instance.PendingTargetLevel,
                    paymentAmountDue    = x.Instance.PaymentAmountDue,
                    paymentDeadlineAt   = AsUtc(x.Instance.PaymentDeadlineAt),
                    name                = x.Card.Name,
                    rarity              = x.Card.Rarity,
                    imageUrl            = await ResolveImageUrlAsync(x.Instance.CardId, x.Instance.Level),
                });
            }

            return Ok(new { items = payload, totalCount, page, pageSize });
        }

        // ─── GET /api/tcg/collection/{instanceId} ────────────────────────────────
        // Detalle de una carta puntual — arte grande + historial de upgrade. Solo el
        // dueño de la carta puede verla.

        [HttpGet("collection/{instanceId:long}")]
        public async Task<IActionResult> GetCollectionCard(long instanceId)
        {
            var userId = await GetAccountOwnerIdAsync();

            await _tcgService.ResolveDueUpgradesForUserAsync(userId);

            var instance = await _db.PlayerCardInstances
                .FirstOrDefaultAsync(i => i.Id == instanceId && i.OwnerAccountId == userId && i.Status != "destroyed");
            if (instance == null)
                return NotFound(new { error = "Carta no encontrada" });

            var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == instance.CardId);

            var history = await _db.UpgradeAttemptLogs
                .Where(l => l.InstanceId == instanceId)
                .OrderByDescending(l => l.RolledAt)
                .Select(l => new
                {
                    fromLevel   = l.FromLevel,
                    toLevel     = l.ToLevel,
                    result      = l.Result,
                    costCharged = l.CostCharged,
                    rolledAt    = AsUtc(l.RolledAt),
                    resolvedAt  = AsUtc(l.ResolvedAt),
                })
                .ToListAsync();

            return Ok(new
            {
                instanceId          = instance.Id,
                cardId               = instance.CardId,
                level                = instance.Level,
                origin               = instance.Origin,
                catalogValue         = instance.CatalogValue,
                status               = instance.Status,
                acquiredAt           = AsUtc(instance.AcquiredAt),
                upgradeUsed          = instance.UpgradeUsed,
                attemptStartedAt     = AsUtc(instance.AttemptStartedAt),
                pendingTargetLevel   = instance.PendingTargetLevel,
                paymentAmountDue     = instance.PaymentAmountDue,
                paymentDeadlineAt    = AsUtc(instance.PaymentDeadlineAt),
                // A propósito NO se manda en cuánto quedaría el valor: se revela recién
                // después de pagar. Ver comentario en GradeValueMultiplier.
                name                 = card?.Name,
                rarity               = card?.Rarity,
                element              = card?.Element,
                cardClass            = card?.Class,
                gender               = card?.Gender,
                animated             = card?.Animated ?? false,
                story                = card?.Story,
                personality          = card?.Personality,
                hp                   = card?.Hp,
                atk                  = card?.Atk,
                def                  = card?.Def,
                spd                  = card?.Spd,
                imageUrl             = await ResolveImageUrlAsync(instance.CardId, instance.Level),
                history,
            });
        }

        // ─── POST /api/tcg/cards/{instanceId}/upgrade/attempt ───────────────────

        [HttpPost("cards/{instanceId:long}/upgrade/attempt")]
        public async Task<IActionResult> AttemptUpgrade(long instanceId)
        {
            var userId = await GetAccountOwnerIdAsync();
            try
            {
                var instance = await _tcgService.AttemptUpgradeAsync(userId, instanceId);
                return Ok(new
                {
                    success           = true,
                    status            = instance.Status,
                    attemptStartedAt  = AsUtc(instance.AttemptStartedAt),
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error attempting upgrade for instance {Id}", instanceId);
                return StatusCode(500, new { error = "Error interno al intentar el upgrade" });
            }
        }

        // ─── POST /api/tcg/cards/{instanceId}/upgrade/pay ────────────────────────

        [HttpPost("cards/{instanceId:long}/upgrade/pay")]
        public async Task<IActionResult> PayUpgrade(long instanceId)
        {
            var userId = await GetAccountOwnerIdAsync();
            try
            {
                var instance = await _tcgService.PayUpgradeAsync(userId, instanceId);
                var uc = await _db.UserCoins.FirstOrDefaultAsync(x => x.UserId == userId);
                return Ok(new
                {
                    success      = true,
                    level        = instance.Level,
                    status       = instance.Status,
                    // Acá se revela: es el primer momento en que el jugador lo sabe.
                    catalogValue = instance.CatalogValue,
                    newBalance   = uc?.Balance ?? 0,
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error paying upgrade for instance {Id}", instanceId);
                return StatusCode(500, new { error = "Error interno al pagar el upgrade" });
            }
        }

        // ─── GET /api/tcg/admin/upgrades-in-progress ─────────────────────────────
        //
        // Tabla de monitoreo para el dueño (plan seccion 6) — todo lo que esta "en
        // gradeo" o esperando pago, de cualquier jugador. Es solo para mirar: el
        // sistema resuelve todo solo, esto no dispara ninguna accion.

        [HttpGet("admin/upgrades-in-progress")]
        [Decatron.Attributes.RequireSystemOwner]
        public async Task<IActionResult> GetUpgradesInProgress()
        {
            // Sin esto, un gradeo/pago vencido se queda "trabado" hasta que el dueño
            // de esa carta vuelve a entrar a su colección — el admin nunca vería el
            // resultado final si el jugador no se logueaba. Se resuelve todo lo que
            // ya cumplió su plazo, para cualquier jugador, antes de armar la tabla.
            await _tcgService.ResolveAllDueUpgradesAsync();

            var instances = await _db.PlayerCardInstances
                .Where(i => i.Status == "grading_in_progress" || i.Status == "frozen_pending_payment")
                .OrderBy(i => i.Status == "grading_in_progress" ? i.AttemptStartedAt : i.PaymentDeadlineAt)
                .ToListAsync();

            var cardIds = instances.Select(i => i.CardId).Distinct().ToList();
            var cardsById = await _db.Cards
                .Where(c => cardIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => new { c.Name, c.Rarity });

            var userIds = instances.Select(i => i.OwnerAccountId).Distinct().ToList();
            var usersById = await _db.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Login);

            var inProgress = instances.Select(i =>
            {
                cardsById.TryGetValue(i.CardId, out var c);
                usersById.TryGetValue(i.OwnerAccountId, out var login);
                return new
                {
                    instanceId         = i.Id,
                    ownerLogin         = login ?? $"#{i.OwnerAccountId}",
                    cardName           = c?.Name,
                    cardRarity         = c?.Rarity,
                    status             = i.Status,
                    attemptStartedAt   = AsUtc(i.AttemptStartedAt),
                    pendingTargetLevel = i.PendingTargetLevel,
                    paymentAmountDue   = i.PaymentAmountDue,
                    paymentDeadlineAt  = AsUtc(i.PaymentDeadlineAt),
                };
            });

            // Resultados ya resueltos (recientes) — para que el resultado final se
            // vea acá apenas se resuelve, en vez de simplemente desaparecer de la
            // lista de arriba sin dejar rastro visible.
            var recentLogs = await _db.UpgradeAttemptLogs
                .OrderByDescending(l => l.ResolvedAt)
                .Take(30)
                .ToListAsync();

            var logCardIds = recentLogs.Select(l => l.CardId).Distinct().ToList();
            var logCardsById = await _db.Cards
                .Where(c => logCardIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => new { c.Name, c.Rarity });

            var logUserIds = recentLogs.Select(l => l.OwnerAccountId).Distinct().ToList();
            var logUsersById = await _db.Users
                .Where(u => logUserIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Login);

            var recentResults = recentLogs.Select(l =>
            {
                logCardsById.TryGetValue(l.CardId, out var c);
                logUsersById.TryGetValue(l.OwnerAccountId, out var login);
                return new
                {
                    ownerLogin  = login ?? $"#{l.OwnerAccountId}",
                    cardName    = c?.Name,
                    cardRarity  = c?.Rarity,
                    result      = l.Result,
                    level       = l.ToLevel,
                    costCharged = l.CostCharged,
                    resolvedAt  = AsUtc(l.ResolvedAt),
                };
            });

            return Ok(new { inProgress, recentResults });
        }

        // ─── GET /api/tcg/admin/art-queue ────────────────────────────────────────
        //
        // Cola de arte de upgrade pendiente (plan seccion 7) — solo niveles milestone
        // (3/6/9). Trae los datos de generacion originales de la carta base (prompt,
        // negative_prompt, seed, lora_used) para que el flujo de ComfyUI parta de ahi.

        [HttpGet("admin/art-queue")]
        [Decatron.Attributes.RequireSystemOwner]
        public async Task<IActionResult> GetArtQueue()
        {
            var pending = await _db.CardLevelArts
                .Where(a => a.Status != "done")
                .OrderBy(a => a.RequestedAt)
                .ToListAsync();

            var cardIds = pending.Select(a => a.CardId).Distinct().ToList();
            var cardsById = await _db.Cards
                .Where(c => cardIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c);

            var payload = new List<object>();
            foreach (var a in pending)
            {
                cardsById.TryGetValue(a.CardId, out var c);
                // Sin prompts ni seeds: la generación se hace por fuera, no desde acá.
                // Lo único que hace falta para trabajar es saber QUÉ carta es y cómo se
                // ve hoy, para que el arte nuevo sea el mismo personaje evolucionado.
                payload.Add(new
                {
                    id                = a.Id,
                    cardId            = a.CardId,
                    level             = a.Level,
                    status            = a.Status,
                    requestedAt       = AsUtc(a.RequestedAt),
                    cardName          = c?.Name,
                    cardRarity        = c?.Rarity,
                    cardElement       = c?.Element,
                    cardClass         = c?.Class,
                    referenceImageUrl = await ResolveImageUrlAsync(a.CardId, 0),
                    // Cuántos jugadores están esperando esta ilustración para poder
                    // confirmar su grado 10.
                    waitingPlayers    = await _db.PlayerCardInstances.CountAsync(i =>
                        i.CardId == a.CardId && i.Status == "grading_in_progress" && i.PendingTargetLevel == 10),
                });
            }

            return Ok(payload);
        }

        // ─── POST /api/tcg/admin/art-queue/{id}/upload ───────────────────────────

        // [FromForm] + [Consumes] son obligatorios acá: con [ApiController], un parámetro
        // complejo se asume [FromBody] (JSON), así que un multipart/form-data se rechaza
        // con 415 antes de llegar al método.
        [HttpPost("admin/art-queue/{id:long}/upload")]
        [Decatron.Attributes.RequireSystemOwner]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadArt(long id, [FromForm] IFormFile file)
        {
            var entry = await _db.CardLevelArts.FirstOrDefaultAsync(a => a.Id == id);
            if (entry == null)
                return NotFound(new { error = "No se encontró ese pendiente de arte" });

            if (file == null || file.Length == 0)
                return BadRequest(new { error = "Archivo vacío" });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".webp" && ext != ".png" && ext != ".gif" && ext != ".jpg" && ext != ".jpeg")
                return BadRequest(new { error = "Formato no soportado (webp/png/gif/jpg)" });

            var imagesRoot = _configuration["TcgSettings:ImagesPath"] ?? "/var/www/html/decatron/tcg-card-images";
            var levelsDir  = Path.Combine(imagesRoot, "levels");
            Directory.CreateDirectory(levelsDir);

            // Nombre propio, no el del jugador que lo sube: evita colisiones y
            // caracteres raros en el filesystem.
            var filename = $"{entry.CardId:N}_lvl{entry.Level}{ext}";
            var fullPath = Path.Combine(levelsDir, filename);

            await using (var stream = System.IO.File.Create(fullPath))
                await file.CopyToAsync(stream);

            entry.ImagePath  = filename;
            entry.Status     = "done";
            entry.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            // Subir el arte NO es solo marcar la fila como lista: es lo que completa el
            // upgrade. Las cartas de nivel 10 esperan este archivo, no un reloj, así que
            // acá se destraban y recién ahora arranca su ventana de pago.
            var destrabadas = await _tcgService.ReleaseArtWaitersAsync(entry.CardId);

            _logger.LogInformation(
                "Arte de upgrade subido: CardLevelArt={Id}, Card={CardId}, Level={Level}, Destrabadas={Count}",
                id, entry.CardId, entry.Level, destrabadas);

            return Ok(new { success = true, unlocked = destrabadas });
        }

        // ─── GET /api/tcg/images/{cardId}/{level} ────────────────────────────────
        //
        // Sin [Authorize]: la firma+expiracion ES la autorizacion (mismo principio que
        // una URL prefirmada de S3) — un <img src="..."> del navegador no manda el
        // Bearer token, asi que la puerta tiene que estar en la URL misma, no en un
        // header que esta request no va a traer.

        [HttpGet("images/{cardId:guid}/{level:int}")]
        [AllowAnonymous]
        [EnableRateLimiting("tcg-images")]
        public IActionResult GetImage(Guid cardId, int level, [FromQuery] string f, [FromQuery] long exp, [FromQuery] string sig)
        {
            // Sin consulta a la DB: el filename ya viene resuelto y firmado desde
            // ResolveImageUrlAsync (ver comentario en TcgImageSigningService).
            if (string.IsNullOrEmpty(f) || !_imageSigner.Validate(cardId, (short)level, f, exp, sig))
                return Unauthorized();

            var subfolder = level == 0 ? "base" : "levels";
            var imagesRoot = _configuration["TcgSettings:ImagesPath"] ?? "/var/www/html/decatron/tcg-card-images";
            var physicalPath = Path.Combine(imagesRoot, subfolder, Path.GetFileName(f));
            if (!System.IO.File.Exists(physicalPath))
                return NotFound();

            return PhysicalFile(physicalPath, GetContentType(physicalPath));
        }

        // ─── Helpers ─────────────────────────────────────────────────────────────

        private async Task<string?> ResolveImageUrlAsync(Guid cardId, short level)
        {
            // El arte solo cambia en los milestones (3/6/9) — un nivel intermedio
            // muestra el arte del ultimo milestone alcanzado, no uno propio (plan
            // seccion 7, modelo hibrido validado con el lado de generacion).
            var effectiveLevel = TcgCardsService.EffectiveArtLevel(level);
            var filename = await ResolveFilenameAsync(cardId, effectiveLevel);
            if (filename == null)
                return null; // nivel 0 sin subir todavia, o nivel 1-9 con arte pendiente (plan seccion 7)

            var (expires, sig) = _imageSigner.Sign(cardId, effectiveLevel, filename);
            return $"/api/tcg/images/{cardId}/{effectiveLevel}?f={Uri.EscapeDataString(filename)}&exp={expires}&sig={sig}";
        }

        private async Task<string?> ResolveFilenameAsync(Guid cardId, short level)
        {
            string? relativePath = level == 0
                ? await _db.Cards.Where(c => c.Id == cardId).Select(c => c.ImagePath).FirstOrDefaultAsync()
                : await _db.CardLevelArts
                    .Where(a => a.CardId == cardId && a.Level == level && a.Status == "done")
                    .Select(a => a.ImagePath)
                    .FirstOrDefaultAsync();

            if (string.IsNullOrEmpty(relativePath))
                return null;

            var filename = Path.GetFileName(relativePath);
            var imagesRoot = _configuration["TcgSettings:ImagesPath"] ?? "/var/www/html/decatron/tcg-card-images";
            var subfolder = level == 0 ? "base" : "levels";
            if (!System.IO.File.Exists(Path.Combine(imagesRoot, subfolder, filename)))
                return null;

            return filename;
        }

        private static string GetContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".webp"         => "image/webp",
            ".png"          => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif"          => "image/gif",
            _               => "application/octet-stream",
        };

        // La DB guarda todo en UTC pero Npgsql (modo legacy, config heredada del
        // resto del proyecto) no lo marca como tal — sin esto, el navegador
        // interpreta la fecha como hora local del servidor y descuadra cualquier
        // countdown en la diferencia horaria (Lima = UTC-5).
        private static DateTime? AsUtc(DateTime? dt) => dt.HasValue ? DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc) : null;
        private static DateTime AsUtc(DateTime dt) => DateTime.SpecifyKind(dt, DateTimeKind.Utc);

        /// <summary>Mi propia cuenta, sin mirar el canal activo.</summary>
        private async Task<long> GetOwnAccountIdAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                throw new UnauthorizedAccessException("User ID not found in token");

            return await Decatron.Services.Helpers.AccountResolver.GetAccountOwnerIdAsync(_db, userId);
        }

        /// <summary>
        /// La cuenta sobre la que opera el TCG.
        ///
        /// <para>Normalmente es la propia: entrando por Kick o por Twitch se ve la misma
        /// colección, porque las cartas son de la persona y no de la plataforma (ver
        /// AccountResolver).</para>
        ///
        /// <para>Si hay un canal activo distinto al propio, se opera sobre ESE canal —
        /// pero solo con <c>control_total</c>, el nivel máximo de PermissionService. Los
        /// niveles menores (<c>commands</c>, <c>moderation</c>) no alcanzan: el TCG mueve
        /// DecaCoins comprados con dinero real, así que se exige el permiso que el dueño
        /// del canal da explícitamente para todo.</para>
        ///
        /// <para>El permiso se revalida en CADA request, no se confía en que la sesión
        /// haya sido válida al momento de cambiar de canal: si te lo revocan mientras
        /// estás adentro, dejás de operar en el acto.</para>
        /// </summary>
        private async Task<long> GetAccountOwnerIdAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var userId))
                throw new UnauthorizedAccessException("User ID not found in token");

            var ownAccountId = await Decatron.Services.Helpers.AccountResolver.GetAccountOwnerIdAsync(_db, userId);

            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!long.TryParse(sessionChannelId, out var channelOwnerId))
                return ownAccountId;

            var targetAccountId = await Decatron.Services.Helpers.AccountResolver.GetAccountOwnerIdAsync(_db, channelOwnerId);
            if (targetAccountId == ownAccountId)
                return ownAccountId;

            if (!await _permissions.HasPermissionLevelAsync(userId, channelOwnerId, "control_total"))
                throw new UnauthorizedAccessException("Necesitás control total sobre ese canal para su TCG");

            return targetAccountId;
        }
    }
}
