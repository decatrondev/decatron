import { useEffect, useState, type CSSProperties } from 'react';
import { BrandMark } from '../../../../brand/BrandMark';
import { PROMO_DEFAULTS, PROMO_MESSAGES, pickPromo } from '../../game-overlays/slides';
import type { PromoCatalog, PromoItem } from '../../game-overlays/types';
import type { OverlayLayout } from '../types';

// Tarjeta de Decatron en los overlays de Song Request (SONG_REQUEST_PLAYLISTS_PLAN.md, fase 1), como en
// Game Overlays: cada cierto tiempo tapa unos segundos el panel con el logo y un mensaje. El catálogo y la
// frecuencia los define el admin; el backend solo la manda si el plan del canal no la ocultó.

/** Cada everySeconds sale un anuncio por su durationSeconds. false = no se muestra ahora. */
function usePromoCycle(catalog: PromoCatalog | null, active: boolean): PromoItem | null | false {
    const [promo, setPromo] = useState<PromoItem | null | false>(false);
    const everySeconds = catalog?.everySeconds || PROMO_DEFAULTS.everySeconds;
    const items = catalog?.items;

    useEffect(() => {
        setPromo(false);
        if (!catalog || !active) return;
        let hide: ReturnType<typeof setTimeout> | undefined;
        const show = () => {
            const item = pickPromo(items ?? []);
            const dur = Math.min(Math.max(3, item?.durationSeconds || PROMO_DEFAULTS.durationSeconds), 30) * 1000;
            setPromo(item);
            hide = setTimeout(() => setPromo(false), dur);
        };
        const t = setInterval(show, Math.max(30, everySeconds) * 1000);
        return () => { clearInterval(t); if (hide) clearTimeout(hide); };
    }, [catalog, items, everySeconds, active]);

    return promo;
}

/** Va encima del overlay, en el lugar del panel. active: el overlay se está viendo (hay canción o no se oculta sin ella). */
export default function SongRequestPromo({ layout, catalog, lang, active }: { layout: OverlayLayout; catalog: PromoCatalog | null; lang: 'es' | 'en'; active: boolean }) {
    const promo = usePromoCycle(catalog, active);
    const [shown, setShown] = useState<PromoItem | null>(null);
    const visible = promo !== false;
    // Se queda con el último anuncio mientras se desvanece
    useEffect(() => { if (promo !== false) setShown(promo); }, [promo]);

    const { panel } = layout.elements;
    const msgs = PROMO_MESSAGES[lang];
    const title = shown?.title ?? msgs.title;
    const line = shown?.line ?? msgs.lines[Math.floor(Date.now() / 60000) % msgs.lines.length];
    const bar = panel.width >= panel.height * 3;
    // El texto crece con el panel (un panel alto de 1080p no puede llevar letra de 13 px)
    const lineSize = Math.round(Math.min(20, Math.max(13, Math.min(panel.height, panel.width / 3) / 10)));
    const image = shown?.imageUrl || '/brand/decatron-lockup-light.png';
    const fallbackLogo = <img src={image} alt="Decatron" style={bar
        ? { height: Math.min(72, panel.height * 0.5), width: 'auto', maxWidth: 220, objectFit: 'contain', flexShrink: 0 }
        : { width: '60%', maxWidth: 200, height: 'auto', maxHeight: '40%', objectFit: 'contain' }} />;
    const logo = shown?.imageUrl ? fallbackLogo : <BrandMark slot="games-promo" variant={bar ? 'bar' : 'card'} theme="dark" fallback={fallbackLogo} />;
    const url = <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>decatron<span style={{ color: '#3b82f6' }}>.net</span></div>;

    const base: CSSProperties = {
        position: 'absolute', left: panel.x, top: panel.y, width: panel.width, height: panel.height, boxSizing: 'border-box',
        background: '#0f1115', borderRadius: layout.theme.panelRadius, overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif', display: 'flex',
        opacity: visible ? 1 : 0, transition: 'opacity 600ms ease', pointerEvents: 'none',
    };

    if (bar) {
        return (
            <div style={{ ...base, alignItems: 'center', gap: 18, padding: '6px 18px' }} aria-hidden={!visible}>
                {logo}
                <div style={{ fontSize: lineSize, color: '#c9d1d9', flex: 1, minWidth: 0, overflow: 'hidden', maxHeight: '3.9em' }}>{line}</div>
                <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{title}</span>
                    {url}
                </div>
            </div>
        );
    }
    return (
        <div style={{ ...base, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 18px', textAlign: 'center' }} aria-hidden={!visible}>
            {logo}
            <div style={{ fontSize: lineSize, color: '#c9d1d9', lineHeight: 1.3, overflow: 'hidden' }}>{line}</div>
            <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
            {url}
        </div>
    );
}
