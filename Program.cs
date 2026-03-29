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
    });

    // Configuration sections
    builder.Services.Configure<TwitchSettings>(builder.Configuration.GetSection("TwitchSettings"));
    builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
    builder.Services.Configure<GachaSettings>(builder.Configuration.GetSection("GachaSettings"));
    builder.Services.Configure<AwsPollySettings>(builder.Configuration.GetSection("AwsPolly"));

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
    builder.Services.AddScoped<ITimerService, TimerService>();
    builder.Services.AddScoped<TimerEventService>();
    builder.Services.AddScoped<IRaffleService, RaffleService>();
    builder.Services.AddScoped<GiveawayService>();
    builder.Services.AddScoped<GoalsService>();
    builder.Services.AddScoped<NowPlayingService>();
    builder.Services.AddScoped<IEventAlertsService, EventAlertsService>();
    builder.Services.AddScoped<ITtsService, TtsService>();
    builder.Services.AddScoped<ITipsService, TipsService>();
    builder.Services.AddScoped<ISupportersService, SupportersService>();
    builder.Services.AddSingleton<IStreamStatusService, StreamStatusService>();
    builder.Services.AddScoped<IWatchTimeTrackingService, WatchTimeTrackingService>();
    builder.Services.AddScoped<IChatActivityService, ChatActivityService>();
    builder.Services.AddScoped<GameSearchService>();
    builder.Services.AddScoped<DatabaseSeeder>();
    builder.Services.AddScoped<Decatron.Core.Services.ModerationService>();
    builder.Services.AddScoped<Decatron.Core.Services.FollowersService>();
    builder.Services.AddScoped<Decatron.Services.GeminiService>();
    builder.Services.AddScoped<Decatron.Services.OpenRouterService>();
    builder.Services.AddScoped<Decatron.Services.AIProviderService>();
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
    builder.Services.AddHostedService<NowPlayingBackgroundService>(); // Polling Last.fm/Spotify now playing

    // Twitch services
    builder.Services.AddSingleton<TwitchClient>(provider => new TwitchClient());
    builder.Services.AddSingleton<IMessageSender, MessageSenderService>();
    builder.Services.AddSingleton<TwitchApiService>();
    builder.Services.AddSingleton<ClipDownloadService>();
    builder.Services.AddSingleton<TwitchBotService>();
    builder.Services.AddSingleton<Lazy<TwitchBotService>>(provider =>
        new Lazy<TwitchBotService>(() => provider.GetRequiredService<TwitchBotService>()));
    builder.Services.AddSingleton<CommandService>();
    builder.Services.AddSingleton<Decatron.Scripting.Services.ScriptingService>();
    builder.Services.AddHttpClient<EventSubService>();

    var app = builder.Build();

    // Configure pipeline
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseHttpsRedirection();

    // Servir archivos estáticos desde ClientApp/public/downloads para clips
    var downloadsPath = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp", "public", "downloads");
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

    app.UseCors("AllowReact");
    app.UseSession();
    app.UseAuthentication(); // CRITICAL: Debe estar ANTES de UseAuthorization
    app.UseMiddleware<GlobalExceptionMiddleware>();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHub<Decatron.Hubs.OverlayHub>("/hubs/overlay");

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