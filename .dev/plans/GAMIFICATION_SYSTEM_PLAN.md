# DECATRON — Sistema de Gamificación (XP/Niveles/Rangos)

> Plan completo del sistema de gamificación para Discord + Twitch
> Planificado en sesión 2026-04-01
> Referenciado desde DISCORD_INTEGRATION_PLAN.md (Fase 5)

---

## Filosofía

- **Viene listo para usar** con defaults inteligentes — el streamer activa y funciona
- **Todo es configurable** desde el dashboard por el streamer (o usuario con `control_total`)
- Roles admin de Discord (configurables) manejan comandos de XP en el servidor
- **Dos sistemas paralelos**: Server XP (por servidor, configurable) + Global XP (plataforma Decatron)
- **Cross-platform**: Twitch + Discord mismo pool de XP si las cuentas están vinculadas
- **Portal para viewers**: dashboard personal, vistas públicas, login con Twitch o Discord

---

## Tiers de Decatron → Multiplicadores XP

Aplican al **usuario individual** — si eres Fundador, ganas 2x en cualquier servidor.

| Tier | Precio | Multiplicador XP |
|---|---|---|
| Free | $0 | 1x |
| Supporter | $5/mo | 1.25x |
| Premium | $15/mo | 1.5x |
| Fundador | $25/mo o $100 único | 2x |

---

## Dos sistemas de XP paralelos

### Server XP (por servidor de Discord)
- Se gana chateando en ESE servidor / canal de Twitch vinculado
- Cada servidor tiene su propia curva, roles, rewards, leaderboard
- El streamer configura TODO desde el dashboard
- Es el XP principal del día a día

### Global XP (perfil Decatron)
- Suma de toda tu actividad en TODOS los servidores
- Curva más difícil (`150 * nivel^2.2` vs `100 * nivel^2` del server)
- Niveles globales = reputación en la plataforma Decatron
- Desbloquea cosas de la plataforma (badges en perfil, features)
- Lo controla Decatron, NO el streamer

---

## Cross-platform: Twitch + Discord

- Si el usuario tiene cuenta Twitch vinculada, XP suma al mismo pool del servidor
- Incentiva logueo en Decatron
- Un solo perfil de XP: Twitch chat O Discord, todo suma
- `!level` en Twitch muestra texto + link a vista pública del rank
- `/level` en Discord muestra rank card visual
- Notificación de level-up en AMBAS plataformas (Discord embed + Twitch chat)

---

## Curva de niveles — Base editable

**Fórmula base server**: `XP_necesario = 100 * nivel^2`
**Fórmula base global**: `XP_necesario = 150 * nivel^2.2`

| Nivel | XP Server | Aprox. tiempo (actividad normal) |
|---|---|---|
| 5 | 2,500 | ~2 días |
| 10 | 10,000 | ~1 semana |
| 25 | 62,500 | ~1 mes |
| 50 | 250,000 | ~4 meses |
| 75 | 562,500 | ~9 meses |
| 100 | 1,000,000 | ~1.5 años |

El streamer puede:
- Elegir dificultad preset: Fácil (0.7x), Normal (1x), Difícil (1.5x), Hardcore (2x)
- Crear curva custom
- Agregar niveles más allá de 100 (sin límite)
- Nombrar niveles a su gusto
- Ver simulador en dashboard: "Con esta config, nivel 50 toma aprox X días"

---

## Fuentes de XP (base, todo configurable)

| Fuente | XP Base | Configurable |
|---|---|---|
| Mensaje Discord | 15-25 random | Rango min/max, cooldown |
| Mensaje Twitch (cuenta vinculada) | 15-25 random | Rango min/max, cooldown |
| Voice chat activo | 5 XP/min | XP/min, requiere unmuted? |
| Voice con streamer en vivo | 10 XP/min | Activar/desactivar |
| Nuevo follow | 50 | Cantidad |
| Sub Tier 1 | 500 | Cantidad |
| Sub Tier 2 | 1,000 | Cantidad |
| Sub Tier 3 | 2,500 | Cantidad |
| Gift sub | 300 por sub | Cantidad |
| Tip/donación | 100 por dólar | Ratio |
| Raid (ser raideado) | 200 | Cantidad |
| Streak diario (días seguidos) | +50% ese día | Activar/desactivar, bonus % |

---

## Anti-exploit (base, configurable por streamer)

| Protección | Default | Rango configurable |
|---|---|---|
| Cooldown entre mensajes | 60 seg | 30s - 5min |
| Máximo XP por hora | 500 | 200 - 2000 |
| Largo mínimo mensaje | 5 caracteres | 1 - 20 |
| Canales excluidos | #bot-commands | Lista de canales |
| Modo nocturno (más XP en vivo) | Desactivado | On/Off, multiplicador configurable |

**Modo nocturno**: Cuando el streamer está en vivo, XP se multiplica (ej: 1.5x). Offline = 1x. Desactivado por defecto.

---

## Roles automáticos — Acumulables

El bot CREA los roles automáticamente en Discord al activar el sistema.
Los roles se ACUMULAN (no se quitan al subir de nivel).

**Roles base por defecto** (el streamer cambia nombres, colores, niveles, agrega o quita):

| Nivel | Rol | Color |
|---|---|---|
| 1 | Newcomer | #95a5a6 (gris) |
| 5 | Chatter | #2ecc71 (verde claro) |
| 10 | Regular | #27ae60 (verde) |
| 15 | Active | #3498db (azul claro) |
| 20 | Dedicated | #2980b9 (azul) |
| 30 | Veteran | #9b59b6 (morado) |
| 40 | Elite | #f39c12 (dorado) |
| 50 | Legend | #e67e22 (naranja) |
| 65 | Champion | #e74c3c (rojo) |
| 80 | Master | #e91e63 (rosa) |
| 90 | Grandmaster | #00bcd4 (cyan) |
| 100 | Mythic | #ffffff (blanco) |

---

## Permisos — Quién gestiona XP

- Desde la web: usuarios con `control_total`
- En Discord: Admin del servidor + roles con "Manage Server" (default)
- Configurable: el streamer agrega roles específicos que pueden usar comandos admin de XP

---

## Achievements / Badges

Se muestran en la rank card. El streamer puede crear badges custom desde el dashboard.

| Badge | Condición |
|---|---|
| First Message | Primer mensaje en el servidor |
| Chatterbox | 1,000 mensajes |
| Marathon | 10,000 mensajes |
| Subscriber | Se suscribió en Twitch |
| Generous | Donó/tip |
| Voice Warrior | 100 horas en voice |
| Streak Master | 30 días consecutivos |
| Top Monthly | #1 del mes |
| OG | En el servidor desde hace 1 año |
| Linked | Cuenta Twitch + Discord vinculada |

---

## XP Boost temporal

Admins activan con `/xp boost 2x 2h` o desde el dashboard:
- Multiplicadores: 1.5x, 2x, 3x, 5x
- Duración: 30min, 1h, 2h, 4h, 8h, 24h
- Se anuncia en canal configurado: "**XP BOOST ACTIVO!** 2x XP por las próximas 2 horas!"
- Timer visual en el dashboard

---

## Seasonal Leaderboard (mensual)

- El XP y nivel NUNCA se resetean — progreso permanente
- Leaderboard mensual SEPARADO que trackea solo XP ganado ese mes
- El #1 del mes recibe badge "Top [Mes]" + rol temporal especial
- Todos participan automáticamente (es solo un ranking extra, nadie pierde nada)
- El streamer puede dar rewards al top 3 del mes

---

## XP Store (economía del streamer — en XP)

El streamer crea rewards comprables con **XP** desde el dashboard:
- Rol custom temporal (1 semana, 1 mes)
- Color de nombre custom
- Acceso a canal exclusivo
- Shoutout del bot
- Lo que el streamer imagine
- Configurable: nombre, costo en XP, stock, duración
- **Esto NO usa DecaCoins** — es la economía interna de cada servidor

---

## DecaCoins — Economy System (Plan Final)

### Concepto
DecaCoins (nombre provisional, configurable desde admin) es la moneda oficial de Decatron como plataforma. **La vende AnthonyDeca**, no los streamers. Es un negocio aparte de los tiers del bot.

