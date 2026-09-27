// Arma, a partir de una config, las alertas que mandaría el backend por SignalR (ShowEventAlert): la misma
// selección de nivel y variante, el mismo mezclado de estilos y posiciones y la misma media que
// Decatron.Services/EventAlertsService.cs (TriggerAlertAsync). Es una copia independiente del renderer nuevo a
// propósito: si convertLegacy.ts se equivoca, el banco lo ve. Sin sonido ni TTS (no se dibujan).

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const num = v => typeof v === 'number' && Number.isFinite(v);

// ExtractStyleConfig
const STYLE_DEFAULTS = {
    backgroundType: 'color', backgroundColor: 'rgba(0,0,0,0.85)',
    backgroundGradient: { color1: '#1a1a2e', color2: '#16213e', angle: 135 },
    backgroundImage: '', opacity: 100, borderEnabled: true, borderColor: 'rgba(255,255,255,0.2)', borderWidth: 2,
    borderRadius: 16, padding: 24, width: 400, height: 300, mediaLayout: 'top', mediaObjectFit: 'contain',
    fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 'bold', textColor: '#ffffff', textShadow: 'normal', textAlign: 'center',
};
const STR_KEYS = ['backgroundType', 'backgroundColor', 'backgroundImage', 'borderColor', 'mediaLayout', 'mediaObjectFit', 'fontFamily', 'fontWeight', 'textColor', 'textShadow', 'textAlign'];
const INT_KEYS = ['opacity', 'borderWidth', 'borderRadius', 'padding', 'width', 'height', 'fontSize'];

function applyStyle(s, cfg) {
    if (!isObj(cfg)) return;
    for (const k of STR_KEYS) if (k in cfg && typeof cfg[k] === 'string') s[k] = cfg[k];
    for (const k of INT_KEYS) if (k in cfg && num(cfg[k])) s[k] = cfg[k];
    if ('borderEnabled' in cfg && typeof cfg.borderEnabled === 'boolean') s.borderEnabled = cfg.borderEnabled;
    const g = cfg.backgroundGradient;
    if (isObj(g)) {
        if (typeof g.color1 === 'string') s.backgroundGradient.color1 = g.color1;
        if (typeof g.color2 === 'string') s.backgroundGradient.color2 = g.color2;
        if (num(g.angle)) s.backgroundGradient.angle = g.angle;
    }
}

export function extractStyle(config, alertConfig) {
    const s = structuredClone(STYLE_DEFAULTS);
    applyStyle(s, config?.global?.defaultStyle);
    applyStyle(s, alertConfig?.style);
    return s;
}

// ExtractOverlayElements
export function extractOverlayElements(config) {
    const defaults = {
        card: { x: 660, y: 290, width: 600, height: 500, enabled: true },
        media: { x: 690, y: 320, width: 540, height: 220, enabled: true },
        text: { x: 690, y: 560, width: 540, height: 200, enabled: true },
    };
    const fallbacks = {
        card: [760, 390, 400, 300], media: [780, 410, 360, 120], text: [780, 550, 360, 120],
    };
    const oe = config?.global?.overlayElements;
    if (!isObj(oe)) return defaults;
    const out = {};
    for (const key of ['card', 'media', 'text']) {
        const e = oe[key];
        if (!isObj(e)) { out[key] = defaults[key]; continue; }
        const [fx, fy, fw, fh] = fallbacks[key];
        out[key] = {
            x: num(e.x) ? e.x : fx, y: num(e.y) ? e.y : fy,
            width: num(e.width) ? e.width : fw, height: num(e.height) ? e.height : fh,
            enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
        };
    }
    return out;
}

// AlertTemplateVars.Replace
function replaceVars(t, { username, amount, tier, months, level, message }) {
    if (!t) return t ?? '';
    const a = String(amount);
    return t
        .split('{userName}').join(username).split('{username}').join(username).split('{user}').join(username)
        .split('{name}').join(username).split('{donor}').join(username).split('{donorName}').join(username)
        .split('{amount}').join(a).split('{formattedAmount}').join(a).split('{bits}').join(a)
        .split('{viewers}').join(a).split('{subs}').join(a)
        .split('{months}').join(String(months)).split('{level}').join(String(level))
        .split('{tier}').join(tier ?? '').split('{message}').join(message ?? '');
}

function detectMediaType(url) {
    const ext = (url.toLowerCase().split('?')[0].split('.').pop()) ?? '';
    return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext) ? 'video' : 'image';
}

/** Media visual de una alerta (ExtractMediaFromConfig, sin la parte de sonido). */
function extractMedia(cfg, out) {
    const m = cfg?.media;
    if (!isObj(m) || m.enabled !== true) return;
    const mode = m.mode ?? 'simple';
    if (mode === 'advanced' && isObj(m.advanced)) {
        const adv = m.advanced;
        if (adv.video?.url) { out.mediaUrl = adv.video.url; out.mediaType = 'video'; }
        else if (adv.image?.url) { out.mediaUrl = adv.image.url; out.mediaType = detectMediaType(adv.image.url); }
        // Solo audio: se muestra la imagen de fondo si hay
        if (adv.audio?.url && !out.mediaUrl && adv.image?.url) { out.mediaUrl = adv.image.url; out.mediaType = 'image'; }
        return;
    }
    if (isObj(m.simple)) {
        out.mediaUrl = m.simple.url ?? null;
        out.mediaType = m.simple.type ?? 'image';
        if (out.mediaType === 'audio') { out.mediaUrl = null; out.mediaType = null; }
        return;
    }
    out.mediaUrl = m.url ?? null;
    const type = m.type || (m.url ? detectMediaType(m.url) : null);
    out.mediaType = type ?? 'image';
}

