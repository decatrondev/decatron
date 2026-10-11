using System.Text.RegularExpressions;

namespace Decatron.Services.DiscordServer;

public interface IBindingStore
{
    Task<Dictionary<string, string>> LoadAsync(string guildId, string templateKey);
    Task SaveAsync(string guildId, string templateKey, string objectKey, string discordId);
}

public class ApplyResult
{
    public int Seq { get; set; }
    public string Kind { get; set; } = "";
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string Status { get; set; } = "ok";     // ok | failed | skipped
    public string Message { get; set; } = "";
}

/// <summary>
/// Ejecuta lo que dice la vista previa (<see cref="ServerTemplatePlanner"/>), en el mismo orden. Solo crea y completa: la interfaz
/// <see cref="IDiscordRest"/> no tiene ninguna operación de borrado. Cada objeto creado queda vinculado a su clave de la plantilla.
/// </summary>
public static class ServerTemplateApplier
{
    private const ulong View = DiscordPermissionBits.ViewChannel;

    public static async Task<List<ApplyResult>> ApplyAsync(ServerTemplate t, ServerSnapshot snap, ServerPlan plan, PlanOptions o, IDiscordRest rest,
        IBindingStore store, Action<ApplyResult>? progress = null)
    {
        var results = new List<ApplyResult>();
        var guildId = snap.Guild.Id;
        var ids = new Dictionary<string, string>();     // ObjectKey → id real
        foreach (var it in plan.Items.Where(i => i.ExistingId != null && i.ObjectKey != "")) ids[it.ObjectKey] = it.ExistingId!;
        var createdRoles = new List<string>();          // claves de roles creados, en el orden de la plantilla

        var cats = t.Categories.ToDictionary(c => c.Key);
        var chans = t.Categories.SelectMany(c => c.Channels.Select(ch => (Cat: c, Ch: ch))).ToDictionary(x => x.Ch.Key);
        var roles = t.Roles.ToDictionary(r => r.Key);
        var presentGuild = snap.Guild;

        void Report(PlanItem it, string status, string msg)
        {
            var r = new ApplyResult { Seq = it.Seq, Kind = it.Kind, Key = it.Key, Name = it.Name, Status = status, Message = msg };
            results.Add(r); progress?.Invoke(r);
        }

        foreach (var it in plan.Items)
        {
            if (!PlanOp.IsAction(it.Op)) continue;
            try
            {
                // vincular lo que ya existía
                if (it.Op == PlanOp.Adopt && it.ExistingId != null && it.ObjectKey != "")
                {
                    await store.SaveAsync(guildId, t.Template.Key, it.ObjectKey, it.ExistingId);
                    Report(it, "ok", "Enlazado");
                    continue;
                }

                switch (it.Kind)
                {
                    case "role" when it.Key == "__order":
                        await OrderRolesAsync(t, snap, rest, ids, createdRoles);
                        Report(it, "ok", "Orden aplicado");
                        break;

                    case "role":
                    {
                        var r = roles[it.Key];
                        var want = DiscordPermissionBits.Combine(r.Permissions, t.Permissions);
                        var perms = DiscordPermissionBits.Grantable(want, snap.BotPermissions());
                        var created = await rest.CreateRoleAsync(guildId, new { name = r.Name, permissions = perms.ToString(), color = r.ColorInt(), hoist = r.Hoist, mentionable = r.Mentionable });
                        ids[it.ObjectKey] = created.Id; createdRoles.Add(r.Key);
                        await store.SaveAsync(guildId, t.Template.Key, it.ObjectKey, created.Id);
                        Report(it, "ok", "Creado");
                        break;
                    }

                    case "category":
                    {
                        var c = cats[it.Key];
                        var idx = t.Categories.Where(x => x.Enabled).ToList().IndexOf(c);
                        var created = await rest.CreateChannelAsync(guildId, new { name = c.Name, type = 4, position = idx, permission_overwrites = BuildOverwrites(t, c, null, ids, guildId) });
                        ids[it.ObjectKey] = created.Id;
                        await store.SaveAsync(guildId, t.Template.Key, it.ObjectKey, created.Id);
                        Report(it, "ok", "Creada");
                        break;
                    }

                    case "channel" when it.Op == PlanOp.Convert:
                    {
                        if (!ids.TryGetValue(it.ObjectKey, out var cid)) { Report(it, "failed", "El canal no existe"); break; }
                        await rest.ModifyChannelAsync(cid, new { type = 5 });
                        Report(it, "ok", "Convertido a anuncios");
                        break;
                    }

                    case "channel":
                    {
                        var (cat, ch) = chans[it.Key];
                        if (!ids.TryGetValue(ObjKey("category", cat.Key), out var parentId)) { Report(it, "failed", "La categoría no se creó"); break; }
                        var type = it.Code == "channel.create_as_text" ? 0 : ServerTemplatePlanner.DiscordType(ch.Type);
                        var index = cat.Channels.IndexOf(ch);
                        var body = new Dictionary<string, object?>
                        {
                            ["name"] = ch.Name, ["type"] = type, ["parent_id"] = parentId, ["position"] = index,
                            ["permission_overwrites"] = BuildOverwrites(t, cat, ch, ids, guildId),
                        };
                        var topic = TopicOf(t, ch);
                        if (topic != null && type is 0 or 5 or 15) body["topic"] = topic;
                        if (ch.SlowmodeSeconds is > 0 && type is 0 or 15) body["rate_limit_per_user"] = ch.SlowmodeSeconds;
                        if (type == 15)
                        {
                            body["available_tags"] = ch.Tags.Select(g => new { name = g.Name, moderated = g.Moderated }).ToList();
                            if (ch.RequireTag) body["flags"] = 16;     // REQUIRE_TAG
                        }
                        var created = await rest.CreateChannelAsync(guildId, body);
                        ids[it.ObjectKey] = created.Id;
                        await store.SaveAsync(guildId, t.Template.Key, it.ObjectKey, created.Id);
                        Report(it, "ok", "Creado");
                        break;
                    }

                    case "guild":
                        await ApplyGuildItemAsync(t, snap, it, rest, ids, guildId);
                        Report(it, "ok", "Ajustado");
                        break;

                    case "message":
                    {
                        var parts = it.Key.Split(':');           // canal:idioma
                        if (!ids.TryGetValue(ObjKey("channel", parts[0]), out var channelId)) { Report(it, "failed", "El canal no existe"); break; }
                        var texts = BuildSeedMessages(t, chans[parts[0]].Ch, parts[1], ids);
                        string? first = null;
                        foreach (var text in texts) { var mid = await rest.CreateMessageAsync(channelId, text); first ??= mid; }
                        if (first != null)
                        {
                            try { await rest.PinMessageAsync(channelId, first); } catch (DiscordApiException) { /* sin permiso para fijar: el mensaje ya está */ }
                            await store.SaveAsync(guildId, t.Template.Key, it.ObjectKey, first);
                        }
                        Report(it, "ok", $"Publicado ({texts.Count})");
                        break;
                    }

                    case "automod":
                    {
                        var def = t.Automod.First(a => a.Key == it.Key);
                        var rid = await rest.CreateAutoModRuleAsync(guildId, BuildAutomod(def, ids));
                        await store.SaveAsync(guildId, t.Template.Key, it.ObjectKey, rid);
                        Report(it, "ok", "Creada");
                        break;
                    }

                    default:
                        Report(it, "skipped", "Sin acción");
                        break;
                }
            }
            catch (DiscordApiException ex)
            {
                Report(it, "failed", ex.IsMissingPermissions ? $"Faltan permisos del bot ({ex.Message})" : ex.Message);
            }
            catch (Exception ex)
            {
                Report(it, "failed", ex.Message);
            }
        }
        return results;
    }