### Flujo de economía
```
AnthonyDeca (admin) → vende paquetes de coins → Streamers/Viewers compran (PayPal)
AnthonyDeca → puede regalar coins a cualquiera (admin tools)
Streamers → pueden dar/sortear coins a viewers en sus servidores
Viewers → gastan coins → compran items del Marketplace (fondos, marcos, badges para rank card)
Usuarios → pueden transferir coins entre sí (con reglas anti-abuso)
Referidos → bonus para quien invita y quien es invitado
```

### Características
- **Balance GLOBAL** (no por servidor) — tus coins te siguen a todos lados
- **Permanentes** — no expiran nunca
- **Separado del XP** — XP es para niveles/roles, coins son para el marketplace
- **Separado de los tiers** — los tiers dan multiplicadores XP y features del bot
- **Transferibles** — entre usuarios, con reglas anti-abuso
- **Nombre configurable** — el admin define el nombre e icono de la moneda desde el panel

### Paquetes de compra (base, CRUD desde admin)

| Paquete | Coins | Precio | Bonus |
|---------|-------|--------|-------|
| Starter | 100 | $1 USD | — |
| Popular | 500 | $4 USD | +25% |
| Mega | 1,200 | $8 USD | +50% |
| Ultra | 3,000 | $15 USD | +100% |

- Admin puede crear/editar/eliminar paquetes
- Ofertas temporales con fecha inicio/fin
- Paquetes de primera compra (first_purchase_only) con bonus extra
- Max por transacción configurable (puede volver a comprar inmediatamente)

### Formas de obtener coins
- **Comprar** con dinero real (PayPal) — cualquiera (streamer o viewer)
- **Recibir del admin** — AnthonyDeca regala coins (promociones, eventos)
- **Transferencia** — de cualquier usuario a cualquier usuario
- **Referidos** — bonus al invitar y ser invitado
- **Cupones** — códigos de descuento o bonus coins
- **Futuro**: misiones diarias, logros especiales

### Tablas BD (10 tablas)

```
user_coins              — Balance global (user_id, balance, total_earned, total_spent,
                           total_transferred_in, total_transferred_out, first_purchase_at,
                           economy_status [normal/flagged/banned_economy], created_at, updated_at)

coin_packages           — Paquetes de compra (name, description, coins, bonus_coins, price_usd,
                           icon, is_offer, offer_starts_at, offer_expires_at, first_purchase_only,
                           max_per_transaction, sort_order, enabled, created_at, updated_at)

coin_pending_orders     — Órdenes PayPal pendientes (user_id, package_id, paypal_order_id,
                           discount_code_id, status [pending/completed/expired], created_at)

coin_purchases          — Historial de compras completadas (user_id, package_id, coins_received,
                           amount_paid_usd, paypal_order_id, paypal_status, discount_code_id,
                           discount_amount, bonus_coins_from_coupon, bonus_coupon_scheduled_at,
                           bonus_coupon_credited_at, created_at)

coin_transactions       — Log de toda operación (user_id, amount [+/-], balance_after,
                           type [purchase/admin_gift/admin_remove/transfer_in/transfer_out/
                           marketplace_buy/referral_bonus/coupon_bonus],
                           description, related_user_id, created_at)

coin_transfers          — Detalle de transferencias (from_user_id, to_user_id, amount,
                           message, created_at)

coin_discount_codes     — Cupones de descuento (code, discount_type [percentage/fixed_amount/bonus_coins],
                           discount_value, assigned_user_id [null=público], max_uses, current_uses,
                           max_uses_per_user, min_purchase_usd, applicable_package_id [null=todos],
                           combinable_with_first_purchase, starts_at, expires_at, enabled,
                           created_by, created_at)

coin_discount_uses      — Quién usó qué cupón (code_id, user_id, purchase_id,
                           discount_applied, used_at)

coin_referrals          — Sistema de referidos (referrer_user_id, referred_user_id,
                           referral_code, bonus_given_to_referrer, bonus_given_to_referred,
                           status [pending/completed/rejected], completed_at, created_at)

coin_settings           — Config global (1 fila) (currency_name, currency_icon,
                           max_transfer_per_day [monto], max_transfers_per_day [cantidad],
                           min_transfer_amount, min_account_age_to_transfer_days,
                           min_account_age_to_receive_days, max_referrals_per_user,
                           referral_bonus_referrer, referral_bonus_referred,
                           referral_min_activity_days, first_purchase_bonus_percent,
                           enabled, updated_at)

coin_flags              — Historial de flags anti-abuso (user_id,
                           flag_type [rapid_transfers/high_balance_transfer_new_account/
                           coupon_then_transfer/multi_account_ip],
                           flag_reason, flag_details [JSONB], status [pending/resolved_ok/resolved_banned],
                           resolved_by, resolved_at, created_at)
```

### Reglas de negocio — Compras

1. Verificar paquete habilitado y no expirado
2. Si oferta temporal → validar fechas
3. Si first_purchase_only → verificar first_purchase_at es null
4. Verificar max_per_transaction
5. Si tiene cupón → validar código (no expirado, max usos, max por usuario, min_purchase, paquete aplicable, si es privado verificar assigned_user_id)
6. Calcular precio final (precio - descuento, mínimo $0, nunca negativo)
7. Si precio = $0 (cupón 100%) → saltear PayPal, acreditar directo
8. Si precio > $0 → crear orden PayPal, registrar en coin_pending_orders
9. **Idempotencia**: si ya tiene una pending_order activa, bloquear nueva compra
10. Al webhook PayPal → acreditar coins + bonus_coins del paquete
11. Si primera compra + first_purchase_bonus_percent → bonus adicional (si cupón es combinable_with_first_purchase)
12. Si cupón tipo bonus_coins → registrar bonus_coupon_scheduled_at, acreditar automáticamente después de 24h si no está flagged
13. Registrar en coin_purchases, coin_transactions, actualizar user_coins
14. **Job cada hora**: expirar pending_orders > 3 horas, procesar bonus_coins pendientes > 24h

### Reglas de negocio — Transferencias

1. Sender economy_status = normal (flagged no puede enviar, banned no puede enviar)
2. Receiver economy_status = normal o flagged (banned no puede recibir)
3. from_user_id ≠ to_user_id
4. amount ≥ min_transfer_amount (default 10 coins)
5. Antigüedad sender ≥ min_account_age_to_transfer_days
6. Antigüedad receiver ≥ min_account_age_to_receive_days
7. Transferencias del día ≤ max_transfers_per_day
8. Monto del día ≤ max_transfer_per_day
9. Balance suficiente
10. Ejecutar: restar sender, sumar receiver
11. Registrar coin_transactions (transfer_out + transfer_in) + coin_transfers

### Reglas de negocio — Referidos

1. Código de referido fijo por usuario, generado al registrarse, no se puede cambiar
2. Al registrarse con código → coin_referrals con status pending
3. Status pasa a completed cuando referido cumple referral_min_activity_days
4. Al completar → bonus a ambos (referral_bonus_referrer + referral_bonus_referred)
5. Límite configurable: max_referrals_per_user (null = sin límite)
6. Abuso → admin cambia status a rejected

### Reglas de negocio — Anti-abuso

Patrones que generan flag automático:
- Más de X transferencias en 1 hora a la misma cuenta
- Transferir más del 80% del balance a cuenta de menos de 14 días
- Comprar con cupón y transferir todo en las siguientes 24 horas
- Múltiples cuentas desde el mismo IP comprando/transfiriendo

Al detectar → economy_status = flagged + registro en coin_flags con flag_type, flag_reason, flag_details (JSON).
Admin revisa → resolved_ok (falsa alarma, vuelve a normal) o resolved_banned (balance a 0, bloqueado).

### Cupones de descuento — 3 tipos

**Porcentaje**: X% off en el precio. Ej: DECATRON20 = 20% off.
**Monto fijo**: $X off. Se cappea al precio del paquete (nunca negativo).
**Bonus coins**: No descuenta precio, da coins extra. Se acredita después de 24h automáticamente si no está flagged.

Cada cupón: max usos global, max por usuario, fecha inicio/expiración, público o privado (assigned_user_id), aplica a paquete específico o todos, combinable con first_purchase_bonus o no.

