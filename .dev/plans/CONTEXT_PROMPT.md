# Contexto del Proyecto Decatron — Prompt para Nuevas Sesiones

> Copia y pega este archivo al iniciar un nuevo chat para continuar donde quedamos.
> Ultima actualizacion: 2026-04-03

---

## Qué es Decatron

Plataforma de bot de Twitch (.NET 8 + React/Vite). El proyecto incluye integración con Discord usando DSharpPlus 4.4.9.
Todo en un solo proyecto, misma BD PostgreSQL (decatron_prod), mismos tiers.

## Directorio del proyecto

/var/www/html/decatron/Decatron/decatron/
├── ClientApp/          (React frontend - Vite + TailwindCSS)
├── Decatron.Discord/   (Discord bot - DSharpPlus, handlers, controllers)
├── Decatron.Data/      (EF Core, DbContext, PostgreSQL)
├── Decatron.Services/  (Servicios compartidos)
├── Decatron.Controllers/ (API controllers)
├── Program.cs          (Entry point, DI)
└── .dev/plans/         (Planes de implementación)

## Planes de referencia

- `.dev/plans/DISCORD_INTEGRATION_PLAN.md` — Plan maestro de Discord (fases 1-7)
- `.dev/plans/GAMIFICATION_SYSTEM_PLAN.md` — Plan completo de gamificación (fases 5A-5G + UI + vistas públicas)
- `.dev/plans/CONTEXT_PROMPT.md` — Este archivo

## Cómo reiniciar servicios

```bash
# Frontend (React/Vite)
cd /var/www/html/decatron/Decatron/decatron/ClientApp
sudo npm run build
sudo /root/web-services.sh stop decatron-f && sudo /root/web-services.sh start decatron-f

# Backend (.NET)
cd /var/www/html/decatron/Decatron/decatron
sudo /root/web-services.sh stop decatron-b
sudo dotnet build --nologo -v q
sudo /root/web-services.sh start decatron-b

# Atajo: parar, compilar y reiniciar backend
sudo /root/web-services.sh stop decatron-b && sudo dotnet build --nologo -v q && sudo /root/web-services.sh start decatron-b
```

## Base de datos

- PostgreSQL: `decatron_prod`
- Acceso: `sudo -u postgres psql -d decatron_prod`
- Migraciones manuales en SQL: `Decatron.Data/Migrations/`
- Ejecutar: `sudo -u postgres psql -d decatron_prod -f [archivo.sql]`

### Tablas de Gamificación (existentes — 11 tablas)
```
xp_configs, user_xp, user_xp_global, xp_transactions,
xp_roles, xp_boosts,
xp_achievements, user_achievements, xp_seasonal,
xp_store_items, xp_store_purchases
```

### Tablas nuevas (por crear)
```
DecaCoins (10 tablas): user_coins, coin_packages, coin_pending_orders, coin_purchases,
  coin_transactions, coin_transfers, coin_discount_codes, coin_discount_uses,
  coin_referrals, coin_settings, coin_flags
Marketplace: marketplace_items, user_marketplace_items
Rank Card: rank_card_configs, user_rank_card_configs
```

## Git — Cómo hacer commit y push

```bash
# Siempre con sudo por permisos
sudo git add [archivos]
sudo git commit -m "mensaje"
sudo git push origin main
```

**REGLAS:**
- NUNCA agregar "Co-Authored-By", Claude, AI, Anthropic en commits
- NUNCA hacer git push sin que el usuario lo pida explícitamente
- Los commits deben parecer 100% escritos por el usuario

## Patrones del código

### Agregar nuevo modelo Discord
1. Crear modelo en `Decatron.Discord/Models/NuevoModelo.cs` con `[Table("nombre_tabla")]` y `[Column("campo")]`
2. Agregar DbSet en `Decatron.Data/DecatronDbContext.cs`
3. Crear SQL migration en `Decatron.Data/Migrations/`
4. Si tiene JSONB: usar `[Column("campo", TypeName = "jsonb")]`