    private static string ObjKey(string kind, string key) => $"{kind}:{key}";

    // ---------------------------------------------------------------- orden de los roles
    /// <summary>Coloca los roles creados justo debajo del rol del bot, en el orden de la plantilla (más arriba = más importante).</summary>
    private static async Task OrderRolesAsync(ServerTemplate t, ServerSnapshot snap, IDiscordRest rest, Dictionary<string, string> ids, List<string> created)
    {
        if (created.Count == 0) return;
        // Crear roles empuja hacia arriba a los que ya había (incluido el del bot): hay que leer su posición de ahora, no la de antes
        var current = await rest.GetRolesAsync(snap.Guild.Id);
        var botPos = current.Where(r => snap.Bot.RoleIds.Contains(r.Id)).Select(r => r.Position).DefaultIfEmpty(0).Max();
        if (botPos <= 1) return;
        var ordered = t.Roles.Where(r => created.Contains(r.Key)).ToList();      // ya van en el orden de la plantilla
        var positions = new List<(string Id, int Position)>();
        for (var i = 0; i < ordered.Count; i++)
        {
            if (!ids.TryGetValue(ObjKey("role", ordered[i].Key), out var id)) continue;
            positions.Add((id, Math.Max(1, botPos - 1 - i)));
        }
        if (positions.Count > 0) await rest.SetRolePositionsAsync(snap.Guild.Id, positions);
    }