### Endpoints API

**Público (requiere login):**
- `GET /api/coins/packages` — paquetes disponibles
- `POST /api/coins/buy` — iniciar compra (package_id, discount_code opcional)
- `POST /api/coins/webhook` — webhook PayPal
- `POST /api/coins/redeem-code` — validar cupón, devuelve precio final
- `GET /api/coins/balance` — mi balance
- `GET /api/coins/history` — mi historial paginado
- `POST /api/coins/transfer` — transferir coins
- `GET /api/coins/referral` — mi código y stats

**Admin:**
- `GET /api/admin/coins/stats` — dashboard economía
- CRUD `/api/admin/coins/packages` — paquetes
- CRUD `/api/admin/coins/discounts` — cupones
- `GET/POST /api/admin/coins/users/:id` — ver, dar, quitar coins, cambiar status
- `POST /api/admin/coins/users/:id/credit-coupon-bonus` — acreditar bonus pendiente
- `GET /api/admin/coins/transactions` — auditoría filtrable
- `GET/POST /api/admin/coins/referrals` — gestión referidos
- `GET/PUT /api/admin/coins/settings` — configuración global

### Frontend

**`/me/coins`**: balance con icono, grilla de paquetes, campo cupón con preview de precio final, historial paginado, transferir coins por username.
**`/admin/economy`**: dashboard stats, CRUD paquetes + ofertas, CRUD cupones, gestión usuarios (buscar, balance, historial, dar/quitar, status), bonus pendientes de acreditar, auditoría, referidos, configuración global.

### Fases de implementación

**Parte 1**: Tablas base, modelos, balance, paquetes, compra PayPal con idempotencia y job de expiración.
**Parte 2**: Transferencias con todas las validaciones y anti-abuso básico (coin_flags).
**Parte 3**: Cupones completos incluyendo flujo 100% descuento y job de bonus_coins con delay 24h.
**Parte 4**: Referidos.
**Parte 5**: Admin panel completo con auditoría y configuración.

---

## Rank Card visual (ImageSharp)

Imagen generada con ImageSharp (mismo sistema que welcome).
**Dimensiones**: 934x282 (estándar tipo MEE6/Arcane).

### Tres niveles de personalización

**1. Card de Decatron (default)**:
- Template base de la plataforma, viene listo
- Colores se adaptan por tier (Supporter=azul, Premium=morado, Fundador=dorado)
- Se usa cuando nadie personalizó nada

**2. Card del servidor (configurada por el streamer)**:
- Editor 100% libre, drag & drop profesional en el dashboard
- Cada elemento es independiente: posición X/Y, tamaño, color, visibilidad, z-index
- Elementos: avatar (círculo/cuadrado/hexágono), nombre, nivel, barra XP, rank, stats, marco, fondo, logo, badges
- Fondo: color sólido, gradiente, imagen (upload o templates base)
- Marco: seleccionar de templates disponibles
- Preview en tiempo real en el editor (Canvas HTML)
- Botón "Preview real" → genera la imagen con ImageSharp para verificar
- Config se guarda como JSON → el backend renderiza con ImageSharp

**3. Card personal del viewer (configurada por el usuario)**:
- El viewer personaliza **su propia** card con items del Marketplace
- Compra con DecaCoins: fondos, marcos, colores de barra, badges especiales
- Puede equipar/cambiar entre items que tiene
- También desbloquea items por nivel (gratis, sin coins)
- Configura desde `/me → Mi Card` o slash command `/card`

**Prioridad de capas**:
```
Viewer custom (items equipados) > Streamer custom (template servidor) > Decatron default
```
Si el viewer tiene un fondo equipado → se usa el suyo sobre el template del servidor.

### Se muestra cuando
- `/level` — tu propia card
- `/level @user` — card de otro
- Level up — el bot postea la card en el canal configurado
- `!level` en Twitch → link a vista pública del rank
- Vista pública `/u/{username}`

---

## Rank Card Marketplace (compra con DecaCoins)

Items cosméticos para personalizar la rank card del viewer. Se compran con DecaCoins.

### Tipos de items

| Tipo | Ejemplo | Descripción |
|------|---------|-------------|
| `rank_background` | Fondo galaxia, neon, anime | Imagen de fondo 934x282 |
| `rank_frame` | Marco dorado, pixel art, fire | Marco decorativo alrededor de la card |
| `rank_accent` | Barra rainbow, neon green | Color/estilo de la barra de progreso |
| `rank_badge` | Iconos especiales junto al nombre | Badges cosméticos (no confundir con achievements) |
| `rank_effect` | Partículas, brillo (futuro/IA) | Efectos visuales sobre la card |

### Fuentes de items
- **Globales (Decatron)**: los crea AnthonyDeca, disponibles en toda la plataforma
- **Por nivel**: se desbloquean gratis al llegar a cierto nivel (incentivo para subir)
- **Futuro**: items generados por IA

### Tablas BD nuevas
```
marketplace_items        — Catálogo de items (name, type, preview_url, cost_coins, unlock_level, rarity, enabled)
user_marketplace_items   — Items que posee cada usuario (user_id, item_id, acquired_via, equipped)
```

### Equipar items (mientras no exista /me)
- `/card backgrounds` → ver fondos disponibles/comprados
- `/card frames` → ver marcos
- `/card equip <id>` → equipar item
- `/card preview` → preview de tu card actual

### Raridades
| Raridad | Color | Descripción |
|---------|-------|-------------|
| Común | Gris | Fácil de obtener |
| Raro | Azul | Requiere más coins o nivel medio |
| Épico | Morado | Caro o nivel alto |
| Legendario | Dorado | Exclusivo, edición limitada |

---

## Slash Commands de Gamificación

| Comando | Quién | Descripción |
|---|---|---|
| `/level` | Todos | Tu rank card |
| `/level @user` | Todos | Rank card de otro |
| `/top` | Todos | Leaderboard top 10 server |
| `/top monthly` | Todos | Leaderboard del mes |
| `/top voice` | Todos | Top por voice time |
| `/top global` | Todos | Top global Decatron |
| `/rewards` | Todos | Ver rewards disponibles por nivel |
| `/shop` | Todos | XP Store — comprar rewards (XP del servidor) |
| `/achievements` | Todos | Tus badges |
| `/card` | Todos | Ver tu rank card actual |
| `/card backgrounds` | Todos | Ver fondos disponibles/comprados |
| `/card frames` | Todos | Ver marcos disponibles/comprados |
| `/card equip <id>` | Todos | Equipar item del marketplace |
| `/card preview` | Todos | Preview de tu card con items equipados |
| `/coins` | Todos | Ver tu balance de DecaCoins |
| `/coins give @user 100` | Streamer | Dar coins a un viewer (de tu balance) |
| `/xp give @user 500` | Admin/Rol | Dar XP |
| `/xp remove @user 200` | Admin/Rol | Quitar XP |
| `/xp reset @user` | Admin/Rol | Resetear XP |
| `/xp set @user 5000` | Admin/Rol | Setear XP exacto |
| `/xp boost 2x 2h` | Admin/Rol | Evento XP boost temporal |

---

## Tablas de BD (PostgreSQL)

### Gamificación XP (existentes)
```
user_xp                — XP por usuario por servidor (guild_id, user_id, xp, level, total_messages, voice_minutes, last_xp_at)
user_xp_global         — XP global Decatron (user_id, xp, level, total_servers_active)
xp_configs             — Config del sistema por servidor (curva, cooldowns, multiplicadores, canales excluidos, modo nocturno)
xp_roles               — Roles por nivel (guild_id, level, role_id, role_name, color)
xp_store_items         — Items de la store del streamer (guild_id, name, cost XP, type, duration, stock)
xp_store_purchases     — Compras de la store (user_id, item_id, cost_paid, status, expires_at)
xp_transactions        — Log de ganancia/pérdida de XP (para gráficos, auditoría)
xp_achievements        — Definición de badges (guild_id, name, condition, icon)
user_achievements      — Badges desbloqueados por usuario (user_id, achievement_id, unlocked_at)
xp_boosts              — Boosts activos (guild_id, multiplier, duration, activated_by, expires_at)
xp_seasonal            — Leaderboard mensual (month, user_id, guild_id, xp_gained)
```