// FindMatchingTierOrBase
function findTier(eventConfig, amount) {
    for (const tier of Array.isArray(eventConfig.tiers) ? eventConfig.tiers : []) {
        if (tier.enabled === false || !isObj(tier.condition)) continue;
        const c = tier.condition, type = c.type ?? 'range';
        const ok = type === 'exact' ? num(c.exact) && c.exact === amount
            : type === 'minimum' ? num(c.min) && amount >= c.min
            : type === 'range' ? num(c.min) && amount >= c.min && (c.max === undefined || c.max === null || amount <= c.max)
            : false;
        if (ok) return tier;
    }
    return eventConfig.baseAlert ?? eventConfig;
}

const SUB_LABELS = { prime: 'Prime', tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3' };

/** Qué alertas probar de una config: cada evento, cada tier de sub, cada nivel alcanzable y cada variante. */
export function listAlerts(config) {
    const out = [];
    if (config?.global?.enabled === false) return out;
    const hint = isObj(config?._parity) ? config._parity : {};
    const username = hint.username ?? 'UsuarioDePrueba';
    const userMessage = hint.userMessage ?? null;

    const push = (eventType, label, alertConfig, eventConfig, data) => {
        if (!isObj(alertConfig)) return;
        const variants = alertConfig.variants?.enabled && Array.isArray(alertConfig.variants.variants) ? alertConfig.variants.variants : [];
        // Índice 0 = el nivel principal; las variantes van después
        [alertConfig, ...variants].forEach((cfg, i) => {
            if (!isObj(cfg) || cfg.enabled === false) return;
            out.push({ label: i === 0 ? label : `${label}-variante${i}`, eventType, alertConfig: cfg, eventConfig, data });
        });
    };

    for (const eventType of ['follow', 'bits', 'subs', 'giftSubs', 'raids', 'resubs', 'hypeTrain']) {
        const ev = config?.[eventType];
        if (!isObj(ev) || ev.enabled === false) continue;
        const base = { username, userMessage };
        if (eventType === 'follow') push(eventType, 'follow', ev.alert, ev, { ...base, amount: 0 });
        else if (eventType === 'subs') {
            for (const key of ['prime', 'tier1', 'tier2', 'tier3']) {
                push(eventType, `subs-${key}`, ev.subTypes?.[key], ev, { ...base, amount: 1, tier: SUB_LABELS[key], months: 1 });
            }
        } else if (eventType === 'hypeTrain') {
            for (const lvl of [1, 2, 3, 4, 5]) push(eventType, `hypeTrain-nivel${lvl}`, ev.levels?.[String(lvl)], ev, { ...base, amount: lvl, level: lvl });
        } else {
            // Una cantidad por tier (la que lo dispara) y una que no dispare ninguno (la alerta base)
            const amounts = new Set();
            for (const t of Array.isArray(ev.tiers) ? ev.tiers : []) {
                const c = t?.condition;
                if (!isObj(c)) continue;
                if (num(c.exact)) amounts.add(c.exact);
                if (num(c.min)) amounts.add(Math.max(c.min, 1));
            }
            amounts.add(1); amounts.add(7);
            const seen = new Set();
            for (const amount of [...amounts].sort((a, b) => a - b)) {
                const cfg = findTier(ev, amount);
                if (seen.has(cfg)) continue;
                seen.add(cfg);
                const name = cfg === ev.baseAlert ? 'base' : `tier-${cfg.id ?? cfg.name ?? amount}`;
                push(eventType, `${eventType}-${name}`, cfg, ev, { ...base, amount, months: amount });
            }
        }
    }
    return out;
}

/** Lo que mandaría el backend para esa alerta (solo la parte visual). */
export function buildPayload(config, item) {
    const { eventType, alertConfig, eventConfig, data } = item;
    const amount = data.amount ?? 0;
    const tier = data.tier ?? 'Tier 1';
    const months = data.months ?? amount;
    const level = data.level ?? 1;
    const message = replaceVars(alertConfig.message ?? '', { username: data.username, amount, tier, months, level, message: data.userMessage });

    const media = { mediaUrl: null, mediaType: null };
    extractMedia(alertConfig, media);
    if (!media.mediaUrl && isObj(eventConfig.baseAlert)) extractMedia(eventConfig.baseAlert, media);
    if (media.mediaUrl && /\.(mp4|webm|mov)$/i.test(media.mediaUrl)) media.mediaType = 'video';

    const animType = alertConfig.animation?.type ?? 'fade';
    const map = { slide: 'slide', bounce: 'bounce', zoom: 'zoom' };
    const effects = alertConfig.effects?.enabled && Array.isArray(alertConfig.effects.effects) ? alertConfig.effects.effects.filter(Boolean) : [];

    return {
        eventType,
        username: data.username,
        amount,
        tier,
        months,
        viewers: amount,
        level,
        message,
        mediaType: media.mediaType,
        mediaUrl: media.mediaUrl ?? '',
        playVideoAudio: false,
        duration: (alertConfig.duration ?? 5) * 1000,
        animationIn: `${map[animType] ?? 'fade'}In`,
        animationOut: `${map[animType] ?? 'fade'}Out`,
        effects,
        style: extractStyle(config, alertConfig),
        overlayElements: extractOverlayElements(config),
    };
}