    // ---------------------------------------------------------------- ajustes del servidor
    private static async Task ApplyGuildItemAsync(ServerTemplate t, ServerSnapshot snap, PlanItem it, IDiscordRest rest, Dictionary<string, string> ids, string guildId)
    {
        switch (it.Key)
        {
            case "verification_level": await rest.ModifyGuildAsync(guildId, new { verification_level = ServerTemplatePlanner.VerificationLevelOf(t.Guild.VerificationLevel) }); break;
            case "explicit_content_filter": await rest.ModifyGuildAsync(guildId, new { explicit_content_filter = ServerTemplatePlanner.ContentFilterOf(t.Guild.ExplicitContentFilter) }); break;
            case "default_message_notifications": await rest.ModifyGuildAsync(guildId, new { default_message_notifications = ServerTemplatePlanner.NotificationsOf(t.Guild.DefaultMessageNotifications) }); break;
            case "community":
            {
                if (!ids.TryGetValue(ObjKey("channel", t.Guild.Community.RulesChannel), out var rules) || !ids.TryGetValue(ObjKey("channel", t.Guild.Community.UpdatesChannel), out var updates))
                    throw new InvalidOperationException("Faltan los canales de reglas o de novedades");
                var features = snap.Guild.Features.Where(f => f != "COMMUNITY").Append("COMMUNITY").ToList();
                await rest.ModifyGuildAsync(guildId, new { features, rules_channel_id = rules, public_updates_channel_id = updates, preferred_locale = t.Guild.PreferredLocale });
                snap.Guild.Features.Add("COMMUNITY");
                break;
            }
            case "afk":
                if (!ids.TryGetValue(ObjKey("channel", t.Guild.Afk.Channel), out var afk)) throw new InvalidOperationException("Falta el canal AFK");
                await rest.ModifyGuildAsync(guildId, new { afk_channel_id = afk, afk_timeout = t.Guild.Afk.TimeoutSeconds });
                break;
            case "system":
                if (!ids.TryGetValue(ObjKey("channel", t.Guild.SystemChannel.Channel), out var sys)) throw new InvalidOperationException("Falta el canal de sistema");
                await rest.ModifyGuildAsync(guildId, new { system_channel_id = sys, system_channel_flags = ServerTemplatePlanner.SystemFlags(t.Guild.SystemChannel) });
                break;
            default: throw new InvalidOperationException($"Ajuste desconocido: {it.Key}");
        }
    }