### DecaCoins Economy (nuevas)
```
user_coins             — Balance global de coins (user_id, balance, total_earned, total_spent)
coin_transactions      — Log de toda transacción (user_id, amount, type, description, from_user_id)
coin_packages          — Paquetes de compra (name, coins, price_usd, bonus_coins, enabled)
coin_purchases         — Historial de compras PayPal (user_id, package_id, amount_paid, payment_id, status)
```

### Rank Card Marketplace (nuevas)
```
marketplace_items      — Catálogo de items (name, type, preview_url, cost_coins, unlock_level, rarity, enabled)
user_marketplace_items — Items que posee cada usuario (user_id, item_id, acquired_via, equipped)
rank_card_configs      — Config rank card del streamer (guild_id, config_json, background_url, updated_at)
user_rank_card_configs — Config rank card del viewer (user_id, equipped_background, equipped_frame, equipped_accent)
```

---

---

# UI — Dashboard del Streamer (`/discord/levels`)

> Config del sistema XP del servidor. Solo accesible con `control_total`.
> Layout: 2/3 editor + 1/3 sidebar dinámico (cambia según tab activo).
> Estructura modular tipo `/discord/welcome` y `/overlays/event-alerts`.

## Layout general

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ Sistema de XP & Niveles          [Servidor ▼] [↺] [Guardar] │
│ Configura el sistema de gamificación de tu servidor             │
└─────────────────────────────────────────────────────────────────┘

