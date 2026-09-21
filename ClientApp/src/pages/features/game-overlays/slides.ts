/**
 * Rotación de vistas ("tipo GIF") y anuncios de Decatron. Un solo hook que usan el
 * overlay de OBS y el preview del editor, así ambos se comportan igual.
 *
 * - Vistas: si slides.enabled, cada `seconds` pasa a la siguiente vista con datos.
 * - Anuncios: si promo.enabled (o el tier no permite apagarlos), cada `everySeconds`
 *   del catálogo del admin un anuncio (elegido por peso) tapa la tarjeta durante
 *   su `durationSeconds`. Sin catálogo se usa el mensaje de fábrica (PROMO_MESSAGES).
 */
import { useEffect, useMemo, useState } from 'react';
import { AccountOverlayState, GameVisualConfig, PromoCatalog, PromoItem, SlideView } from './types';

/** Frecuencia y duración de fábrica cuando el admin no configuró nada. */
export const PROMO_DEFAULTS = { everySeconds: 180, durationSeconds: 8 };

/** Elige un anuncio al azar según su peso. */
export function pickPromo(items: PromoItem[]): PromoItem | null {
    const pool = items.filter(i => i.weight > 0);
    if (pool.length === 0) return null;
    let r = Math.random() * pool.reduce((s, i) => s + i.weight, 0);
    for (const i of pool) { r -= i.weight; if (r <= 0) return i; }
    return pool[pool.length - 1];
}

export type CardView = SlideView | 'promo';

/** Vistas que realmente tienen algo que mostrar para esta cuenta. */
export function availableViews(cfg: GameVisualConfig, account: AccountOverlayState | null | undefined): SlideView[] {
    const stats = account?.stats;
    const session = account?.session;
    const hasSession = !!session && session.wins >= 0;
    return cfg.slides.views.filter(v => {
        if (v === 'main') return true;
        if (v === 'stats') return !!stats && stats.sampleSize > 0;
        if (v === 'champs') return !!stats && (stats.topCharacters.length > 0 || stats.mastery.length > 0);
        if (v === 'graph') return (hasSession && (session!.pointsHistory?.length ?? 0) >= 2) || hasSession;
        return false;
    });
}

export function useCardCycle(cfg: GameVisualConfig | null | undefined, account: AccountOverlayState | null | undefined, canHidePromo: boolean, catalog?: PromoCatalog | null, paused = false): { view: CardView; promo: PromoItem | null } {
    const views = useMemo(() => (cfg ? availableViews(cfg, account) : ['main' as SlideView]), [cfg, account]);
    const rotating = !!cfg?.slides.enabled && views.length > 1 && !paused;
    const promoOn = !!cfg && (cfg.promo.enabled || !canHidePromo) && !paused;
    const everySeconds = catalog?.everySeconds || PROMO_DEFAULTS.everySeconds;
    const items = catalog?.items ?? [];

    const [index, setIndex] = useState(0);
    const [promo, setPromo] = useState<PromoItem | null | false>(false);

    useEffect(() => {
        setIndex(0);
        if (!rotating) return;
        const ms = Math.max(4, cfg!.slides.seconds || 12) * 1000;
        const t = setInterval(() => setIndex(i => i + 1), ms);
        return () => clearInterval(t);
    }, [rotating, cfg?.slides.seconds, views.length]);

    useEffect(() => {
        setPromo(false);
        if (!promoOn) return;
        const every = Math.max(30, everySeconds) * 1000;
        let hide: ReturnType<typeof setTimeout> | undefined;
        const show = () => {
            const item = pickPromo(items);
            const dur = Math.min(Math.max(3, item?.durationSeconds || PROMO_DEFAULTS.durationSeconds), 30) * 1000;
            setPromo(item);
            hide = setTimeout(() => setPromo(false), dur);
        };
        const t = setInterval(show, every);
        return () => { clearInterval(t); if (hide) clearTimeout(hide); };
    }, [promoOn, everySeconds, items]);

    if (promo !== false) return { view: 'promo', promo };
    if (!rotating) return { view: views.includes('main') ? 'main' : views[0] ?? 'main', promo: null };
    return { view: views[index % views.length], promo: null };
}

/** Mensajes de la tarjeta de Decatron. Rotan entre sí en cada aparición. */
export const PROMO_MESSAGES: Record<'es' | 'en', { title: string; lines: string[] }> = {
    es: {
        title: 'Consigue Decatron gratis en',
        lines: [
            'Overlays de rango, comandos de chat y sorteos para tu stream',
            'Traducción en vivo: tus viewers te escuchan en su idioma',
            'Gacha, colecciones y TCG para que tu chat se enganche',
            'Timers, alertas con voz y mucho más para Twitch y Kick',
        ],
    },
    en: {
        title: 'Get Decatron for free at',
        lines: [
            'Rank overlays, chat commands and giveaways for your stream',
            'Live translation: your viewers hear you in their language',
            'Gacha, collections and a TCG to keep your chat hooked',
            'Timers, voice alerts and much more for Twitch and Kick',
        ],
    },
};