    // ---------------------------------------------------------------- permisos de canales
    /// <summary>
    /// Permisos EXPLÍCITOS de una categoría o canal (no dependen de «sincronizar con la categoría»):
    /// @everyone solo ve las categorías abiertas (y no escribe); ver lo da la visibilidad (roles y grupos); escribir lo da el preset del
    /// canal a Member, a los roles de equipo que no son staff, al staff y al bot. El bot siempre ve todo.
    /// </summary>
    public static List<object> BuildOverwrites(ServerTemplate t, CategoryDef cat, ChannelDef? ch, Dictionary<string, string> ids, string guildId)
    {
        var masks = new Dictionary<string, (ulong Allow, ulong Deny)>();
        void Allow(string? id, ulong bits) { if (id == null || bits == 0) return; masks.TryGetValue(id, out var m); masks[id] = (m.Allow | bits, m.Deny); }
        void Deny(string? id, ulong bits) { if (id == null || bits == 0) return; masks.TryGetValue(id, out var m); masks[id] = (m.Allow, m.Deny | bits); }
        string? RoleId(string? key) => key != null && ids.TryGetValue(ObjKey("role", key), out var v) ? v : null;
        IEnumerable<string> Group(string? name) => name != null && t.Permissions.RoleGroups.TryGetValue(name, out var l) ? l : Enumerable.Empty<string>();

        t.Permissions.Principals.TryGetValue("member", out var memberKey);
        t.Permissions.Principals.TryGetValue("bot", out var botKey);
        t.Permissions.Principals.TryGetValue("staffGroup", out var staffGroup);
        t.Permissions.Principals.TryGetValue("teamGroup", out var teamGroup);
        var staffKeys = Group(staffGroup).ToList();
        var teamKeys = Group(teamGroup).ToList();
        var memberId = RoleId(memberKey); var botId = RoleId(botKey);

        var channelRoles = ch?.VisibilityRoles ?? new List<string>();
        var open = cat.Visibility.Mode == "everyone" && channelRoles.Count == 0;
        var readOnlyBits = DiscordPermissionBits.Bit("SEND_MESSAGES") | DiscordPermissionBits.Bit("CREATE_PUBLIC_THREADS") |
                           DiscordPermissionBits.Bit("SEND_MESSAGES_IN_THREADS") | DiscordPermissionBits.Bit("ADD_REACTIONS");

        if (open) { Allow(guildId, View | DiscordPermissionBits.Bit("READ_MESSAGE_HISTORY")); Deny(guildId, readOnlyBits); }
        else
        {
            Deny(guildId, View);
            var viewKeys = channelRoles.Count > 0 ? channelRoles.Concat(teamKeys) : cat.Visibility.Roles.Concat(cat.Visibility.Groups.SelectMany(Group));
            foreach (var k in viewKeys.Distinct()) Allow(RoleId(k), View);
        }
        Allow(botId, View);

        if (ch != null && t.Permissions.Presets.TryGetValue(ch.Access, out var pr))
        {
            var viewers = new List<string?> { memberId };
            viewers.AddRange(teamKeys.Where(k => !staffKeys.Contains(k)).Select(RoleId));
            void Apply(AllowDeny? p, IEnumerable<string?> who)
            {
                if (p == null) return;
                var a = DiscordPermissionBits.Combine(p.Allow, t.Permissions); var d = DiscordPermissionBits.Combine(p.Deny, t.Permissions);
                foreach (var id in who.Distinct()) { Allow(id, a); Deny(id, d); }
            }
            Apply(pr.Viewers, viewers);
            Apply(pr.Staff, staffKeys.Select(RoleId));
            Apply(pr.Bot, new[] { botId });
        }

        var list = new List<object>();
        foreach (var (id, m) in masks)
        {
            var allow = m.Allow & ~m.Deny;      // si algo está en las dos listas, gana negar
            if (allow == 0 && m.Deny == 0) continue;
            list.Add(new { id, type = 0, allow = allow.ToString(), deny = m.Deny.ToString() });
        }
        return list;
    }

    // ---------------------------------------------------------------- textos
    /// <summary>El tema del canal; en un foro, sus guías de publicación en los dos idiomas.</summary>
    public static string? TopicOf(ServerTemplate t, ChannelDef ch)
    {
        if (ch.Type == "forum" && ch.Guidelines != null && t.Content.ForumGuidelines.TryGetValue(ch.Guidelines, out var g))
        {
            var text = string.Join("\n\n", ServerTemplatePlanner.SeedLanguages.Where(g.ContainsKey).Select(l => $"{l.ToUpper()}: {g[l]}"));
            return Clip(string.IsNullOrEmpty(ch.Topic) ? text : ch.Topic + "\n\n" + text, 4000);
        }
        return string.IsNullOrEmpty(ch.Topic) ? null : Clip(ch.Topic, ch.Type == "forum" ? 4000 : 1024);
    }
    private static string Clip(string s, int max) => s.Length <= max ? s : s[..(max - 1)] + "…";

