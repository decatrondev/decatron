/**
 * Mide cuánto ocupa la tarjeta sin caja fija, para el tamaño automático: renderiza
 * fuera de pantalla una copia por cada vista que puede salir (principal, vistas de
 * la rotación activas y el anuncio) y devuelve el máximo. Así la caja entra todo lo
 * que la rotación vaya a mostrar, no solo la vista que se está diseñando.
 * Lo usan el editor (Diseño) y el preview público del overlay.
 */
import { ReactNode, useEffect, useRef } from 'react';
import { GameOverlayCard, CARD_LABELS } from './GameOverlayCard';
import { CardView } from './slides';
import { AccountOverlayState, CARD_SIZE_LIMITS, CardSize, GAME_NAMES, GameId, GameVisualConfig, PromoItem, formatTier } from './types';

/** Vistas que hay que medir para esta config. */
export function viewsToMeasure(cfg: GameVisualConfig, promoOn: boolean): CardView[] {
    const views: CardView[] = ['main'];
    if (cfg.slides.enabled) for (const v of cfg.slides.views) if (!views.includes(v)) views.push(v);
    if (promoOn) views.push('promo');
    return views;
}

/** Tamaño automático a partir de lo medido: la barra ocupa el ancho del lienzo, el resto el del contenido. */
export function autoSize(cfg: GameVisualConfig, measured: CardSize, canvasWidth: number): CardSize {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const width = cfg.layout === 'bar'
        ? clamp(canvasWidth - cfg.position.x * 2, measured.width, CARD_SIZE_LIMITS.maxWidth)
        : clamp(measured.width, CARD_SIZE_LIMITS.minWidth, CARD_SIZE_LIMITS.maxWidth);
    return { width, height: clamp(measured.height, CARD_SIZE_LIMITS.minHeight, CARD_SIZE_LIMITS.maxHeight) };
}

/** Medidor genérico: renderiza `items` fuera de pantalla y devuelve el máximo ancho/alto de sus primeros hijos. */
export function Measurer({ items, depsKey, onMeasure }: { items: { key: string; node: ReactNode }[]; depsKey: string; onMeasure: (size: CardSize) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const cb = useRef(onMeasure);
    cb.current = onMeasure;
    // Se mide en cada cambio y de nuevo cuando terminan de cargar las fuentes.
    useEffect(() => {
        let alive = true;
        const measure = () => {
            if (!alive || !ref.current) return;
            let width = 0, height = 0;
            for (const el of Array.from(ref.current.children)) {
                const r = (el.firstElementChild as HTMLElement | null)?.getBoundingClientRect();
                if (!r) continue;
                width = Math.max(width, Math.ceil(r.width) + 2);
                height = Math.max(height, Math.ceil(r.height) + 2);
            }
            if (width && height) cb.current({ width, height });
        };
        const t = setTimeout(measure, 30);
        document.fonts?.ready.then(() => setTimeout(measure, 30));
        return () => { alive = false; clearTimeout(t); };
    }, [depsKey]);

    return (
        <div ref={ref} aria-hidden style={{ position: 'fixed', left: -10000, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
            {items.map(it => <div key={it.key}>{it.node}</div>)}
        </div>
    );
}

interface Props {
    game: GameId;
    config: GameVisualConfig;
    account: AccountOverlayState;
    accountCount: number;
    views: CardView[];
    promo?: PromoItem | null;
    lang: 'es' | 'en';
    onMeasure: (size: CardSize) => void;
}

export function CardMeasurer({ game, config, account, accountCount, views, promo, lang, onMeasure }: Props) {
    const key = JSON.stringify({ ...config, size: undefined, scale: undefined, position: undefined }) + views.join() + (promo?.id ?? 0) + lang;
    return (
        <Measurer depsKey={key} onMeasure={onMeasure} items={views.map(v => ({
            key: v,
            node: <GameOverlayCard game={game} gameName={GAME_NAMES[game]} config={{ ...config, scale: 1 }} account={{ ...account, livePhase: null }} view={v} promo={promo} measure
                accountIndex={0} accountCount={accountCount} switchAnimation="none" formatTier={formatTier} lang={lang} labels={CARD_LABELS[lang]} />,
        }))} />
    );
}
