using Amazon.Polly;
using Amazon.Runtime;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Data.Repositories;
using Decatron.Middleware;
using Decatron.OAuth.Handlers;
using Decatron.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Text;
using TwitchLib.Client;

// CRÍTICO: Forzar que Npgsql trate todos los timestamps como UTC sin conversión de zona horaria
// Esto previene que PostgreSQL con timezone America/Lima convierta automáticamente los DateTime
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Load secrets
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddUserSecrets<Program>(optional: true);
}
builder.Configuration.AddJsonFile("appsettings.Secrets.json", optional: true, reloadOnChange: true);
builder.Configuration.AddJsonFile($"appsettings.Secrets.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .CreateLogger();

builder.Host.UseSerilog();

try
{
    Log.Information("=== DECATRON API STARTUP ===");

    // Add services
    builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });
    builder.Services.AddDistributedMemoryCache();
    builder.Services.AddMemoryCache();
    builder.Services.AddSession(options =>
    {
        options.IdleTimeout = TimeSpan.FromMinutes(30);
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    });
    builder.Services.AddEndpointsApiExplorer();

    // Swagger
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo { Title = "Decatron API", Version = "v1" });
        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "JWT Authorization header using Bearer scheme",
            Name = "Authorization",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.ApiKey,
            Scheme = "Bearer"
        });
        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                },
                new string[] { }
            }
        });
    });

    builder.Services.AddSignalR();
    builder.Services.AddHttpClient();

    // CORS
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowReact", policy =>
        {
            policy.WithOrigins(
                      "http://localhost:5173",
                      "https://twitch.decatron.net",
                      "https://decatron.net",
                      "https://www.decatron.net")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });

        // Milestone 3 del modulo de Torneos — overlays y widget de ranking embebible
        // (fase 12) se sirven en sitios de terceros (OBS, la web de cualquier
        // streamer), asi que necesitan CORS abierto — a diferencia de "AllowReact",
        // sin AllowCredentials (son endpoints publicos sin sesion, no hace falta
        // mandar cookies) y solo aplicado a esos dos endpoints via [EnableCors].
        options.AddPolicy("TournamentEmbed", policy =>
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        });
    });

    // Configuration sections
    builder.Services.Configure<TwitchSettings>(builder.Configuration.GetSection("TwitchSettings"));
    builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
    builder.Services.Configure<GachaSettings>(builder.Configuration.GetSection("GachaSettings"));
    builder.Services.Configure<AwsPollySettings>(builder.Configuration.GetSection("AwsPolly"));
    builder.Services.Configure<Decatron.Core.Settings.EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
    builder.Services.Configure<Decatron.Discord.Models.DiscordSettings>(builder.Configuration.GetSection("DiscordSettings"));
    builder.Services.Configure<KickSettings>(builder.Configuration.GetSection("KickSettings"));
    builder.Services.Configure<Decatron.Core.Settings.WheelOfLuckSettings>(builder.Configuration.GetSection(Decatron.Core.Settings.WheelOfLuckSettings.SectionName));

    // PostgreSQL DbContext
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    if (!string.IsNullOrEmpty(connectionString))
    {
        builder.Services.AddDbContext<DecatronDbContext>(options =>
            options.UseNpgsql(connectionString));
    }

    // JWT Authentication con logging mejorado
    var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>();
    if (jwtSettings != null && !string.IsNullOrEmpty(jwtSettings.SecretKey))
    {
        Log.Information("JWT Configuration loaded successfully");

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(5) // Permite 5 minutos de tolerancia para diferencias de reloj
                };

                // IMPORTANTE: Eventos para debugging JWT
                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = context =>
                    {
                        Log.Error("JWT Authentication FAILED: {ErrorType}", context.Exception.GetType().Name);
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = context =>
                    {
                        var userId = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                        Log.Debug($"JWT Token validated successfully for user: {userId}");
                        return Task.CompletedTask;
                    },
                    OnMessageReceived = context =>
                    {
                        var token = context.Request.Headers["Authorization"].ToString();
                        if (!string.IsNullOrEmpty(token))
                        {
                            Log.Debug("JWT Token received in Authorization header");
                        }
                        else
                        {
                            Log.Warning("No Authorization header received");
                        }
                        return Task.CompletedTask;
                    },
                    OnChallenge = context =>
                    {
                        Log.Warning($"JWT Challenge triggered: {context.Error} - {context.ErrorDescription}");
                        return Task.CompletedTask;
                    }
                };
            })
            // OAuth2 Bearer Token Authentication for Public API
            .AddScheme<OAuthBearerOptions, OAuthBearerHandler>(
                OAuthBearerOptions.SchemeName,
                options => { }
            );

        Log.Information("OAuth2 Bearer authentication scheme configured");
    }
    else
    {
        Log.Fatal("JWT Settings NOT configured properly!");
        throw new InvalidOperationException("JWT Settings are required");
    }

    builder.Services.AddAuthorization();

    // Rate limit para el endpoint de imagenes del TCG — plan seccion 11: un patron de
    // pedidos masivos en poco tiempo (script, no navegador humano) se corta antes de
    // poder scrapear el catalogo de arte.
    builder.Services.AddRateLimiter(options =>
    {
        // 429 y no el 503 por defecto: 503 dice "el servidor se cayó" y en la consola
        // del navegador se lee como una falla nuestra, cuando en realidad es un límite.
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        options.AddPolicy("tcg-images", context =>
        {
            // El endpoint de imágenes es anónimo a propósito (un <img> no manda el
            // Bearer), así que no hay usuario del cual partir: la clave sale de la IP.
            //
            // Y esa IP hay que sacarla de X-Forwarded-For, no de la conexión: detrás de
            // nginx, RemoteIpAddress es siempre 127.0.0.1, con lo cual TODOS los
            // jugadores caían en la misma partición y compartían un único cupo global.
            // Eso es lo que hacía que las imágenes fallaran "a veces" sin patrón.
            var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
            var clientIp = string.IsNullOrWhiteSpace(forwarded)
                ? context.Connection.RemoteIpAddress?.ToString()
                : forwarded.Split(',')[0].Trim();

            return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: clientIp ?? "anon",
                factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
                {
                    Window = TimeSpan.FromMinutes(1),
                    // Una página del catálogo son 30 imágenes y la colección 24: con 120
                    // alcanzaba con navegar un rato para toparse con el límite. Esto es
                    // un freno contra abuso, no un presupuesto de navegación — y de todas
                    // formas la protección real del catálogo es la firma de la URL, que
                    // impide pedir una imagen sin haberla obtenido antes por la API.
                    PermitLimit = 600,
                    QueueLimit = 0,
                });
        });

        // Milestone 2 del modulo de Torneos — inscripcion (ahora requiere sesion
        // propia, TournamentMeController) + vinculacion/verificacion de Riot. Se
        // mantiene el mismo criterio de particion-por-IP (detras de nginx) que
        // "tcg-images" aunque ya no sea anonimo — sigue siendo un freno util contra
        // scripts que reintentan Riot IDs en loop. Ver
        // .dev/torneos/05-inscripciones-checkin-verificacion.md #5 y
        // .dev/torneos/07-disputas-legal-antiabuso.md #4.
        options.AddPolicy("tournament-register", context =>
        {
            var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
            var clientIp = string.IsNullOrWhiteSpace(forwarded)
                ? context.Connection.RemoteIpAddress?.ToString()
                : forwarded.Split(',')[0].Trim();

            return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: clientIp ?? "anon",
                factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
                {
                    Window = TimeSpan.FromMinutes(10),
                    // Inscribirse es una accion rara por IP — 5 intentos en 10 min alcanza
                    // de sobra para alguien real que se equivoca de Riot ID un par de veces.
                    PermitLimit = 5,
                    QueueLimit = 0,
                });
        });

        // Widget de ranking embebible (fase 12 #2) — mas laxo que el form de
        // inscripcion (es solo lectura, cacheable), pero presente: es un endpoint
        // publico sin auth, no se deja sin ningun freno.
        options.AddPolicy("tournament-embed", context =>
        {
            var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
            var clientIp = string.IsNullOrWhiteSpace(forwarded)
                ? context.Connection.RemoteIpAddress?.ToString()
                : forwarded.Split(',')[0].Trim();

            return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: clientIp ?? "anon",
                factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
                {
                    Window = TimeSpan.FromMinutes(1),
                    PermitLimit = 60,
                    QueueLimit = 0,
                });
        });

        // Traducción en vivo: la extensión consulta el estado de un canal (anónimo) y la
        // app de escritorio canjea códigos de vinculación (anónimo, y adivinable por
        // fuerza bruta si no se frena: 32^8 combinaciones pero igual).
        options.AddPolicy("live-translation-public", context =>
        {
            var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
            var clientIp = string.IsNullOrWhiteSpace(forwarded)
                ? context.Connection.RemoteIpAddress?.ToString()
                : forwarded.Split(',')[0].Trim();
            return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: clientIp ?? "anon",
                factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
                {
                    Window = TimeSpan.FromMinutes(1),
                    PermitLimit = 60,
                    QueueLimit = 0,
                });
        });
        options.AddPolicy("live-translation-claim", context =>
        {
            var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
            var clientIp = string.IsNullOrWhiteSpace(forwarded)
                ? context.Connection.RemoteIpAddress?.ToString()
                : forwarded.Split(',')[0].Trim();
            return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: clientIp ?? "anon",
                factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
                {
                    Window = TimeSpan.FromMinutes(10),
                    PermitLimit = 10,
                    QueueLimit = 0,
                });
        });
    });

    // Register repositories
    builder.Services.AddScoped<IUserRepository, UserRepository>();
    builder.Services.AddScoped<IBotTokenRepository, BotTokenRepository>();

    // Register services
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<IOAuthService, OAuthService>(); // OAuth2 for Public API
    builder.Services.AddScoped<ISettingsService, SettingsService>();
    builder.Services.AddScoped<IPermissionService, PermissionService>();
    builder.Services.AddScoped<ILanguageService, LanguageService>();
    builder.Services.AddScoped<ICommandTranslationService, CommandTranslationService>();
    builder.Services.AddScoped<ICommandMessagesService, CommandMessagesService>();
    builder.Services.AddScoped<IBotTokenRefreshService, BotTokenRefreshService>();
    builder.Services.AddScoped<IUserTokenRefreshService, UserTokenRefreshService>();
    builder.Services.AddScoped<IKickTokenRefreshService, KickTokenRefreshService>();
    builder.Services.AddScoped<IKickEventSubService, Decatron.Services.Platforms.Kick.KickEventSubService>();
    builder.Services.AddScoped<IKickApiService, Decatron.Services.Platforms.Kick.KickApiService>();
    builder.Services.AddScoped<ISoundAlertTriggerService, Decatron.Services.SoundAlertTriggerService>();
    builder.Services.AddSingleton<Decatron.Services.Platforms.Kick.KickOAuthClient>();
    builder.Services.AddScoped<ITimerService, TimerService>();
    builder.Services.AddScoped<TimerEventService>();
    builder.Services.AddScoped<IRaffleService, RaffleService>();
    builder.Services.AddScoped<IGachaService, GachaService>();
    builder.Services.AddScoped<IFortniteService, FortniteService>();
    builder.Services.AddScoped<ISpiritNotificationDeliveryService, SpiritNotificationDeliveryService>();
    builder.Services.AddScoped<GiveawayService>();
    builder.Services.AddScoped<GoalsService>();
    builder.Services.AddScoped<WheelWalletService>();
    builder.Services.AddScoped<WheelService>();
    builder.Services.AddScoped<WheelRaffleService>();
    builder.Services.AddScoped<NowPlayingService>();
    builder.Services.AddScoped<IEventAlertsService, EventAlertsService>();
    builder.Services.AddScoped<ITtsService, TtsService>();

    // Piper: síntesis auto-alojada, el motor del nivel gratuito.
    // Comparte el mismo directorio de caché que el TTS de pago, así se sirve igual.
    builder.Services.AddScoped(sp => new PiperTtsService(
        sp.GetRequiredService<ILogger<PiperTtsService>>(),
        builder.Configuration["TtsSettings:CachePath"] ?? "/var/www/html/decatron/tts-cache"));
    // Catálogo de voces de Polly. Singleton: la lista es la misma para todo el mundo y
    // se cachea un día, así que no tiene sentido reconstruirlo por petición.
    builder.Services.AddSingleton<PollyVoiceCatalogService>();
    builder.Services.AddSingleton<Decatron.Services.Pets.PetCatalogService>(); // Mascotas: catálogo de pets-assets/ + URLs firmadas

    // Radiografía del propio repositorio para /admin. Singleton porque cachea el
    // resultado y la raíz no cambia mientras el proceso viva.
    builder.Services.AddSingleton(sp => new ProjectAnalysisService(
        sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>(),
        sp.GetRequiredService<ILogger<ProjectAnalysisService>>(),
        builder.Environment.ContentRootPath));

    builder.Services.AddScoped<ISpeakChatService, SpeakChatService>();
    builder.Services.AddScoped<ITtsCreditService, TtsCreditService>();
    builder.Services.AddScoped<Decatron.Services.Finance.FinanceService>();
    builder.Services.AddSingleton<Decatron.Services.Finance.ExchangeRate>();
    builder.Services.AddSingleton<Decatron.Services.Finance.CreditRates>();
    builder.Services.AddScoped<ITipsService, TipsService>();
    builder.Services.AddScoped<ISupportersService, SupportersService>();
    builder.Services.AddScoped<ISupporterInvoiceService, SupporterInvoiceService>();
    builder.Services.AddScoped<ICoinInvoiceService, CoinInvoiceService>();
    builder.Services.AddScoped<IPaymentModeService, PaymentModeService>();
    builder.Services.AddScoped<IBillingProfileService, BillingProfileService>();
    builder.Services.AddSingleton<IStreamStatusService, StreamStatusService>();

    // Traducción en vivo (doblaje por espectador) — .dev/plans/REALTIME_TRANSLATION_PLAN.md
    builder.Services.Configure<Decatron.Services.LiveTranslation.LiveTranslationOptions>(
        builder.Configuration.GetSection(Decatron.Services.LiveTranslation.LiveTranslationOptions.Section));
    builder.Services.AddSingleton<Decatron.Services.LiveTranslation.LiveTranslator>();
    builder.Services.AddSingleton<Decatron.Services.LiveTranslation.ITranslationTtsEngine, Decatron.Services.LiveTranslation.DeepgramAuraTtsEngine>();
    builder.Services.AddSingleton<Decatron.Services.LiveTranslation.ITranslationTtsEngine, Decatron.Services.LiveTranslation.FishAudioTtsEngine>();
    builder.Services.AddSingleton<Decatron.Services.LiveTranslation.ITranslationTtsEngine, Decatron.Services.LiveTranslation.PiperTranslationTtsEngine>();
    builder.Services.AddSingleton<Decatron.Services.LiveTranslation.LiveTranslationSessionManager>();
    builder.Services.AddSingleton<Decatron.Hubs.ITranslationListenerNotifier>(sp =>
        sp.GetRequiredService<Decatron.Services.LiveTranslation.LiveTranslationSessionManager>());
    builder.Services.AddSingleton<Decatron.Services.Desktop.IDesktopChannel, Decatron.Services.LiveTranslation.TranslationDesktopChannel>();
    // Coach de LoL (fase 1: el Desktop lee el cliente de LoL y el overlay lo muestra al instante). Plan: .dev/plans/LOL_COACH_PLAN.md
    builder.Services.AddSingleton<Decatron.Services.GameData.LolLive.LolLiveStateStore>();
    builder.Services.AddSingleton<Decatron.Services.GameData.LolLive.LolStaticNames>();
    builder.Services.AddSingleton<Decatron.Services.GameData.LolLive.LolLobbyScoutService>();
    builder.Services.AddSingleton<Decatron.Services.GameData.LolLive.LolCoachBrain>();
    builder.Services.AddSingleton<Decatron.Services.GameData.LolLive.LolCoachVoice>();
    builder.Services.AddSingleton<Decatron.Services.GameData.LolLive.LolHistoryService>();
    builder.Services.AddSingleton<Decatron.Services.GameData.LolLive.LolPredictionService>();
    builder.Services.AddSingleton<Decatron.Services.Desktop.IDesktopChannel, Decatron.Services.GameData.LolLive.LolCoachDesktopChannel>();
    // Song Request fase 5: descargas en Decatron Desktop. Una sola instancia: el canal y la API comparten estado
    builder.Services.AddSingleton<Decatron.Services.SongRequest.DownloadsDesktopChannel>();
    builder.Services.AddSingleton<Decatron.Services.Desktop.IDesktopChannel>(sp => sp.GetRequiredService<Decatron.Services.SongRequest.DownloadsDesktopChannel>());
    builder.Services.AddSingleton<Decatron.Services.Desktop.DesktopConnectionRegistry>();

    // Decatron Desktop (app de escritorio; la traducción en vivo es su primer módulo)
    builder.Services.Configure<Decatron.Services.Desktop.DesktopOptions>(
        builder.Configuration.GetSection(Decatron.Services.Desktop.DesktopOptions.Section));
    builder.Services.AddScoped<Decatron.Services.Desktop.DesktopDeviceService>();
    builder.Services.AddScoped<IWatchTimeTrackingService, WatchTimeTrackingService>();
    builder.Services.AddScoped<IChatActivityService, ChatActivityService>();
    builder.Services.AddScoped<GameSearchService>();
    builder.Services.AddScoped<DatabaseSeeder>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.BannedWordsFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.LinkFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.CapsFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.SymbolsFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.EmotesFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.LengthFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.RepetitionFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.CopypastaFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.ZalgoFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.MentionsFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.AccountAgeFilter>();
    builder.Services.AddScoped<Decatron.Core.Services.Moderation.IModerationFilter, Decatron.Core.Services.Moderation.BotPhrasesFilter>();
    builder.Services.AddSingleton<Decatron.Core.Services.Moderation.IAccountAgeProvider, Decatron.Services.Moderation.AccountAgeProvider>();
    builder.Services.AddScoped<Decatron.Services.Moderation.PanicModeService>();
    builder.Services.AddScoped<Decatron.Services.Moderation.ChatModeratorFactory>();
    builder.Services.AddHostedService<Decatron.Services.Moderation.PanicModeBackgroundService>();
    builder.Services.AddScoped<Decatron.Core.Services.ModerationService>();
    builder.Services.AddScoped<Decatron.Core.Services.FollowersService>();
    // IA unificada: cache de config/precios, registro de uso y cliente OpenRouter (singletons).
    // Plan: .dev/plans/AI_OPENROUTER_UNIFICACION_PLAN.md
    builder.Services.AddSingleton<Decatron.Services.AI.AiSettingsCache>();
    builder.Services.AddSingleton<Decatron.Services.AI.AiCreditGate>();
    builder.Services.AddSingleton<Decatron.Services.AI.AiUsageRecorder>();
    builder.Services.AddSingleton<Decatron.Services.AI.OpenRouterClient>();
    builder.Services.AddSingleton<Decatron.Services.AI.GeminiChatClient>();
    builder.Services.AddScoped<Decatron.Services.GeminiService>();
    builder.Services.AddScoped<Decatron.Services.OpenRouterService>();
    builder.Services.AddScoped<Decatron.Services.AIProviderService>();
    builder.Services.AddScoped<Decatron.Services.CoinService>();
    builder.Services.AddScoped<Decatron.Services.TcgCardsService>();
    builder.Services.AddSingleton<Decatron.Services.TcgImageSigningService>();
    builder.Services.AddScoped<Decatron.Services.EmailService>();
    builder.Services.AddScoped<Decatron.Services.UsernameUpdateService>();
    builder.Services.AddSingleton<ICommandStateService, CommandStateService>();
    builder.Services.AddSingleton<OverlayNotificationService>();

    // AWS Polly client
    var pollySettings = builder.Configuration.GetSection("AwsPolly").Get<AwsPollySettings>();
    if (pollySettings != null && !string.IsNullOrEmpty(pollySettings.AccessKeyId))
    {
        var awsCredentials = new BasicAWSCredentials(pollySettings.AccessKeyId, pollySettings.SecretAccessKey);
        var awsRegion = Amazon.RegionEndpoint.GetBySystemName(pollySettings.Region);
        builder.Services.AddSingleton(new AmazonPollyClient(awsCredentials, awsRegion));
        Log.Information("AWS Polly client configured for region {Region}", pollySettings.Region);
    }
    else
    {
        Log.Warning("AWS Polly settings not configured — TTS will not work");
        builder.Services.AddSingleton(new AmazonPollyClient(new Amazon.Runtime.AnonymousAWSCredentials(), Amazon.RegionEndpoint.USEast1));
    }

    // Register variable system functions
    builder.Services.AddScoped<Decatron.Core.Functions.CounterFunction>();
    builder.Services.AddScoped<Decatron.Core.Functions.UsesFunction>();
    builder.Services.AddScoped<Decatron.Core.Functions.GameFunction>();
    builder.Services.AddScoped<Decatron.Core.Functions.UptimeFunction>();
    builder.Services.AddScoped<Decatron.Core.Functions.UserFunction>();
    builder.Services.AddScoped<Decatron.Core.Functions.UtilityVariables>();
    builder.Services.AddScoped<Decatron.Core.Functions.TwitchInfoVariables>();
    builder.Services.AddScoped<Decatron.Core.Resolvers.VariableResolver>();

    // Register background services
    builder.Services.AddHostedService<BotTokenRefreshBackgroundService>();
    builder.Services.AddHostedService<UserTokenRefreshBackgroundService>();
    builder.Services.AddHostedService<GameCacheUpdateService>();
    builder.Services.AddHostedService<TimerBackgroundService>();
    builder.Services.AddHostedService<EventSubBackgroundService>();
    builder.Services.AddHostedService<TimerStateRestorationService>(); // Restaura timers al iniciar
    builder.Services.AddHostedService<GiveawayBackgroundService>(); // Monitorea timeouts de giveaways
    builder.Services.AddHostedService<WatchTimeBackgroundService>(); // Actualiza watch times cada minuto
    builder.Services.AddHostedService<WatchtimeLurkerTrackingService>(); // Trackea lurkers vía polling de chatters
    builder.Services.AddHostedService<HappyHourWatcherService>(); // Avisa al overlay cuando arranca o termina un Happy Hour
    builder.Services.AddHostedService<RuletaBackgroundService>(); // Restaura el mod cuando expira un timeout de !ruleta contra un moderador
    builder.Services.AddHostedService<StreamStatusHydrationService>(); // Hidrata estado en vivo al arrancar (IStreamStatusService es solo en memoria)
    builder.Services.AddHostedService<NowPlayingBackgroundService>(); // Polling Last.fm/Spotify now playing
    builder.Services.AddHostedService<UsernameCheckBackgroundService>(); // Check Twitch username changes every 24h
    builder.Services.AddHostedService<SupporterInvoiceBackgroundService>(); // Emite los comprobantes de compras de tier y de DecaCoins
    builder.Services.AddHostedService<Decatron.Services.Tournament.TournamentRiotPollingService>(); // Torneos Milestone 0 — poller de Riot API, solo modo solo_q_climb
    builder.Services.AddHostedService<SpiritNotifySweepBackgroundService>(); // Barrido cada 15min de avisos de Fortnite Spirits (Twitch chat + Discord DM)

    // Twitch services
    builder.Services.AddSingleton<TwitchClient>(provider => new TwitchClient());
    // MessageSenderService ya no se registra directo como IMessageSender: con Kick
    // real ademas de Twitch, algo tiene que decidir a cual mandar cada mensaje.
    // Ver Decatron.Services.Platforms.MessageSenderRouter y el plan de
    // unificacion, seccion 8.8.
    builder.Services.AddSingleton<MessageSenderService>();
    builder.Services.AddSingleton<Decatron.Services.Platforms.Kick.KickConnector>();
    builder.Services.AddSingleton<IMessageSender, Decatron.Services.Platforms.MessageSenderRouter>();
    builder.Services.AddSingleton<TwitchApiService>();
    builder.Services.AddSingleton<ClipDownloadService>();
    builder.Services.AddSingleton<TwitchBotService>();
    builder.Services.AddSingleton<Lazy<TwitchBotService>>(provider =>
        new Lazy<TwitchBotService>(() => provider.GetRequiredService<TwitchBotService>()));
    builder.Services.AddSingleton<CommandService>();
    builder.Services.AddSingleton<Decatron.Scripting.Services.ScriptingService>();
    builder.Services.AddHttpClient<EventSubService>();
    // Modulo de Torneos (Milestone 0) — cliente de Riot API, la key la trae cada
    // canal-tenant, ver .dev/torneos/03-riot-api-integracion.md.
    builder.Services.AddHttpClient<Decatron.Services.GameData.Riot.RiotApiClient>();
    builder.Services.AddSingleton<Decatron.Services.GameData.Riot.RiotApiKeys>();
    builder.Services.AddSingleton<Decatron.Services.GameData.Riot.RiotRateLimitGate>();
    // Game Overlays (.dev/plans/GAME_OVERLAYS_PLAN.md) — proveedores por juego +
    // cache compartida + deteccion de juego + sesiones. Agregar un juego = un
    // IGameDataProvider mas en esta lista.
    builder.Services.AddSingleton<Decatron.Services.GameData.GameDataCache>();
    builder.Services.AddSingleton<Decatron.Services.GameData.GameDetectionService>();
    builder.Services.AddSingleton<Decatron.Services.GameData.GameOverlayStateStore>();
    builder.Services.AddScoped<Decatron.Services.GameData.GameSessionService>();
    builder.Services.AddScoped<Decatron.Services.GameData.GameOverlayConfigService>();
    builder.Services.AddScoped<Decatron.Services.GameData.GameOverlayPromoService>();
    builder.Services.AddScoped<Decatron.Services.Brand.BrandService>(); // Logos de la marca editables desde /admin/brand
    // Song Request (.dev/plans/SONG_REQUEST_PLAN.md): un servicio nuevo = registrar su ITrackResolver y/o ITrackSource
    builder.Services.AddSingleton<Decatron.Services.SongRequest.YtDlpRunner>();
    builder.Services.AddSingleton<Decatron.Services.SongRequest.YouTubeTrackSource>();
    builder.Services.AddSingleton<Decatron.Services.SongRequest.ITrackResolver>(sp => sp.GetRequiredService<Decatron.Services.SongRequest.YouTubeTrackSource>());
    builder.Services.AddSingleton<Decatron.Services.SongRequest.ITrackSource>(sp => sp.GetRequiredService<Decatron.Services.SongRequest.YouTubeTrackSource>());
    builder.Services.AddSingleton<Decatron.Services.SongRequest.IPlaylistSource>(sp => sp.GetRequiredService<Decatron.Services.SongRequest.YouTubeTrackSource>());
    builder.Services.AddSingleton<Decatron.Services.SongRequest.ITrackResolver, Decatron.Services.SongRequest.SpotifyTrackResolver>(); // fase 4: links de Spotify → misma canción en YouTube
    builder.Services.AddSingleton<Decatron.Services.SongRequest.ITrackResolver, Decatron.Services.SongRequest.DeezerTrackResolver>(); // fase 6: Deezer y Apple Music, igual que Spotify
    builder.Services.AddSingleton<Decatron.Services.SongRequest.ITrackResolver, Decatron.Services.SongRequest.AppleMusicTrackResolver>();
    builder.Services.AddSingleton<Decatron.Services.SongRequest.SoundCloudTrackSource>(); // fase 6: fuente propia (su reproductor y descarga)
    builder.Services.AddSingleton<Decatron.Services.SongRequest.ITrackResolver>(sp => sp.GetRequiredService<Decatron.Services.SongRequest.SoundCloudTrackSource>());
    builder.Services.AddSingleton<Decatron.Services.SongRequest.ITrackSource>(sp => sp.GetRequiredService<Decatron.Services.SongRequest.SoundCloudTrackSource>());
    builder.Services.AddScoped<Decatron.Services.SongRequest.SongRequestLibraryService>();
    builder.Services.AddScoped<Decatron.Services.SongRequest.SongResolverService>();
    builder.Services.AddScoped<Decatron.Services.SongRequest.SongRequestService>();
    builder.Services.AddSingleton<Decatron.Services.SongRequest.SongRequestChatHandler>();
    builder.Services.AddSingleton<Decatron.Services.SongRequest.SongRequestPlayerRegistry>();
    builder.Services.AddScoped<Decatron.Services.GameData.LiveOverlayService>();
    builder.Services.AddScoped<Decatron.Services.Pets.PetService>(); // Mascotas: config por canal + estímulos al overlay
    builder.Services.AddSingleton<Decatron.Services.Pets.PetEventBridge>(); // Mascotas: alertas, comandos y saludo → mascota
    builder.Services.AddScoped<Decatron.Services.GameData.GameAccountService>();
    builder.Services.AddSingleton<Decatron.Services.GameData.IGameDataProvider, Decatron.Services.GameData.Providers.ManualProvider>();
    builder.Services.AddSingleton<Decatron.Services.GameData.IGameDataProvider, Decatron.Services.GameData.Providers.RiotLolProvider>();
    builder.Services.AddSingleton<Decatron.Services.GameData.GameDataProviderRegistry>();
    builder.Services.AddSingleton<Decatron.Services.GameData.GameDataPollingService>();
    builder.Services.AddHostedService(sp => sp.GetRequiredService<Decatron.Services.GameData.GameDataPollingService>());
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentRiotSyncService>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentBlueShellEngine>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentBlueShellService>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentStandingsService>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentBracketStandingsService>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentPrizeService>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentRegistrationService>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentTeamService>();
    builder.Services.AddScoped<Decatron.Services.Tournament.BracketGenerators.SingleEliminationBracketGenerator>();
    builder.Services.AddScoped<Decatron.Services.Tournament.BracketGenerators.RoundRobinBracketGenerator>();
    builder.Services.AddScoped<Decatron.Services.Tournament.BracketGenerators.DoubleEliminationBracketGenerator>();
    builder.Services.AddScoped<Decatron.Services.Tournament.BracketGenerators.SwissBracketGenerator>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentBracketService>();
    // Condicion de victoria ARAM (Tema 2, 24-08-2026) — detecta cuando se cumple la
    // condicion configurada en la partida real y declara ganador solo en el bracket.
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentWinConditionEngine>();
    builder.Services.AddScoped<Decatron.Services.Tournament.TournamentWinConditionSyncService>();
    // Dispatcher de negocio de EventSub, compartido entre el controller de webhook
    // y EventSubWebSocketService. Scoped porque depende de DecatronDbContext.
    builder.Services.AddScoped<EventSubNotificationHandler>();
    // Transporte WebSocket/Conduit de EventSub (Fase 2.1 del roadmap). Convive con
    // el webhook mientras dura la migración — ver EventSubWebSocketService.
    builder.Services.AddHostedService<EventSubWebSocketService>();

    // Discord services
    builder.Services.AddSingleton<Decatron.Discord.DiscordClientProvider>();
    builder.Services.AddScoped<Decatron.Core.Interfaces.IDiscordDmSender, Decatron.Discord.DiscordDmSender>();
    builder.Services.AddSingleton<Decatron.Discord.Events.LiveAlertHandler>();
    builder.Services.AddSingleton<Decatron.Core.Interfaces.ILiveAlertHandler>(provider =>
        provider.GetRequiredService<Decatron.Discord.Events.LiveAlertHandler>());
    builder.Services.AddSingleton<Decatron.Discord.Events.WelcomeHandler>();
    builder.Services.AddSingleton<Decatron.Discord.WelcomeImageGenerator>();
    builder.Services.AddSingleton<Decatron.Discord.Services.XpBoostService>();
    builder.Services.AddSingleton<Decatron.Discord.Services.AchievementService>();
    builder.Services.AddSingleton<Decatron.Discord.Services.SeasonalService>();
    builder.Services.AddSingleton<Decatron.Discord.Services.XpService>();
    builder.Services.AddSingleton<Decatron.Discord.Services.XpRoleService>();
    builder.Services.AddScoped<Decatron.Discord.RankCardGenerator>();
    builder.Services.AddSingleton<Decatron.Discord.Events.MessageXpHandler>();
    builder.Services.AddHostedService<Decatron.Discord.DiscordBotService>();
    builder.Services.AddHostedService<Decatron.Discord.DiscordAlertPollingService>();
    builder.Services.AddHostedService<Decatron.Discord.Services.StoreExpirationService>();

    var app = builder.Build();

    // Configure pipeline
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseHttpsRedirection();

    // Clips de !so. Fuera de ClientApp/public a propósito: Vite copia todo
    // public/ a dist/ en cada build, y eran 19 GB duplicados en cada compilación.
    // La ruta pública sigue siendo /downloads, así que las URLs guardadas en
    // shoutout_history.clip_local_path siguen siendo válidas.
    var downloadsPath = builder.Configuration["ClipSettings:DownloadsPath"]
                        ?? "/var/www/html/decatron/clips";
    if (Directory.Exists(downloadsPath))
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(downloadsPath),
            RequestPath = "/downloads"
        });
        Log.Information($"Sirviendo archivos de clips desde: {downloadsPath}");
    }
    else
    {
        Log.Warning($"Directorio de downloads no encontrado: {downloadsPath}");
    }

    // Servir archivos de Sound Alerts subidos por usuarios
    var soundAlertsUploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp", "public", "uploads", "soundalerts");
    Directory.CreateDirectory(soundAlertsUploadsPath); // Crear si no existe
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(soundAlertsUploadsPath),
        RequestPath = "/uploads/soundalerts",
    });
    Log.Information($"Sirviendo archivos de Sound Alerts desde: {soundAlertsUploadsPath}");

    // Piezas de la marca subidas desde /admin/brand (fuera del repo y de dist/, igual que los clips)
    // El padre (/var/www/html/decatron) es de root: si la carpeta no existe, crearla falla
    // y eso no puede tirar el backend entero (pasó el 2026-09-24). Sin ella, los lugares
    // que usen piezas subidas vuelven a su diseño de código.
    var brandAssetsPath = builder.Configuration["Brand:AssetsPath"] ?? "/var/www/html/decatron/brand-assets";
    try { Directory.CreateDirectory(brandAssetsPath); }
    catch (Exception ex) { Log.Error(ex, $"No se pudo crear {brandAssetsPath} (crearla con dueño decatron)"); }
    if (Directory.Exists(brandAssetsPath))
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(brandAssetsPath),
            RequestPath = "/uploads/brand",
            // Cada subida tiene nombre único, así que el navegador puede guardarla para siempre.
            OnPrepareResponse = ctx => ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable",
        });
        Log.Information($"Sirviendo piezas de la marca desde: {brandAssetsPath}");
    }

    // Servir archivos de Timer Extensible (media para eventos)
    var timerExtensiblePath = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp", "public", "timerextensible");
    Directory.CreateDirectory(timerExtensiblePath);
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(timerExtensiblePath),
        RequestPath = "/timerextensible",
    });
    Log.Information($"Sirviendo archivos de Timer Extensible desde: {timerExtensiblePath}");

    // Servir archivos de TTS cache
    var ttsCachePath = builder.Configuration["AwsPolly:CachePath"] ?? "/var/www/html/decatron/tts-cache";
    Directory.CreateDirectory(ttsCachePath);
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(ttsCachePath),
        RequestPath = "/tts-audio",
    });
    Log.Information($"Sirviendo archivos de TTS desde: {ttsCachePath}");

    // Servir archivos del sistema desde ClientApp/public/system-files
    var systemFilesPath = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp", "public", "system-files");
    if (Directory.Exists(systemFilesPath))
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(systemFilesPath),
            RequestPath = "/system-files",
        });
        Log.Information($"Sirviendo archivos del sistema desde: {systemFilesPath}");
    }

    // Servir arte de sobres del TCG (packaging, no cartas — no necesita firma, es
    // el mismo arte para todos, no hay catálogo que proteger)
    var tcgPacksPath = builder.Configuration["TcgSettings:ImagesPath"] is string tcgImagesRoot
        ? Path.Combine(tcgImagesRoot, "packs")
        : "/var/www/html/decatron/tcg-card-images/packs";
    if (Directory.Exists(tcgPacksPath))
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(tcgPacksPath),
            RequestPath = "/tcg-packs",
        });
        Log.Information($"Sirviendo arte de sobres TCG desde: {tcgPacksPath}");
    }

    app.UseCors("AllowReact");
    app.UseSession();
    app.UseAuthentication(); // CRITICAL: Debe estar ANTES de UseAuthorization
    app.UseMiddleware<GlobalExceptionMiddleware>();
    app.UseAuthorization();
    app.UseRateLimiter();
    app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });
    app.UseMiddleware<Decatron.Services.Desktop.DesktopWsMiddleware>(); // WS único de Decatron Desktop (todos los módulos)
    app.MapControllers();
    app.MapHub<Decatron.Hubs.OverlayHub>("/hubs/overlay");
    app.MapHub<Decatron.Hubs.TranslationHub>("/hubs/translation"); // extensión del espectador
    app.MapHub<Decatron.Services.SongRequest.SongRequestHub>("/hubs/songrequest"); // song request: reproductor, overlays, dashboard y cola pública

    Log.Information("API ready on https://localhost:7264");
    Log.Information("SignalR Overlay Hub disponible en /hubs/overlay");

    // Seed database with game cache and aliases
    if (!AppDomain.CurrentDomain.FriendlyName.Contains("ef"))
    {
        using (var scope = app.Services.CreateScope())
        {
            try
            {
                var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
                await seeder.SeedGameCacheAndAliasesAsync();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error seeding database");
            }
        }

        // Refresh all tokens on startup
        using (var scope = app.Services.CreateScope())
        {
            try
            {
                var botTokenService = scope.ServiceProvider.GetRequiredService<IBotTokenRefreshService>();
                await botTokenService.RefreshAllTokensOnStartupAsync();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error refreshing tokens on startup");
            }
        }

        // Verificar yt-dlp
        using (var scope = app.Services.CreateScope())
        {
            try
            {
                var clipDownloadService = scope.ServiceProvider.GetRequiredService<ClipDownloadService>();
                var ytDlpInstalled = await clipDownloadService.IsYtDlpInstalledAsync();

                if (!ytDlpInstalled)
                {
                    Log.Warning("⚠️ yt-dlp NO está instalado. El comando !so no podrá descargar clips.");
                    Log.Warning("Instala yt-dlp siguiendo las instrucciones en docs/YT-DLP-SETUP.md");
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error verificando yt-dlp");
            }
        }

        // Start TwitchBot
        var twitchBotService = app.Services.GetRequiredService<TwitchBotService>();
        _ = Task.Run(async () =>
        {
            try
            {
                await twitchBotService.Start();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error starting TwitchBotService");
            }
        });
    }

    // Nombres oficiales de LoL (Data Dragon) listos antes de la primera selección de campeón.
    _ = app.Services.GetRequiredService<Decatron.Services.GameData.LolLive.LolStaticNames>().WarmUpAsync();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}