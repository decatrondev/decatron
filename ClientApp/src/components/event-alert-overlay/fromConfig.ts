import type { AlertEventType, EventAlertData, LegacyAlertStyle, LegacyOverlayElements } from './types';
import { BACKEND_STYLE_DEFAULTS } from './defaults';
import { mergeLegacyStyle, readLegacyElements } from './convertLegacy';

// La vista previa y el editor arman cada alerta a partir de la config igual que el backend
// (Decatron.Services/EventAlertsService.cs, TriggerAlertAsync): nivel, mensaje con variables, media, animación,
// efectos y estilos. Así se ve lo mismo que va a salir en OBS.

const isObj = (v: any): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);

/** Una alerta posible de un evento: la base, un nivel, un tipo de sub o un nivel del hype train. */
export interface AlertCase {
    key: string;
    eventType: AlertEventType;
    /** Nombre del nivel tal como está en la config (para mostrar). */
    name: string;
    alertConfig: any;
    eventConfig: any;
    amount: number;
    tier?: string;
    level?: number;
}

const SUB_KEYS = ['prime', 'tier1', 'tier2', 'tier3'] as const;
const SUB_LABELS: Record<(typeof SUB_KEYS)[number], string> = { prime: 'Prime', tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3' };

/** Cantidad que dispara un nivel (la mínima de su condición). */
function amountFor(tier: any, fallback: number): number {
    const c = tier?.condition;
    if (!isObj(c)) return fallback;
    if (num(c.exact)) return c.exact;
    if (num(c.min)) return Math.max(1, c.min);
    return fallback;
}

/** Las alertas que puede mostrar un evento. */
export function listCases(config: any, eventType: AlertEventType): AlertCase[] {
    const ev = config?.[eventType];
    if (!isObj(ev)) return [];
    if (eventType === 'follow') return [{ key: 'follow', eventType, name: 'follow', alertConfig: ev.alert, eventConfig: ev, amount: 0 }];
    if (eventType === 'subs') {
        return SUB_KEYS.filter(k => isObj(ev.subTypes?.[k])).map(k => ({ key: k, eventType, name: SUB_LABELS[k], alertConfig: ev.subTypes[k], eventConfig: ev, amount: 1, tier: SUB_LABELS[k] }));
    }
    if (eventType === 'hypeTrain') {
        return [1, 2, 3, 4, 5].filter(l => isObj(ev.levels?.[String(l)])).map(l => ({ key: `level-${l}`, eventType, name: String(l), alertConfig: ev.levels[String(l)], eventConfig: ev, amount: l, level: l }));
    }
    const base: AlertCase = { key: 'base', eventType, name: 'base', alertConfig: ev.baseAlert, eventConfig: ev, amount: eventType === 'raids' ? 10 : eventType === 'resubs' ? 3 : 1 };
    const tiers = (Array.isArray(ev.tiers) ? ev.tiers : []).filter((t: any) => isObj(t) && t.enabled !== false);
    return [base, ...tiers.map((t: any, i: number) => ({ key: `tier-${t.id ?? i}`, eventType, name: t.name || `${i + 1}`, alertConfig: t, eventConfig: ev, amount: amountFor(t, i + 2) }))];
}

/** AlertTemplateVars.Replace del backend. */
export function replaceAlertVars(t: string, v: { username: string; amount: number; tier?: string; months: number; level: number; message?: string }): string {
    if (!t) return '';
    const a = String(v.amount);
    const pairs: [string, string][] = [
        ['{userName}', v.username], ['{username}', v.username], ['{user}', v.username], ['{name}', v.username],
        ['{donor}', v.username], ['{donorName}', v.username],
        ['{amount}', a], ['{formattedAmount}', a], ['{bits}', a], ['{viewers}', a], ['{subs}', a],
        ['{months}', String(v.months)], ['{level}', String(v.level)], ['{tier}', v.tier ?? ''], ['{message}', v.message ?? ''],
    ];
    return pairs.reduce((s, [k, val]) => s.split(k).join(val), t);
}

function detectMediaType(url: string): 'video' | 'image' {
    const ext = url.toLowerCase().split('?')[0].split('.').pop() ?? '';
    return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext) ? 'video' : 'image';
}

/** La media visual de una alerta (sin la parte de sonido). */
function extractMedia(cfg: any, out: { mediaUrl: string | null; mediaType: string | null }) {
    const m = cfg?.media;
    if (!isObj(m) || m.enabled !== true) return;
    if ((m.mode ?? 'simple') === 'advanced' && isObj(m.advanced)) {
        const adv = m.advanced;
        if (adv.video?.url) { out.mediaUrl = adv.video.url; out.mediaType = 'video'; }
        else if (adv.image?.url) { out.mediaUrl = adv.image.url; out.mediaType = detectMediaType(adv.image.url); }
        return;
    }
    if (isObj(m.simple)) {
        out.mediaUrl = m.simple.url ?? null;
        out.mediaType = m.simple.type ?? 'image';
        if (out.mediaType === 'audio') { out.mediaUrl = null; out.mediaType = null; }
        return;
    }
    out.mediaUrl = m.url ?? null;
    out.mediaType = m.type || (m.url ? detectMediaType(m.url) : null) || 'image';
}

/** Lo que mandaría el backend para esa alerta: los datos que se dibujan, el estilo combinado y el propio. */
export function payloadFor(config: any, c: AlertCase, username = 'StreamFan99', userMessage = '¡Qué buen stream!'): {
    data: EventAlertData; style: LegacyAlertStyle; partialStyle: Partial<LegacyAlertStyle> | null; overlayElements: LegacyOverlayElements;
} {
    const cfg = c.alertConfig ?? {};
    const months = c.amount;
    const level = c.level ?? 1;
    const message = replaceAlertVars(cfg.message ?? '', { username, amount: c.amount, tier: c.tier ?? 'Tier 1', months, level, message: userMessage });
    const media = { mediaUrl: null as string | null, mediaType: null as string | null };
    extractMedia(cfg, media);
    if (!media.mediaUrl && isObj(c.eventConfig?.baseAlert)) extractMedia(c.eventConfig.baseAlert, media);
    if (media.mediaUrl && /\.(mp4|webm|mov)$/i.test(media.mediaUrl)) media.mediaType = 'video';
    const animType = cfg.animation?.type ?? 'fade';
    const anim = ({ slide: 'slide', bounce: 'bounce', zoom: 'zoom' } as Record<string, string>)[animType] ?? 'fade';
    const partialStyle = isObj(cfg.style) ? (cfg.style as Partial<LegacyAlertStyle>) : null;
    return {
        data: {
            eventType: c.eventType,
            username: c.eventType === 'hypeTrain' ? '' : username,
            amount: c.amount,
            tier: c.tier ?? 'Tier 1',
            months,
            viewers: c.amount,
            level,
            message,
            mediaType: (media.mediaType ?? undefined) as EventAlertData['mediaType'],
            mediaUrl: media.mediaUrl ?? '',
            duration: (num(cfg.duration) ? cfg.duration : 5) * 1000,
            animationIn: `${anim}In`,
            animationOut: `${anim}Out`,
            effects: cfg.effects?.enabled && Array.isArray(cfg.effects.effects) ? cfg.effects.effects.filter(Boolean) : [],
        },
        style: mergeLegacyStyle(mergeLegacyStyle(BACKEND_STYLE_DEFAULTS, config?.global?.defaultStyle), partialStyle),
        partialStyle,
        overlayElements: readLegacyElements(config?.global?.overlayElements),
    };
}