    /// <summary>Mensajes (≤2000 caracteres cada uno) de un canal con texto de arranque, en un idioma. #nombre se convierte en mención de canal.</summary>
    public static List<string> BuildSeedMessages(ServerTemplate t, ChannelDef ch, string lang, Dictionary<string, string> ids)
    {
        var byName = t.Categories.SelectMany(c => c.Channels).GroupBy(c => c.Name).Where(g => g.Count() == 1).ToDictionary(g => g.Key, g => g.First().Key);
        string Mentions(string s) => Regex.Replace(s, @"#([a-z0-9-]+)", m =>
            byName.TryGetValue(m.Groups[1].Value, out var key) && ids.TryGetValue(ObjKey("channel", key), out var id) ? $"<#{id}>" : m.Value);

        string body;
        if (ch.Seed == "@rules")
        {
            var head = lang == "es" ? "**Reglas del servidor**" : "**Server rules**";
            var lines = t.Content.Rules.Select((r, i) =>
                $"{i + 1}. **{(r.Title.TryGetValue(lang, out var ti) ? ti : r.Title.Values.FirstOrDefault())}.** {(r.Text.TryGetValue(lang, out var tx) ? tx : r.Text.Values.FirstOrDefault())}");
            body = head + "\n\n" + string.Join("\n", lines);
        }
        else
        {
            if (ch.Seed == null || !t.Content.Texts.TryGetValue(ch.Seed, out var tr) || !tr.TryGetValue(lang, out var txt)) return new List<string>();
            body = $"**{lang.ToUpper()}**\n{txt}";
        }
        body = Mentions(body);

        var parts = new List<string>(); var cur = "";
        foreach (var line in body.Split('\n'))
        {
            if (cur.Length + line.Length + 1 > 1900 && cur.Length > 0) { parts.Add(cur); cur = ""; }
            cur += (cur.Length > 0 ? "\n" : "") + line;
        }
        if (cur.Length > 0) parts.Add(cur);
        return parts;
    }

    // ---------------------------------------------------------------- AutoMod
    public static object BuildAutomod(AutomodDef a, Dictionary<string, string> ids)
    {
        var actions = new List<object>();
        foreach (var act in a.Actions)
        {
            if (act == "block_message") actions.Add(new { type = 1 });
            else if (act.StartsWith("alert:") && ids.TryGetValue(ObjKey("channel", act[6..]), out var ch)) actions.Add(new { type = 2, metadata = new { channel_id = ch } });
        }
        var exemptRoles = a.ExemptRoles.Select(k => ids.TryGetValue(ObjKey("role", k), out var v) ? v : null).Where(v => v != null).ToList();
        var exemptChannels = a.ExemptChannels.Select(k => ids.TryGetValue(ObjKey("channel", k), out var v) ? v : null).Where(v => v != null).ToList();
        var name = ServerTemplatePlanner.AutomodName(a);
        return a.Type switch
        {
            "spam" => new { name, event_type = 1, trigger_type = 3, actions, enabled = true, exempt_roles = exemptRoles, exempt_channels = exemptChannels },
            "mention_spam" => new { name, event_type = 1, trigger_type = 5, trigger_metadata = (object)new { mention_total_limit = a.Limit ?? 5 }, actions, enabled = true, exempt_roles = exemptRoles, exempt_channels = exemptChannels },
            "keyword_preset" => new { name, event_type = 1, trigger_type = 4, trigger_metadata = (object)new { presets = a.Presets.Select(p => p switch { "profanity" => 1, "sexual_content" => 2, _ => 3 }).ToList() }, actions, enabled = true, exempt_roles = exemptRoles, exempt_channels = exemptChannels },
            _ => new { name, event_type = 1, trigger_type = 1, trigger_metadata = (object)new { keyword_filter = a.Patterns, allow_list = a.Allow }, actions, enabled = true, exempt_roles = exemptRoles, exempt_channels = exemptChannels },
        };
    }
}
