namespace Decatron.Services.DiscordServer;

/// <summary>
/// Vista previa: compara la plantilla con el estado real del servidor y dice QUÉ se haría, sin tocar nada. Reglas:
/// solo crea y completa (nunca borra ni renombra); lo que ya existe con el mismo nombre se enlaza sin modificarlo; lo que se creó
/// antes se reconoce por su vínculo aunque lo hayan renombrado. Las mismas decisiones las usa luego <see cref="ServerTemplateApplier"/>.
/// </summary>
public static class ServerTemplatePlanner
{
    public static readonly string[] SeedLanguages = { "es", "en" };   // la versión autoritativa de las reglas va primero

    // ---------------------------------------------------------------- tipos de Discord
    public static int DiscordType(string t) => t switch { "text" => 0, "voice" => 2, "announcement" => 5, "stage" => 13, "forum" => 15, _ => 0 };
    public static bool NeedsCommunityHard(string t) => t is "forum" or "stage";

    public static string ObjKey(string kind, string key) => $"{kind}:{key}";
    private static bool Eq(string a, string b) => string.Equals(a?.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);

    public static bool HasCommunity(GuildInfo g) => g.Features.Contains("COMMUNITY");
    public static bool HasNews(GuildInfo g) => g.Features.Contains("COMMUNITY") || g.Features.Contains("NEWS");

    // ---------------------------------------------------------------- resolución de lo existente
    public static string? ResolveRole(ServerTemplate t, ServerSnapshot s, RoleDef r, out bool byName)
    {
        byName = false;
        if (s.Bindings.TryGetValue(ObjKey("role", r.Key), out var id) && s.Roles.Any(x => x.Id == id)) return id;
        if (r.Existing)
        {
            var bot = s.Roles.FirstOrDefault(x => x.Managed && s.Bot.RoleIds.Contains(x.Id));
            byName = bot != null;
            return bot?.Id;
        }
        var match = s.Roles.FirstOrDefault(x => !x.Managed && x.Id != s.Guild.Id && Eq(x.Name, r.Name));
        byName = match != null;
        return match?.Id;
    }

    public static string? ResolveCategory(ServerSnapshot s, CategoryDef c, out bool byName)
    {
        byName = false;
        if (s.Bindings.TryGetValue(ObjKey("category", c.Key), out var id) && s.Channels.Any(x => x.Id == id)) return id;
        var match = s.Channels.FirstOrDefault(x => x.Type == 4 && Eq(x.Name, c.Name));
        byName = match != null;
        return match?.Id;
    }

    public static string? ResolveChannel(ServerSnapshot s, ChannelDef ch, string? parentId, out bool byName, out ChannelInfo? found)
    {
        byName = false; found = null;
        if (s.Bindings.TryGetValue(ObjKey("channel", ch.Key), out var id))
        {
            found = s.Channels.FirstOrDefault(x => x.Id == id);
            if (found != null) return id;
        }
        var want = DiscordType(ch.Type);
        bool Compatible(int type) => type == want || (want is 0 or 5 && type is 0 or 5);
        var candidates = s.Channels.Where(x => x.Type != 4 && Compatible(x.Type) && Eq(x.Name, ch.Name)).ToList();
        var match = candidates.FirstOrDefault(x => parentId != null && x.ParentId == parentId) ?? (parentId == null ? candidates.FirstOrDefault() : null);
        found = match; byName = match != null;
        return match?.Id;
    }