┌─ Tabs ──────────────────────────────────────────────────────────┐
│ ⚙️ General │ 📊 Niveles │ 🎭 Roles │ 🏆 Achievements │        │
│ 🛒 Store │ 📅 Seasonal │ 🎨 Rank Card │ 🔧 Moderación │       │
│ 🧪 Testing                                                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────── Editor (2/3) ──────────┐ ┌──── Sidebar (1/3) ────┐
│                                     │ │                        │
│  [Contenido del tab activo]         │ │  [Cambia según tab]    │
│                                     │ │                        │
└─────────────────────────────────────┘ └────────────────────────┘
```

## 9 Tabs

### Tab 1 — General (⚙️)
**Editor:**
- Toggle activar/desactivar sistema XP
- Dificultad preset: Fácil / Normal / Difícil / Hardcore / Custom
- Fuentes de XP con toggles y valores editables (mensaje Discord, mensaje Twitch, voice, eventos)
- Cooldowns: entre mensajes, max XP/hora, largo mínimo
- Canales excluidos (multiselect de canales del servidor)
- Modo nocturno: toggle + multiplicador cuando streamer en vivo
- Canal de notificaciones level-up

**Sidebar:** Stats rápidos (usuarios activos, nivel promedio, XP total del servidor)

### Tab 2 — Niveles (📊)
**Editor:**
- Tabla visual de niveles: nivel, nombre custom, XP necesario, XP acumulado
- Botón "Agregar nivel" para crear más allá de los base
- Editar nombre de cada nivel inline
- Fórmula actual visible + editor si es custom

**Sidebar:** Simulador — "Con esta config, llegar a nivel X toma Y días de actividad normal". Slider interactivo.

### Tab 3 — Roles (🎭)
**Editor:**
- Lista de roles con: nivel requerido, nombre, color (color picker), icono
- Drag & drop para reordenar
- Botón "Crear roles en Discord" (el bot los crea automáticamente)
- Botón "Agregar rol" para nuevos
- Toggle "Roles acumulables" (default on)

**Sidebar:** Preview visual de cómo se ve la lista de roles en Discord (colores apilados)

### Tab 4 — Achievements (🏆)
**Editor:**
- Lista de badges base con toggle activar/desactivar cada uno
- Cada badge: icono, nombre, descripción, condición
- Botón "Crear badge custom" (nombre, icono, condición: mensajes/nivel/voice/custom)

**Sidebar:** Preview de cómo se ven los badges en la rank card

### Tab 5 — Store (🛒)
**Editor:**
- Lista de items a la venta
- Botón "Crear item": nombre, descripción, costo XP, tipo (rol temporal, acceso canal, shoutout, custom), duración, stock
- Editar/eliminar items existentes

**Sidebar:** Preview del embed `/shop` como se ve en Discord

### Tab 6 — Seasonal (📅)
**Editor:**
- Toggle activar leaderboard mensual
- Config rewards para top 1, top 3
- Rol temporal del ganador del mes
- Historial de ganadores anteriores

**Sidebar:** Preview del embed de leaderboard mensual

### Tab 7 — Rank Card (🎨)
**Editor:**
- Editor visual 100% libre con Canvas HTML y drag & drop
- Cada elemento es un objeto independiente posicionable:
  - Avatar (posición, tamaño, forma: círculo/cuadrado/hexágono)
  - Nombre de usuario (fuente, tamaño, color, posición)
  - Nivel (fuente, tamaño, color, posición)
  - Barra de XP (posición, tamaño, colores fill/bg, estilo, bordes)
  - Rank (#1, #2...) (posición, color, fuente)
  - Stats (Total XP, Progreso, Siguiente nivel)
  - Marco/Frame (seleccionar de templates)
  - Fondo (color sólido, gradiente, imagen upload, templates base)
  - Logo/watermark del streamer (upload)
  - Badges/Tier pill
- Cada elemento: posición X/Y (drag), tamaño, color, mostrar/ocultar, z-index (capas)
- Dimensiones: 934x282
- Config se guarda como JSON (posiciones, colores, visibilidad de cada elemento)
- Botón "Preview real" → llama al backend para generar imagen con ImageSharp

**Sidebar:** Preview en vivo de la rank card con datos de ejemplo (se actualiza en tiempo real con Canvas HTML)

### Tab 8 — Moderación (🔧)
**Editor:**
- Permisos: qué roles de Discord pueden usar comandos admin de XP
- Gestión de usuarios: buscador, ver/editar XP de cualquier usuario
- Log de acciones admin (quién dio/quitó XP y cuándo)
- XP Boost: crear boost temporal (multiplicador + duración)
- Lista de boosts activos con timer

**Sidebar:** Boost activo (si hay) + últimas acciones admin

### Tab 9 — Testing (🧪)
**Editor:**
- Botón "Simular level up" — envía rank card de prueba al canal configurado
- Botón "Test rank card" — genera y muestra la card aquí
- Botón "Test leaderboard" — envía embed de prueba
- Botón "Test achievement" — simula desbloqueo de badge

**Sidebar:** Resultado del último test (imagen/embed generado)

---

---

# UI — Dashboard del Viewer (`/me`)

> Dashboard personal del usuario (viewer). Separado del dashboard del streamer.
> Accesible al loguearse con Twitch (full) o Discord (limitado).

## Estrategia de Layout — Un layout adaptativo

Se usa el MISMO Layout.tsx existente. El sidebar se adapta según el tipo de usuario:

### Caso 1: Viewer Discord (solo Discord)
Solo ve secciones de `/me`. No ve dashboard del streamer.

### Caso 2: Viewer Twitch (sin permisos de streamer)
Ve secciones de `/me` + secciones públicas (docs).

### Caso 3: Streamer Twitch (con permisos)
Ve TODO: secciones de `/me` + dashboard completo del bot.

### Caso 4: Cuentas vinculadas (Twitch + Discord)
Acceso full: `/me` con data unificada + dashboard del streamer si tiene permisos.

---

## Autenticación — Dos formas de login

### Login con Discord (acceso limitado)
- Ve su perfil Discord: servidores donde está, nivel, ranking
- Ve sus achievements de Discord
- Ve/edita su rank card (equipa items del marketplace)
- Ve su balance de DecaCoins y puede comprar paquetes
- Compra items del Marketplace
- NO ve stats de Twitch, NO accede al dashboard del streamer, NO gestiona bots

### Login con Twitch (acceso full)
- Todo lo anterior + stats de Twitch
- Dashboard completo del bot (si es streamer con permisos)
- XP cross-platform
- Acceso al perfil completo

### Vincular ambas cuentas
- En cualquier momento puede vincular la otra cuenta desde `/me → Cuenta`
- Al vincular: XP se unifica, perfil se completa, coins compartidos, acceso full

---

## Login Page — Diseño actualizado

Misma página actual pero con DOS botones de login y subtexto explicativo.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                    Welcome to Decatron                            │
│              Tu plataforma de streaming favorita                 │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │  🟣  Continue with Twitch                                │   │
│   │      Full access: bot, overlays, commands + profile      │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │  🔵  Continue with Discord                               │   │
│   │      Profile, rank cards, marketplace, coins             │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│   Already have both? Link them in Settings after login.          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Botón Twitch**: Gradiente morado (#9146ff → #772ce8) — ya existe
**Botón Discord**: Gradiente azul (#5865F2 → #4752C4) — nuevo, mismo estilo
**Subtextos**: Debajo de cada botón, texto gris indicando qué acceso da cada uno

---

## Sidebar — Sección Mi Perfil (nuevo en Layout.tsx)

Se agrega al sidebar existente, ARRIBA de las secciones del streamer.
Visible para TODOS los usuarios logueados (viewer Discord, viewer Twitch, streamer).

```
┌─ Sidebar ──────────────────────┐
│ 🔵 Decatron                    │
│                                 │
│ ┌─ User Card ────────────────┐ │
│ │ [Avatar] AnthonyDeca       │ │
│ │ Nivel 42 · 💰 1,250 coins │ │
│ └────────────────────────────┘ │
│                                 │
│ ─── Mi Perfil ──────────────── │
│ 📊 Overview                   │
│ 🏅 Mis Servidores             │
│ 🏆 Achievements               │
│ 🎨 Mi Rank Card               │
│ 🛍️ Marketplace                │
│ 💰 DecaCoins                  │
│ 📈 Progresión                 │
│ ⚙️ Cuenta                     │
│                                 │
│ ─── Panel Streamer ─────────── │  ← Solo si tiene permisos Twitch
│ 📊 Dashboard                  │
│ 📝 Commands ▼                 │
│ 🎨 Overlays ▼                 │
│ ⚡ Features ▼                 │
│ 🛡️ Moderation ▼               │
│ 🔵 Discord ▼                  │
│ ⚙️ Settings                   │
│ 📈 Analytics                  │
│                                 │
│ ─── Otros ──────────────────── │
│ 📖 Docs ▼                     │
│ 🚪 Logout                     │
└─────────────────────────────────┘
```

**User Card** (arriba del sidebar):
- Avatar circular (de Discord o Twitch según login)
- Nombre de usuario
- Nivel global + balance de coins en texto pequeño
- Click → va a `/me` (overview)

**Si es viewer Discord sin vincular**: no aparece "Panel Streamer"
**Si es streamer Twitch**: aparece todo

---

## Páginas de `/me` — 8 secciones

### 1. Overview (`/me`)
```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ Rank Card Preview ────────────────────────────────────────┐ │
│  │  [Tu rank card grande — 934x282 — con items equipados]     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Stats Row ─────────────────────────────────────────────────┐│
│  │ Nivel 42 Global │ 5 Servidores │ 12 Badges │ 💰 1,250 Coins││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Barra de progreso global ─────────────────────────────────┐ │
│  │ Nivel 42 ████████████████████░░░░░ Nivel 43  (78%)         │ │
│  │ 45,200 / 58,000 XP Global                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Top Servidores ──────────┐ ┌─ Achievements Recientes ────┐ │
│  │ 🥇 #2 en AnthonyDeca     │ │ 🏆 Chatterbox     · hace 2d │ │
│  │    Nivel 38 · 125K XP    │ │ 🏆 Week Warrior   · hace 5d │ │
│  │ 🥈 #5 en Somos Pixis     │ │ 🏆 First Message  · hace 1m │ │
│  │    Nivel 22 · 48K XP     │ │                              │ │
│  │ 🥉 #12 en Los Mancos     │ │ [Ver todos →]                │ │
│  │    Nivel 15 · 22K XP     │ │                              │ │
│  │                           │ │                              │ │
│  │ [Ver todos →]             │ │                              │ │
│  └───────────────────────────┘ └──────────────────────────────┘ │
│                                                                  │
│  ┌─ Actividad Reciente ───────────────────────────────────────┐ │
│  │ Hace 2h: +25 XP (mensaje en Somos Pixis)                   │ │
│  │ Hace 3h: +25 XP (mensaje en AnthonyDeca)                   │ │
│  │ Hace 1d: 🏆 Desbloqueaste "Chatterbox"                     │ │
│  │ Hace 2d: Subiste a Nivel 42 Global                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Mis Servidores (`/me/servers`)
```
┌─────────────────────────────────────────────────────────────────┐
│  Mis Servidores (5)                    [Ordenar: Nivel ▼]       │
│                                                                  │
│  ┌─ Server Card ───────────────────────────────────────────────┐│
│  │ [Icon] AnthonyDeca          Rank #2 de 350                  ││
│  │ Nivel 38 · 125,400 XP · 3,200 mensajes                     ││
│  │ ████████████████████████░░░ 82% → Nivel 39                  ││
│  │ Roles: ✦ Veteran · ✦ Elite · ✦ Legend                       ││
│  │                                            [Ver detalle →]  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Server Card ───────────────────────────────────────────────┐│
│  │ [Icon] Somos Pixis          Rank #5 de 180                  ││
│  │ Nivel 22 · 48,000 XP · 1,100 mensajes                      ││
│  │ ████████████████░░░░░░░░░░░ 55% → Nivel 23                 ││
│  │ Roles: ✦ Active · ✦ Dedicated                               ││
│  │                                            [Ver detalle →]  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Achievements (`/me/achievements`)
```
┌─────────────────────────────────────────────────────────────────┐
│  Achievements (12/25)                  [Filtro: Todos ▼]        │
│                                                                  │
│  ┌─ Desbloqueados ────────────────────────────────────────────┐ │
│  │ [🏆] First Message  │ [🏆] Chatterbox   │ [🏆] Regular    │ │
│  │ [🏆] Week Warrior   │ [🏆] Streak 7     │ [🏆] Connected  │ │
│  │ ... (color, con brillo)                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ En progreso ──────────────────────────────────────────────┐ │
│  │ [🔒] Marathon: 4,200/10,000 mensajes ██████░░░░ 42%        │ │
│  │ [🔒] Voice Warrior: 45/100 horas    ████░░░░░░ 45%         │ │
│  │ [���] Streak Master: 12/30 días      ████░░░░░░ 40%         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Bloqueados ───────────────────────────────────────────────┐ │
│  │ [🔒] OG     │ [🔒] Top Monthly │ [🔒] Legend              │ │
│  │ (gris, con candado, condición oculta o visible)             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Mi Rank Card (`/me/card`)
- Preview grande de tu card actual con items equipados
- Sección "Items Equipados": fondo actual, marco actual, acento actual
- Botón por cada slot: "Cambiar" → abre selector de items que tienes
- Botón "Ir al Marketplace" para comprar más
- Preview se actualiza en tiempo real al cambiar items

### 5. Marketplace (`/me/marketplace`)
- Grid de items con preview, precio en coins, raridad
- Filtros: tipo (fondos, marcos, acentos, badges), raridad, precio
- Click en item → modal con preview aplicado a tu card + botón comprar
- Items ya comprados marcados con check verde
- Items desbloqueables por nivel: muestra nivel requerido

### 6. DecaCoins (`/me/coins`)
- Balance grande arriba: "💰 1,250 DecaCoins"
- Grid de paquetes de compra (cards atractivas con precio y bonus)
- Botón "Comprar" → flujo PayPal
- Historial de transacciones (tabla: fecha, tipo, monto, descripción)

### 7. Progresión (`/me/progression`)
- Gráfico de XP por día/semana/mes (línea temporal)
- XP por servidor (barras comparativas)
- Historial de actividad reciente con filtros
- Stats acumulados: total mensajes, voice hours, días activo