### Agregar nuevo slash command
1. En `DiscordBotService.cs` → agregar al `CommandsJson` (JSON array)
2. En `DiscordBotService.cs` → agregar case en switch de `OnInteractionCreated`
3. En `DecatronSlashCommands.cs` → agregar método handler

### Agregar nuevo tab en dashboard /discord/levels
1. Crear componente en `levels-extension/components/tabs/NuevoTab.tsx`
2. Importar en `DiscordLevels.tsx`
3. Agregar tab en `constants/defaults.ts` → `LEVELS_TABS`
4. Si necesita datos: agregar funciones al hook `useLevelsPersistence.ts`
5. IMPORTANTE: usar `import type { ... }` para imports de tipos

### Agregar endpoint API
1. En `DiscordLevelsController.cs` → agregar método con [HttpGet/Post/Put/Delete]
2. La ruta base es `api/discord/levels`
3. Usa `[Authorize]` + `[RequirePermission("settings", "control_total")]`

## Estado actual — Qué está completado

### Fases completadas
- **Fase 1**: Base Discord (DSharpPlus, slash commands, OAuth, live alerts)
- **Fase 2A**: Welcome/Goodbye (editor visual, Canvas 2D, ImageSharp)
- **Fase 2B**: Separar Discord pages (/discord, /discord/alerts, /discord/welcome)
- **Fase 5A**: Core XP/Niveles (XP por mensaje, curva, rank card, /level, /top)
- **Fase 5B**: Roles (12 auto, acumulables, /xp give/remove/reset/set/boost)
- **Fase 5C**: Achievements (10 base, custom, /achievements, seasonal leaderboard)
- **Fase 5D parcial**: XP Store (4 tipos funcionales: role_temp, channel_access, shoutout, custom con pendientes)
- **Fase 5E**: Dashboard /discord/levels (9 tabs, sidebar dinámico, 30+ endpoints)
- **Bonus en Vivo**: XP multiplicado cuando streamer está live

### Qué falta (en orden de implementación)
1. **Fase 5H: Discord Login + Viewer Dashboard Visual** — OAuth Discord, sidebar adaptativo, 8 páginas /me con data mock
2. **Fase 5F: DecaCoins Economy** — Moneda de plataforma, paquetes PayPal, balances globales, admin tools
3. **Fase 5I: Rank Card Editor** — Editor drag & drop 100% libre para streamer, Canvas + ImageSharp
4. **Fase 5J: Rank Card Marketplace** — Items cosméticos (fondos, marcos) comprables con coins
5. **Fase 5K: Conectar todo + Vistas Públicas** — /me funcional, /u/{user}, /s/{streamer}/levels
6. **Fase 5G: Stats Dashboard** — Analytics de gamificación para el streamer
7. **Cross-platform Twitch** — XP por mensajes de Twitch (vinculación de cuentas)
8. **Extensión Twitch** — Emotes/emblemas por nivel (proyecto aparte futuro)

### Slash commands existentes
/live, /timer, /stats, /followage, /song, /level, /top, /xp (give/remove/reset/set/boost), /achievements, /shop

### Slash commands nuevos (pendientes)
/card (backgrounds, frames, equip, preview), /coins (balance, give)

## Estructura de archivos Discord (frontend)

```
ClientApp/src/pages/discord/
├── DiscordConfig.tsx        (Vista General - /discord)
├── DiscordAlerts.tsx        (Live Alerts - /discord/alerts)
├── DiscordWelcome.tsx       (Welcome/Goodbye - /discord/welcome)
├── DiscordLevels.tsx        (XP & Niveles - /discord/levels)
├── alerts/                  (hooks, types, components de alerts)
├── welcome-extension/       (hooks, types, components de welcome)
└── levels-extension/        (hooks, types, components de levels)
    ├── types/index.ts
    ├── constants/defaults.ts
    ├── hooks/useLevelsConfig.ts
    ├── hooks/useLevelsPersistence.ts
    └── components/tabs/
        ├── GeneralTab.tsx, LevelsTab.tsx, RolesTab.tsx
        ├── AchievementsTab.tsx, StoreTab.tsx, SeasonalTab.tsx
        ├── ModerationTab.tsx, TestingTab.tsx
        ├── PlaceholderTab.tsx (para tabs no implementados)
        └── (falta: RankCardTab.tsx)
```