    // ---------------------------------------------------------------- plan
    public static ServerPlan Build(ServerTemplate t, ServerSnapshot s, PlanOptions o)
    {
        var plan = new ServerPlan { GuildId = s.Guild.Id, GuildName = s.Guild.Name, TemplateKey = t.Template.Key, TemplateVersion = t.Template.Version };
        var seq = 0;
        PlanItem Add(string phase, string kind, string key, string name, string op, string code, string detail, string? existing = null, params string[] args)
        {
            var it = new PlanItem { Seq = ++seq, Phase = phase, Kind = kind, Key = key, Name = name, Op = op, Code = code, Detail = detail, Args = args, ExistingId = existing,
                                    ObjectKey = kind is "role" or "category" or "channel" or "message" or "automod" ? ObjKey(kind, key) : "" };
            plan.Items.Add(it); return it;
        }

        var botPerms = s.BotPermissions();
        var isAdmin = s.BotIsAdmin;
        var canRoles = s.BotHas(DiscordPermissionBits.ManageRoles);
        var canChannels = s.BotHas(DiscordPermissionBits.ManageChannels);
        var canGuild = s.BotHas(DiscordPermissionBits.ManageGuild);

        // ---- 0. el bot y el servidor
        var missing = new List<string>();
        if (!canRoles) missing.Add("MANAGE_ROLES");
        if (!canChannels) missing.Add("MANAGE_CHANNELS");
        if ((o.ApplyGuildSettings || o.ApplyAutomod || o.EnableCommunity) && !canGuild) missing.Add("MANAGE_GUILD");
        if (o.EnableCommunity && !isAdmin) missing.Add("ADMINISTRATOR");
        if (missing.Count > 0)
            Add("bot", "bot", "permissions", "Bot", PlanOp.Warn, "bot.missing_perm", $"Al bot le faltan permisos: {string.Join(", ", missing)}", null, string.Join(", ", missing));
        if (!Eq(s.Guild.Name, t.Guild.Name))
            Add("bot", "guild", "name", s.Guild.Name, PlanOp.Warn, "guild.name_differs", $"El servidor se llama «{s.Guild.Name}» y la plantilla es de «{t.Guild.Name}» (no se renombra)", null, s.Guild.Name, t.Guild.Name);

        // ---- 1. ajustes del servidor (opcional: cambia ajustes existentes)
        if (o.ApplyGuildSettings)
        {
            void Setting(string field, int current, int wanted, string wantedLabel)
            {
                Add("guild", "guild", field, field, current == wanted ? PlanOp.Skip : (canGuild ? PlanOp.Update : PlanOp.Blocked),
                    current == wanted ? "guild.setting_ok" : "guild.setting", $"{field}: {current} → {wanted} ({wantedLabel})", null, field, current.ToString(), wanted.ToString());
            }
            Setting("verification_level", s.Guild.VerificationLevel, VerificationLevelOf(t.Guild.VerificationLevel), t.Guild.VerificationLevel);
            Setting("explicit_content_filter", s.Guild.ExplicitContentFilter, ContentFilterOf(t.Guild.ExplicitContentFilter), t.Guild.ExplicitContentFilter);
            Setting("default_message_notifications", s.Guild.DefaultMessageNotifications, NotificationsOf(t.Guild.DefaultMessageNotifications), t.Guild.DefaultMessageNotifications);
        }

        // ---- 2. roles (en el orden de la plantilla)
        var roleIds = new Dictionary<string, string?>();   // clave → id real o null si se creará
        var enabledRoles = t.Roles.Where(r => r.Enabled).ToList();
        foreach (var r in enabledRoles)
        {
            var id = ResolveRole(t, s, r, out var byName);
            roleIds[r.Key] = id;
            if (id != null)
                Add("roles", "role", r.Key, r.Name, byName ? PlanOp.Adopt : PlanOp.Skip, byName ? "role.adopt" : "role.exists", byName ? "Ya existe con ese nombre: se enlaza sin tocarlo" : "Ya creado", id);
            else if (r.Existing)
                Add("roles", "role", r.Key, r.Name, PlanOp.Warn, "role.bot_not_found", "No se encontró el rol del bot: invita al bot y vuelve a ver la vista previa");
            else if (!canRoles)
                Add("roles", "role", r.Key, r.Name, PlanOp.Blocked, "role.blocked_perm", "El bot no tiene permiso para gestionar roles");
            else
            {
                var want = DiscordPermissionBits.Combine(r.Permissions, t.Permissions);
                var got = DiscordPermissionBits.Grantable(want, botPerms);
                if (got != want)
                {
                    var lost = string.Join(", ", DiscordPermissionBits.Names(want & ~got));
                    Add("roles", "role", r.Key, r.Name, PlanOp.Create, "role.create_limited", $"Se crea sin: {lost} (el bot no los tiene)", null, lost);
                }
                else
                    Add("roles", "role", r.Key, r.Name, PlanOp.Create, "role.create", $"Color {r.Style.Color ?? r.FallbackColor ?? "—"}, {DiscordPermissionBits.Names(want).Count()} permisos", null, r.Style.Color ?? r.FallbackColor ?? "—");
            }
        }
        if (plan.Items.Any(i => i.Kind == "role" && i.Op == PlanOp.Create))
        {
            var hasBotRole = s.Roles.Any(r => s.Bot.RoleIds.Contains(r.Id));
            Add("roles", "role", "__order", "Orden de los roles", hasBotRole && canRoles ? PlanOp.Update : PlanOp.Warn,
                hasBotRole ? "role.order" : "role.order_unknown", "Se colocan justo debajo del rol del bot, en el orden de la plantilla");
        }

        // ---- 3. categorías y canales: primero lo que se puede crear ya; luego (tras Comunidad) foros, escenarios y anuncios
        var willEnableCommunity = o.EnableCommunity && t.Guild.Community.Enabled && !HasCommunity(s.Guild) && isAdmin && canGuild;
        var communityNow = HasCommunity(s.Guild);
        var chanIds = new Dictionary<string, string?>();   // clave de categoría/canal → id real o null
        var enabledCats = t.Categories.Where(c => c.Enabled).ToList();

        var foundInfo = new Dictionary<string, ChannelInfo?>();
        var needsConvert = new List<string>();   // anuncios que están (o nacen) como texto: se convierten tras fijar los canales de Comunidad
        // Pasada A: categorías y todo lo que ya se puede crear. Los anuncios, sin Comunidad, nacen como texto.
        foreach (var c in enabledCats)
        {
            var catExisting = ResolveCategory(s, c, out var catByName);
            chanIds[c.Key] = catExisting;
            if (catExisting != null) Add("channels", "category", c.Key, c.Name, catByName ? PlanOp.Adopt : PlanOp.Skip, catByName ? "channel.adopt" : "channel.exists", catByName ? "Ya existe con ese nombre: se enlaza sin tocarlo" : "Ya creada", catExisting);
            else if (!canChannels) Add("channels", "category", c.Key, c.Name, PlanOp.Blocked, "channel.blocked_perm", "El bot no tiene permiso para gestionar canales");
            else Add("channels", "category", c.Key, c.Name, PlanOp.Create, "category.create", "Se crea con sus permisos de visibilidad");

            foreach (var ch in c.Channels)
            {
                var hard = NeedsCommunityHard(ch.Type);
                var soft = ch.Type == "announcement";
                var existingId = ResolveChannel(s, ch, catExisting, out var byName, out var found);
                chanIds[ch.Key] = existingId; foundInfo[ch.Key] = found;

                if (existingId != null)
                {
                    if (soft && found != null && found.Type == 0) needsConvert.Add(ch.Key);
                    Add("channels", "channel", ch.Key, ch.Name, byName ? PlanOp.Adopt : PlanOp.Skip, byName ? "channel.adopt" : "channel.exists", byName ? "Ya existe con ese nombre: se enlaza sin tocarlo" : "Ya creado", existingId);
                }
                else if (!canChannels) Add("channels", "channel", ch.Key, ch.Name, PlanOp.Blocked, "channel.blocked_perm", "El bot no tiene permiso para gestionar canales");
                else if (hard && !communityNow)
                {
                    if (!willEnableCommunity)
                        Add("channels", "channel", ch.Key, ch.Name, PlanOp.Blocked, "channel.blocked_community", $"Un canal de tipo {ch.Type} necesita Comunidad: actívala y vuelve a cargar");
                    // si se va a activar Comunidad, se crea en la pasada B
                }
                else if (soft && !communityNow)
                {
                    needsConvert.Add(ch.Key);
                    Add("channels", "channel", ch.Key, ch.Name, PlanOp.Create, "channel.create_as_text", "Se crea como texto y se convierte en anuncios al activar Comunidad");
                }
                else
                    Add("channels", "channel", ch.Key, ch.Name, PlanOp.Create, $"channel.create_{ch.Type}", $"Se crea ({ch.Type})", null, ch.Type);
            }
        }

        // ---- 4. Comunidad
        // Si Comunidad ya está activa y un canal que hay que convertir a anuncios es hoy el de reglas, el de novedades o el de alertas de
        // seguridad, hay que reasignar esos canales ANTES (Discord exige que sean de texto): se hace aunque no se haya marcado «Activar Comunidad»
        bool IsCommunityChannel(string? id) => id != null && (id == s.Guild.RulesChannelId || id == s.Guild.PublicUpdatesChannelId || id == s.Guild.SafetyAlertsChannelId);
        var conflict = communityNow && needsConvert.Any(k => IsCommunityChannel(chanIds.TryGetValue(k, out var cid) ? cid : null));
        if (t.Guild.Community.Enabled && (o.EnableCommunity || conflict))
        {
            if (HasCommunity(s.Guild))
            {
                // Los canales de Comunidad deben ser de texto: si apuntan a otro (p. ej. el de anuncios), se reasignan
                chanIds.TryGetValue(t.Guild.Community.RulesChannel, out var wantRules);
                chanIds.TryGetValue(t.Guild.Community.UpdatesChannel, out var wantUpdates);
                chanIds.TryGetValue(t.Guild.Community.SafetyAlertsChannel, out var wantSafety);
                var mismatch = wantRules == null || wantUpdates == null || s.Guild.RulesChannelId != wantRules || s.Guild.PublicUpdatesChannelId != wantUpdates
                               || (!string.IsNullOrEmpty(t.Guild.Community.SafetyAlertsChannel) && (wantSafety == null || s.Guild.SafetyAlertsChannelId != wantSafety));
                if (!mismatch) Add("community", "guild", "community", "Comunidad", PlanOp.Skip, "community.exists", "Ya está activada");
                else if (!canGuild) Add("community", "guild", "community", "Comunidad", PlanOp.Blocked, "community.blocked_admin", "Hace falta el permiso Gestionar servidor");
                else Add("community", "guild", "community", "Comunidad", PlanOp.Update, "community.update_channels", $"Los canales de reglas (#{t.Guild.Community.RulesChannel}), de novedades (#{t.Guild.Community.UpdatesChannel}) y de alertas de Comunidad se reasignan");
            }
            else if (!isAdmin || !canGuild)
                Add("community", "guild", "community", "Comunidad", PlanOp.Blocked, "community.blocked_admin", "Activar Comunidad exige que el bot sea Administrador (se lo puedes quitar después)");
            else
                Add("community", "guild", "community", "Comunidad", PlanOp.Update, "community.enable", $"Se activa con reglas en #{t.Guild.Community.RulesChannel} y novedades en #{t.Guild.Community.UpdatesChannel}");
        }
        // Pasada B: con Comunidad (ya activa o recién activada) y los canales de Comunidad fijados, se crean foros y escenarios y los anuncios
        // pasan de texto a anuncios (antes no: un canal que sigue siendo el de reglas/novedades de Comunidad no puede ser de anuncios)
        if (willEnableCommunity || communityNow)
        {
            foreach (var c in enabledCats)
                foreach (var ch in c.Channels)
                {
                    var hard = NeedsCommunityHard(ch.Type);
                    if (hard && willEnableCommunity && chanIds.TryGetValue(ch.Key, out var hid) && hid == null && canChannels)
                        Add("channels2", "channel", ch.Key, ch.Name, PlanOp.Create, $"channel.create_{ch.Type}", $"Se crea ({ch.Type}) una vez activada Comunidad", null, ch.Type);
                    else if (needsConvert.Contains(ch.Key) && canChannels)
                        Add("channels2", "channel", ch.Key, ch.Name, PlanOp.Convert, "channel.convert", "Pasa de texto a canal de anuncios", chanIds.TryGetValue(ch.Key, out var sid) ? sid : null);
                }
        }

        // ---- 5. ajustes que necesitan canales: AFK y canal de sistema
        if (o.ApplyGuildSettings)
        {
            string? Id(string key) => chanIds.TryGetValue(key, out var v) ? v : null;
            if (!string.IsNullOrEmpty(t.Guild.Afk.Channel))
                Add("guild", "guild", "afk", "AFK", s.Guild.AfkChannelId != null && s.Guild.AfkChannelId == Id(t.Guild.Afk.Channel) && s.Guild.AfkTimeout == t.Guild.Afk.TimeoutSeconds ? PlanOp.Skip : (canGuild ? PlanOp.Update : PlanOp.Blocked),
                    "guild.afk", $"Canal AFK #{t.Guild.Afk.Channel}, {t.Guild.Afk.TimeoutSeconds} s", null, t.Guild.Afk.Channel, t.Guild.Afk.TimeoutSeconds.ToString());
            if (!string.IsNullOrEmpty(t.Guild.SystemChannel.Channel))
                Add("guild", "guild", "system", "Canal de sistema", s.Guild.SystemChannelId != null && s.Guild.SystemChannelId == Id(t.Guild.SystemChannel.Channel) && s.Guild.SystemChannelFlags == SystemFlags(t.Guild.SystemChannel) ? PlanOp.Skip : (canGuild ? PlanOp.Update : PlanOp.Blocked),
                    "guild.system", $"Canal de sistema #{t.Guild.SystemChannel.Channel}", null, t.Guild.SystemChannel.Channel);
        }

        // ---- 6. mensajes de arranque (bienvenida, guía, reglas…)
        if (o.PostSeedMessages)
        {
            foreach (var c in enabledCats)
                foreach (var ch in c.Channels)
                {
                    if (string.IsNullOrEmpty(ch.Seed)) continue;
                    var chanOp = plan.Items.LastOrDefault(i => i.Kind == "channel" && i.Key == ch.Key);
                    foreach (var lang in SeedLanguages)
                    {
                        var key = $"{ch.Key}:{lang}";
                        if (s.Bindings.ContainsKey(ObjKey("message", key)))
                            Add("messages", "message", key, $"#{ch.Name} ({lang.ToUpper()})", PlanOp.Skip, "message.exists", "Ya publicado");
                        else if (chanOp == null || chanOp.Op == PlanOp.Blocked)
                            Add("messages", "message", key, $"#{ch.Name} ({lang.ToUpper()})", PlanOp.Blocked, "message.blocked", "El canal todavía no se puede crear");
                        else
                            Add("messages", "message", key, $"#{ch.Name} ({lang.ToUpper()})", PlanOp.Create, "message.create", chanOp.Op is PlanOp.Adopt or PlanOp.Skip ? "Se publica y se fija (el canal ya existía: revisa que no esté duplicado)" : "Se publica y se fija");
                    }
                }
        }

        // ---- 7. AutoMod
        if (o.ApplyAutomod)
        {
            foreach (var a in t.Automod)
            {
                var name = AutomodName(a);
                if (a.Type == "keyword" && a.Patterns.Count == 0)
                    Add("automod", "automod", a.Key, name, PlanOp.Manual, "automod.manual_empty", "Sin palabras todavía: se llena al abrir cada idioma");
                else if (s.AutoModRules.Any(r => Eq(r.Name, name)) || s.Bindings.ContainsKey(ObjKey("automod", a.Key)))
                    Add("automod", "automod", a.Key, name, PlanOp.Skip, "automod.exists", "Ya existe");
                else if (!canGuild)
                    Add("automod", "automod", a.Key, name, PlanOp.Blocked, "automod.blocked", "Hace falta el permiso Gestionar servidor");
                else
                    Add("automod", "automod", a.Key, name, PlanOp.Create, "automod.create", $"Regla de tipo {a.Type}");
            }
        }

        // ---- 8. pasos manuales (lo que la API no permite o hay que revisar)
        if (plan.Items.Any(i => i.Kind == "role" && i.Op == PlanOp.Create && i.Code == "role.create_limited" && i.Key == "team.creator"))
            Add("manual", "manual", "give_admin", "Creator", PlanOp.Manual, "manual.give_admin", "Dale el permiso Administrador al rol Creator a mano (el bot no puede darlo)");
        if (plan.Items.Any(i => i.Kind == "role" && i.Op == PlanOp.Create))
            Add("manual", "manual", "move_roles", "Roles de equipo", PlanOp.Manual, "manual.move_roles", "Arrastra los roles de equipo por encima del rol del bot (el bot no puede ponerlos más arriba que él)");
        Add("manual", "manual", "role_styles", "Estilos de rol", PlanOp.Manual, "manual.role_styles", "Degradado y holográfico (Creator, Fundador, Premium) cuando haya 3 boosts");
        Add("manual", "manual", "onboarding", "Guía de bienvenida (Onboarding)", PlanOp.Manual, "manual.onboarding",
            "Se configura a mano con los valores de la plantilla. Discord exige 7 canales predeterminados visibles para todos y al menos 5 donde @everyone pueda escribir: con canales solo para miembros eso no se cumple todavía");
        Add("manual", "manual", "screening", "Reglas con aceptación", PlanOp.Manual, "manual.screening", "Discord no permite configurarlas por API: se activan a mano con las reglas de la plantilla");
        var i2 = 0;
        foreach (var step in t.ManualSteps) { i2++; Add("manual", "manual", $"step{i2}", $"Paso {i2}", PlanOp.Manual, $"manual.step{i2}", step); }
        return plan;
    }

    public static int VerificationLevelOf(string v) => v switch { "none" => 0, "low" => 1, "medium" => 2, "high" => 3, "very_high" => 4, _ => 2 };
    public static int ContentFilterOf(string v) => v switch { "disabled" => 0, "members_without_roles" => 1, "all_members" => 2, _ => 2 };
    public static int NotificationsOf(string v) => v switch { "all_messages" => 0, _ => 1 };
    public static int SystemFlags(SystemChannelDef d) => (d.SuppressJoinNotifications ? 1 : 0) | (d.SuppressSetupTips ? 4 : 0);
    public static string AutomodName(AutomodDef a) => $"Decatron · {a.Key}";
}