### 8. Cuenta (`/me/account`)
- Cuentas vinculadas:
  - Twitch: [🟣 Vinculado: anthonydeca] o [Vincular Twitch]
  - Discord: [🔵 Vinculado: AnthonyDeca#1234] o [Vincular Discord]
- Privacidad: perfil público/privado (toggle)
- Notificaciones: level-up DM on/off (toggle)
- Zona peligrosa: eliminar datos (GDPR), desvincular cuentas

---

---

# UI — Vistas Públicas (sin login)

> Páginas accesibles por URL, sin necesidad de login.
> Open Graph meta tags para preview bonito al compartir en Discord/Twitter.
> Responsive (mobile-first — la gente abre links desde Discord en el teléfono).

## Resolución de username

Cuando alguien va a `/u/{username}`:
1. Busca por nombre de Twitch primero
2. Si no encuentra, busca por nombre de Discord
3. Si las cuentas están vinculadas, muestra perfil unificado
4. Si solo tiene Discord, muestra solo data de Discord
5. Si solo tiene Twitch, muestra solo data de Twitch

## Rutas

### Perfil público de usuario — `/u/{username}`
- Rank card del usuario
- Nivel global Decatron + barra de progreso
- Servidores activos (los públicos)
- Achievements/badges desbloqueados
- Stats generales
- Open Graph: preview con rank card al compartir

### Leaderboard de servidor — `/s/{streamer}/levels`
- Top usuarios del servidor (leaderboard scrolleable)
- Info del servidor: nombre, icono, total usuarios con XP
- Leaderboard mensual si está activo
- Link para vincular tu cuenta / registrarte
- Open Graph: stats del servidor al compartir

### Leaderboard global — `/levels`
- Top global de toda la plataforma Decatron
- Stats generales (total usuarios, total XP, total servidores)
- Open Graph: stats de la plataforma

---

---

# Rutas completas

| Ruta | Tipo | Descripción |
|---|---|---|
| `/discord/levels` | Privada (streamer) | Config del sistema XP del servidor — 9 tabs |
| `/me` | Privada (viewer logueado) | Dashboard personal del viewer — 8 tabs (login Twitch o Discord) |
| `/me/marketplace` | Privada (viewer) | Marketplace de items cosméticos (DecaCoins) |
| `/me/coins` | Privada (viewer) | Balance de DecaCoins + compra paquetes (PayPal) |
| `/u/{username}` | Pública | Perfil público de usuario (Twitch o Discord name) |
| `/s/{streamer}/levels` | Pública | Leaderboard de un servidor |
| `/levels` | Pública | Leaderboard global Decatron |

---

---

# Fases de Implementación

### Fase 5A: Core XP/Niveles ✅ COMPLETADA (2026-04-01)
> Tablas BD, servicio XP, slash commands básicos, rank card, leaderboard

- [x] Tablas BD: user_xp, user_xp_global, xp_configs, xp_transactions
- [x] Modelos EF Core + migraciones PostgreSQL
- [x] XpService: cálculo de XP, curva exponencial (100*n²), cooldowns, anti-exploit
- [x] XP por mensaje Discord (15-25 random, cooldown 60s, max 500/hora, min 5 chars)
- [x] Global XP: suma cross-server, curva más difícil (150*n^2.2)
- [x] Streak diario: +1 por días consecutivos
- [x] Slash command `/level` — rank card visual (ImageSharp, 934x282)
- [x] Slash command `/level @user` — ver rank de otro
- [x] Slash command `/top` — leaderboard top 10 server
- [x] Slash command `/top global` — leaderboard global Decatron
- [x] Rank card: avatar circular, barra progreso, nivel, XP, ranking, stats, tier badge
- [x] Notificación level-up en Discord (embed + rank card imagen)
- [x] Anti-exploit: cooldown in-memory, max XP/hora, largo mínimo, canales excluidos
- [x] Config auto-creada por servidor con defaults inteligentes
- [ ] XP por mensaje Twitch (cuenta vinculada) — pendiente Fase 5D
- [ ] XP por voice chat — pendiente
- [ ] XP por eventos (sub, follow, tip, raid) — pendiente
- [x] Bonus en Vivo (ex "modo nocturno") — cuando streamer está en vivo, XP se multiplica. Cache 2 min, detecta via alert messages + Twitch API fallback
- [ ] Multiplicadores por tier Decatron — pendiente (config existe)
- [ ] Twitch command `!level` — pendiente

### Fase 5B: Roles, Permisos, Moderación ✅ COMPLETADA (2026-04-01)
> Roles automáticos acumulables, permisos configurables, comandos admin, boosts

- [x] Tablas BD: xp_roles, xp_boosts
- [x] Bot crea 12 roles default automáticamente (con ✦ prefix + colores)
- [x] Roles acumulables (no se quitan al subir)
- [x] Asignación automática de rol al subir de nivel (Guild.CreateRoleAsync + GrantRoleAsync)
- [x] Permisos: Manage Server permission check para comandos admin
- [x] `/xp give @user amount` — Dar XP
- [x] `/xp remove @user amount` — Quitar XP
- [x] `/xp reset @user` — Resetear a 0
- [x] `/xp set @user amount` — Setear XP exacto
- [x] `/xp boost 2x 2h` — XP boost temporal (1.5x, 2x, 3x, 5x por 30m-24h)
- [x] Boost multiplica XP en tiempo real con cache in-memory
- [x] XpBoostService + XpRoleService como servicios independientes
- [x] Quitar roles al bajar de nivel (remove/reset) — desde dashboard Y Discord commands
- [x] Sync masivo de roles para usuarios existentes (botón "Sync Usuarios")
- [x] Eliminar roles de Discord al borrar desde dashboard
- [x] Eliminar todos los roles (botón + endpoint)
- [x] Limpiar roles huérfanos de Discord (botón "Limpiar Discord")
- [x] Renombrar/editar roles actualiza en Discord también (ModifyAsync)
- [x] Editable inline con save-on-blur (no spam de requests)

### Fase 5C: Achievements, Seasonal Leaderboard ✅ COMPLETADA (2026-04-02)
> Badges/logros + leaderboard mensual competitivo

- [x] Tablas BD: xp_achievements, user_achievements, xp_seasonal
- [x] 10 achievements base (First Message, Chatterbox, Marathon, Rising Star, Dedicated, Legend, Week Warrior, Streak Master, Connected, OG)
- [x] Auto-check en cada mensaje + admin give/set
- [x] Notificación de achievement al canal configurado (achievement_channel_id)
- [x] Streamer puede crear badges custom desde dashboard
- [x] Slash command `/achievements` — ver badges desbloqueados vs bloqueados
- [x] `/top monthly` — leaderboard del mes actual
- [x] SeasonalService — tracking XP por mes
- [x] Tab Achievements funcional en dashboard (toggle, crear, eliminar)
- [x] Tab Seasonal funcional en dashboard (leaderboard, stats, selector de mes)
- [x] Tab Niveles funcional (simulador con slider, tabla de niveles, tiempo estimado)
- [x] Resets: usuario (achievements/XP/completo), todos los achievements, seasonal
- [ ] Badges se muestran en rank card — pendiente
- [ ] Top 1 del mes recibe badge "Top [Mes]" + rol temporal — pendiente

### Fase 5D: XP Store ✅ PARCIALMENTE COMPLETADA (2026-04-02)
> Economía de XP del streamer — store funcional, vistas públicas pendientes

- [x] Tablas BD: xp_store_items, xp_store_purchases
- [x] XP Store: streamer crea rewards comprables con XP desde dashboard
- [x] 4 tipos funcionales: custom (pending→delivered), role_temp, channel_access, shoutout
- [x] Slash command `/shop` — comprar items
- [x] Tab Store funcional en dashboard (crear, editar, toggle, eliminar, historial compras, pending deliveries)
- [x] StoreExpirationService (background, cada 2min, revoca roles/acceso expirados)
- [x] 30+ endpoints en DiscordLevelsController
- [ ] Vistas públicas: `/u/{username}`, `/s/{streamer}/levels`, `/levels` — pendiente Fase 5K
- [ ] Open Graph meta tags — pendiente Fase 5K

### Fase 5E: Dashboard Streamer (`/discord/levels`) ✅ COMPLETADA (2026-04-01)
> UI de config del sistema XP — 9 tabs con sidebar dinámico

- [x] Estructura modular `discord/levels-extension/` (types, hooks, components, tabs)
- [x] Layout 2/3 editor + 1/3 sidebar dinámico (cambia por tab)
- [x] Tab General: toggle sistema, dificultad, fuentes XP, cooldowns, canales excluidos, bonus en vivo
- [x] Tab Niveles: simulador con slider, tabla de niveles, tiempo estimado
- [x] Tab Roles: lista roles editable inline (save-on-blur), crear/eliminar/sincronizar Discord, sync usuarios, limpiar huérfanos
- [x] Tab Achievements: badges base + custom (toggle, crear, eliminar)
- [x] Tab Store: items comprables con XP (crear, editar, toggle, historial, pending)
- [x] Tab Seasonal: leaderboard mensual (stats, selector de mes)
- [x] Tab Moderación: gestión usuarios (buscar, +100/+500/reset), boosts (crear, activo, historial)
- [x] Tab Testing: test level-up al canal configurado
- [x] Card de navegación en `/discord` (vista general) apuntando a `/discord/levels`
- [x] DiscordLevelsController API (30+ endpoints: config CRUD, roles CRUD, boosts, users, store, achievements, seasonal, test)
- [ ] Tab Rank Card: editor visual drag & drop — PLACEHOLDER (pendiente Fase 5I)

### Fase 5F: DecaCoins Economy ✅ COMPLETADA (2026-04-04)
> Economy system completo — 11 tablas, PayPal, transferencias, cupones, referidos, anti-abuso

**Parte 1 — Base + Compras PayPal: ✅**
- [x] Tablas BD: user_coins, coin_packages, coin_pending_orders, coin_purchases, coin_transactions, coin_settings
- [x] Modelos EF Core (11 modelos en Decatron.Core/Models/Economy/) + migraciones PostgreSQL
- [x] CoinService: balance, paquetes, compra
- [x] coin_settings con defaults (nombre moneda, reglas)
- [x] Paquetes base (4) + CRUD admin + compra custom (100-5000 coins, $1=100)
- [x] Ofertas temporales (is_offer, fechas)
- [x] First purchase bonus
- [x] Idempotencia: coin_pending_orders, auto-expire > 30min, reuse pending reciente
- [x] Integración PayPal (sección CoinsPayPal separada, sandbox/live independiente)
- [x] Flujo compra $0 (cupón 100%) sin PayPal
- [ ] Job: expirar pending_orders > 3h (pendiente — ahora expira > 30min en cada request)
- [x] API: GET packages, POST buy, POST capture, GET balance, GET history
- [x] Frontend: /me/coins (balance, paquetes, custom amount, historial)

**Parte 2 — Transferencias + Anti-abuso: ✅**
- [x] Tabla BD: coin_transfers, coin_flags
- [x] TransferService con 11 validaciones (self, status, min amount, account age, daily limits, balance)
- [x] Flag automático por patrones sospechosos (rapid_transfers, high_balance_transfer_new_account)
- [x] API: POST transfer, GET search-users (autocompletado)
- [x] Frontend: transferir coins por username con autocompletado en /me/coins

**Parte 3 — Cupones: ✅**
- [x] Tablas BD: coin_discount_codes, coin_discount_uses
- [x] 3 tipos: percentage, fixed_amount, bonus_coins
- [x] Públicos y privados (assigned_user_id)
- [x] Validaciones completas (9 checks: existencia, enabled, fechas, max usos, per-user, assigned, package, min_purchase)
- [ ] Job: acreditar bonus_coins pendientes > 24h si no flagged (pendiente)
- [x] API: POST validate-code, admin CRUD discounts
- [x] Frontend: campo cupón en /me/coins con preview precio final, precios tachados

**Parte 4 — Referidos: ✅**
- [x] Tabla BD: coin_referrals
- [x] Código fijo por usuario (REF-XXXXX, auto-generado)
- [x] Pending → completed al cumplir actividad mínima (referral_min_activity_days)
- [x] Bonus a ambos (configurable en coin_settings)
- [x] API: GET referral (código + stats), POST referral/apply
- [x] Frontend: sección referidos en /me/coins (copiar código/link, stats, aplicar código)

**Parte 5 — Admin panel: ✅**
- [x] /admin/economy: dashboard stats (8 cards: circulación, ventas, ingresos, flags, etc.)
- [x] CRUD paquetes + ofertas (7 tabs)
- [x] CRUD cupones con stats de uso
- [x] Gestión usuarios: buscar, balance, historial, dar/quitar, cambiar status
- [ ] Bonus pendientes de acreditar (pendiente — falta job)
- [x] Auditoría filtrable (tipo, usuario, fecha, paginado)
- [x] Gestión referidos (listar, rechazar)
- [x] Configuración global (nombre moneda, reglas anti-abuso, bonuses)
- [ ] Slash command `/coins` — ver balance (pendiente)
- [ ] Slash command `/coins give @user 100` — streamer da coins (pendiente)

**Pendientes menores:**
- [ ] Background job para expirar pending_orders y acreditar bonus_coins
- [ ] Slash commands de Discord (/coins, /coins give)
- [ ] Webhook PayPal server-side (ahora depende del capture del frontend)
- [ ] Validaciones adicionales en admin de cupones

### Fase 5G: Dashboard Stats del Streamer
> Panel de analytics de gamificación para el streamer

- [ ] Distribución de niveles en el servidor (gráfico)
- [ ] Actividad de XP por día/semana/mes (gráfico temporal)
- [ ] Top usuarios, usuarios más activos
- [ ] Historial de boosts y transacciones
- [ ] Progresión individual de usuario (gráfico)
- [ ] xp_transactions como fuente para todos los gráficos
- [ ] Puede ser un tab extra en `/discord/levels` o sección aparte

### Fase 5H: Discord Login + Viewer Dashboard Visual ✅ COMPLETADA (2026-04-03)
> OAuth Discord + UI del portal /me + vinculación de cuentas

**Login page: ✅**
- [x] Botón "Continue with Discord" (gradiente #5865F2 → #4752C4) en Login.tsx
- [x] Subtexto bajo cada botón explicando qué acceso da
- [x] Texto: "Already have both? Link them in Settings after login."

**Discord OAuth (backend): ✅**
- [x] Discord OAuth como método de login (DiscordAuthController: login, callback, exchange)
- [x] JWT con claims de Discord (discord_id, username, avatar, AuthProvider)
- [x] Viewer Discord — acceso limitado (solo /me, /dashboard, /settings, /dashboard/docs)
- [x] Vincular Discord→Twitch y Twitch→Discord (bidireccional, merge correcto)
- [x] Desvincular cuentas (solo la no-activa)
- [x] ProtectedRoute bloquea rutas streamer para Discord-only
- [x] Tokens Discord encriptados en BD

**Layout.tsx — Sidebar adaptativo: ✅**
- [x] User Card arriba del sidebar (avatar, nombre, tipo cuenta)
- [x] Sidebar sin acordeones — hub pages para Commands, Features, Moderation, Admin
- [x] Dashboard + Settings visibles para todos
- [x] "Panel Streamer" solo visible si tiene Twitch/both
- [x] Viewer Discord solo ve Mi Perfil + Dashboard + Settings + Docs + Logout
- [x] ChannelSwitcher oculto para Discord-only

**Páginas /me:**
- [x] `/me` — Overview con cards hub (mock data + cards de navegación a cada sección)
- [ ] `/me/servers` — Proximamente
- [ ] `/me/achievements` — Proximamente
- [ ] `/me/card` — Proximamente
- [ ] `/me/marketplace` — Proximamente
- [x] `/me/coins` — Balance, paquetes, custom, cupones, transferencias, referidos, historial (FUNCIONAL)
- [ ] `/me/progression` — Proximamente
- [x] `/me/account` — Redirige a /settings (vincular cuentas está en Settings)

### Fase 5I: Rank Card Editor (Streamer)
> Editor visual 100% libre drag & drop en el dashboard

- [ ] Tab Rank Card en `/discord/levels` — reemplazar PlaceholderTab
- [ ] Canvas HTML con elementos draggables (avatar, nombre, nivel, barra, stats, badges)
- [ ] Cada elemento: posición X/Y, tamaño, color, fuente, visibilidad, z-index
- [ ] Fondo: color sólido, gradiente, imagen (upload + templates base)
- [ ] Marco: selección de templates
- [ ] Preview en tiempo real (Canvas HTML, se actualiza al mover elementos)
- [ ] Botón "Preview real" → POST al backend → genera imagen con ImageSharp → muestra
- [ ] Guardar config como JSON en tabla rank_card_configs
- [ ] RankCardGenerator v2: leer config JSON → renderizar con ImageSharp dinámicamente
- [ ] Templates base (3-4 prediseñados) como punto de partida
- [ ] Tabla BD: rank_card_configs (guild_id, config_json, background_url)

### Fase 5J: Rank Card Marketplace
> Items cosméticos comprables con DecaCoins

- [ ] Tablas BD: marketplace_items, user_marketplace_items
- [ ] MarketplaceService: catálogo, comprar, equipar, inventario
- [ ] Items globales creados por admin: fondos, marcos, acentos, badges, efectos
- [ ] Raridades: común, raro, épico, legendario
- [ ] Items desbloqueables por nivel (gratis, sin coins)
- [ ] Slash commands: `/card backgrounds`, `/card frames`, `/card equip <id>`, `/card preview`
- [ ] API endpoints: catálogo, comprar, inventario, equipar
- [ ] RankCardGenerator v2: aplicar items equipados del viewer sobre template del servidor
- [ ] Prioridad de capas: viewer items > streamer template > Decatron default

### Fase 5K: Dashboard Viewer (`/me`) + Vistas Públicas
> Portal personal del viewer — 8 tabs, login dual + páginas públicas

- [ ] Tab Overview: rank card, nivel global, stats, top servidores, achievements, streak
- [ ] Tab Servidores: lista servidores con XP, expandible, filtros
- [ ] Tab Achievements: grid badges desbloqueados/bloqueados, progreso en curso
- [ ] Tab Mi Card: equipar items del marketplace, preview live, botón "Comprar más"
- [ ] Tab Marketplace: catálogo de items, filtros, preview aplicado, comprar con coins
- [ ] Tab DecaCoins: balance, paquetes PayPal, historial transacciones
- [ ] Tab Progresión: gráfico XP por tiempo, historial transacciones, filtros
- [ ] Tab Cuenta: cuentas vinculadas (Twitch/Discord), privacidad, notificaciones, GDPR
- [ ] Vistas públicas: `/u/{username}`, `/s/{streamer}/levels`, `/levels`
- [ ] Open Graph meta tags para preview al compartir
- [ ] Responsive mobile-first

### Futuro: Extensión de Twitch (post Fase 5)
> Emotes y emblemas por nivel, estilo 7TV/BetterTV

- [ ] Extensión de Twitch con emblemas visuales por nivel
- [ ] Badges en chat de Twitch según nivel Decatron
- [ ] Emotes exclusivos por nivel
- [ ] Se planifica como proyecto aparte cuando sistema base esté sólido

---

*Creado: 2026-04-01*
*Actualizado: 2026-04-03*
*Proyecto: decatrondev/decatron*

---

## Sesión 2026-04-01/02 — Resumen

### Completado
- Fase 5A: Core XP (tablas, XpService, /level, /top, rank card ImageSharp 934x282, anti-exploit, cooldowns)
- Fase 5B: Roles (12 default, crear/eliminar/sync Discord, acumulables, quitar al bajar nivel), permisos (ManageGuild), /xp give/remove/reset/set/boost, XpBoostService con cache
- Fase 5C: Achievements (10 base, custom, /achievements, seasonal leaderboard, resets)
- Fase 5D parcial: XP Store (4 tipos funcionales, StoreExpirationService, 30+ endpoints)
- Fase 5E: Dashboard /discord/levels (9 tabs, 7 funcionales + Rank Card placeholder, sidebar dinámico)
- Bonus en Vivo: XP multiplicado cuando streamer está live (cache 2min, Twitch API + alert messages)

### Próxima sesión
- Fase 5F: DecaCoins Economy (moneda plataforma, paquetes PayPal, balances, admin tools)
- Fase 5H: Discord Login para viewers
- Fase 5I: Rank Card Editor (drag & drop streamer)
- Fase 5J: Rank Card Marketplace (items con coins)
- Fase 5K: Dashboard Viewer + Vistas Públicas

---

## Sesión 2026-04-03 — Planificación

### Decisiones tomadas
- **DecaCoins**: moneda de la plataforma Decatron (NO por servidor). AnthonyDeca la vende, cualquiera compra (PayPal). Balance global.
- **XP Store del streamer**: se mantiene en XP, es economía interna del servidor. NO se migra a coins.
- **Rank Card Editor**: 100% libre, drag & drop profesional. Cada elemento posicionable independiente.
- **Tres niveles de card**: Decatron default < Streamer custom < Viewer items equipados
- **Marketplace**: items cosméticos (fondos, marcos, acentos, badges, efectos) comprables con DecaCoins + desbloqueables por nivel
- **Raridades**: común, raro, épico, legendario
- **Discord Login**: para viewers que solo usan Discord — acceso limitado a /me (perfil, coins, marketplace, card)
- **Paquetes base**: Starter $1/100c, Popular $4/500c, Mega $8/1200c, Ultra $15/3000c
- **Nombre moneda**: pendiente (provisional: DecaCoins)

### Decisiones de diseño UI
- **Un solo Layout.tsx adaptativo** — sidebar cambia según rol del usuario (viewer Discord, viewer Twitch, streamer)
- **Login page**: dos botones (Twitch morado + Discord azul) con subtexto de acceso
- **Sidebar**: User Card arriba (avatar, nombre, nivel, coins) + sección "Mi Perfil" (8 items) + sección "Panel Streamer" (condicional)
- **Viewer Discord**: solo ve "Mi Perfil" + Docs + Logout en sidebar
- **Streamer Twitch**: ve "Mi Perfil" + todo el dashboard actual
- **Cuentas vinculadas**: unifican acceso, coins, XP
- **8 páginas /me**: Overview, Servidores, Achievements, Mi Card, Marketplace, DecaCoins, Progresión, Cuenta
- **Mismos colores/tema** que el dashboard actual (identidad Decatron)
- **Empezar visual** con data mock, conectar backend después

### Orden actualizado de implementación
1. ~~**Fase 5H** (Discord Login + Viewer Dashboard Visual)~~ ✅
2. ~~**Fase 5F** (DecaCoins Economy)~~ ✅
3. **Fase 5I** (Rank Card Editor — streamer) ← SIGUIENTE
4. **Fase 5J** (Rank Card Marketplace)
5. **Fase 5K** (Conectar todo + Vistas Públicas)

---

## Sesión 2026-04-04 — Implementación

### Completado
- **Fase 5H completa**: Discord OAuth login, vinculación bidireccional de cuentas (Twitch↔Discord), merge correcto (usuario con historial se mantiene), desvincular, sidebar adaptativo sin acordeones, hub pages (Commands, Features, Moderation, Admin), ProtectedRoute para Discord-only, tokens encriptados
- **Fase 5F completa (5 partes)**:
  - Parte 1: 11 tablas BD, modelos EF Core, CoinService, paquetes (4 base + custom), PayPal sandbox separado, idempotencia, /me/coins funcional
  - Parte 2: Transferencias con 11 validaciones, anti-abuso (rapid_transfers, high_balance_transfer), autocompletado usuarios, admin endpoints
  - Parte 3: Cupones (3 tipos: percentage, fixed_amount, bonus_coins), 9 validaciones, preview precio, admin CRUD
  - Parte 4: Referidos (REF-XXXXX, pending→completed, bonus configurable, stats)
  - Parte 5: Admin panel /admin/economy (7 tabs: dashboard, paquetes, cupones, usuarios, auditoría, referidos, config)
- **Fixes**: debug logs eliminados, tokens Discord encriptados, tier muestra canal activo, sidebar rediseñado, AdminHub con card Ranking Global + Economia

### Pendientes para próxima sesión
- Validaciones adicionales en admin de cupones
- Background job para expirar pending_orders y acreditar bonus_coins
- Slash commands Discord (/coins, /coins give)
- Webhook PayPal server-side
- Fase 5I: Rank Card Editor