## Estructura backend Discord

```
Decatron.Discord/
├── DiscordBotService.cs         (Bot startup, slash commands routing)
├── DiscordClientProvider.cs     (Singleton DiscordClient)
├── DiscordOAuthController.cs    (OAuth Discord)
├── DiscordWelcomeController.cs  (API welcome/goodbye)
├── DiscordLevelsController.cs   (API gamificación - 30+ endpoints)
├── DiscordLiveAlertsController.cs
├── DiscordAlertPollingService.cs
├── RankCardGenerator.cs         (ImageSharp 934x282)
├── WelcomeImageGenerator.cs     (ImageSharp welcome images)
├── Commands/
│   └── DecatronSlashCommands.cs (Todos los handlers de slash commands)
├── Events/
│   ├── MessageXpHandler.cs      (XP por mensaje, achievements, roles)
│   ├── WelcomeHandler.cs        (Join/leave)
│   └── LiveAlertHandler.cs      (Stream online/offline)
├── Services/
│   ├── XpService.cs             (Lógica central XP)
│   ├── XpBoostService.cs        (Boosts temporales con cache)
│   ├── XpRoleService.cs         (Roles automáticos Discord)
│   ├── AchievementService.cs    (Badges/logros)
│   ├── SeasonalService.cs       (Leaderboard mensual)
│   └── StoreExpirationService.cs (Background service - expira compras)
└── Models/
    ├── XpConfig.cs, UserXp.cs, UserXpGlobal.cs, XpTransaction.cs
    ├── XpRole.cs, XpBoost.cs
    ├── XpAchievement.cs, UserAchievement.cs, XpSeasonal.cs
    ├── XpStoreItem.cs, XpStorePurchase.cs
    ├── DiscordGuildConfig.cs, DiscordLiveAlert.cs
    ├── DiscordAlertMessage.cs, DiscordWelcomeConfig.cs
    └── DiscordSettings.cs
```

## Sobre el usuario

- **AnthonyDeca**, dueño de la plataforma, habla español
- Prefiere hablar antes de codear cuando es algo nuevo/complejo
- Se frustra cuando las cosas no salen bien a la primera — verificar antes de desplegar
- Siempre probar con su cuenta (anthonydeca) y servidores (AnthonyDeca, Somos Pixis)
- Tipea rápido con muchos typos, interpretar la intención
- Acepta recomendaciones técnicas si se le explica bien

## QUÉ NO HACER

- NUNCA agregar "Co-Authored-By", Claude, AI, Anthropic en commits de git
- NUNCA mencionar IA/AI en mensajes de commit
- NUNCA hacer git push sin que el usuario lo pida explícitamente
- NUNCA modificar /root/.credentials.env ni archivos de credenciales
- El JSON serializer de .NET tiene WhenWritingNull — campos nullable no se serializan si son null

## Notas técnicas importantes

- El bot de Discord necesita que su rol esté ARRIBA en la jerarquía para asignar roles
- PostgreSQL usa UTC, pero el usuario está en Lima, Perú (UTC-5) — enviar fechas con DateTimeKind.Utc
- DSharpPlus 4.4.9: MessageCreated necesita intents GuildMessages + MessageContents
- Vite en dev mode: usar `import type { }` para tipos, limpiar cache con `rm -rf node_modules/.vite`
- El campo `excluded_channels` en xp_configs es JSONB — usar `[Column("field", TypeName = "jsonb")]`
- Background services: StoreExpirationService (cada 2min), DiscordAlertPollingService
- Al agregar nuevas props a componentes React: SIEMPRE agregarlas al destructuring de la función también

## Tiers de Decatron (para multiplicadores XP)
- Free: $0 (1x XP)
- Supporter: $5/mo (1.25x XP)
- Premium: $15/mo (1.5x XP)
- Fundador: $25/mo o $100 único (2x XP)
