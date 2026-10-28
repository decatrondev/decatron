import { useEffect, useRef, useState } from 'react';
import PromoDesignRenderer, { type Phase, type ResolveImage } from './PromoDesignRenderer';
import type { PromoContent, PromoDesign, PromoVars } from './types';

export interface ZonePlacement {
    anchor: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    marginX: number;
    marginY: number;
}

export const STAGE = { width: 1920, height: 1080 };

/** Esquina superior izquierda de una ficha de ese tamaño puesta en una zona del lienzo de 1920×1080. */
export function placeInZone(zone: ZonePlacement, width: number, height: number): { x: number; y: number } {
    const [v, h] = zone.anchor === 'center' ? ['middle', 'center'] : zone.anchor.split('-') as [string, string];
    const x = h === 'left' ? zone.marginX : h === 'right' ? STAGE.width - zone.marginX - width : (STAGE.width - width) / 2;
    const y = v === 'top' ? zone.marginY : v === 'bottom' ? STAGE.height - zone.marginY - height : (STAGE.height - height) / 2;
    return { x: Math.round(x), y: Math.round(y) };
}

interface Common { design: PromoDesign; content: PromoContent; vars: PromoVars; resolveImage: ResolveImage; phase?: Phase; editing?: boolean }

/** Mide el ancho disponible y devuelve la escala para que `natural` px quepan. */
function useFit(natural: number, max: number) {
    const box = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.3);
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const fit = () => setScale(Math.min(max, Math.max(0.05, el.clientWidth / natural)));
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, [natural, max]);
    return { box, scale };
}

/** El lienzo de 1920×1080 reducido, con la ficha en su zona. Para ver tamaño y posición reales. */
export function PromoStage({ zone, background, pieceScale = 1, ...c }: Common & { zone: ZonePlacement; background?: string; pieceScale?: number }) {
    const { box, scale } = useFit(STAGE.width, 1);
    const pos = placeInZone(zone, c.design.canvas.width * pieceScale, c.design.canvas.height * pieceScale);
    return (
        <div ref={box} style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 10, border: '1px solid var(--ds-border)', background: background ?? 'radial-gradient(120% 120% at 30% 20%, var(--ds-raised), var(--ds-bg))' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: STAGE.width, height: STAGE.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <div style={{ position: 'absolute', left: pos.x, top: pos.y, transform: pieceScale === 1 ? undefined : `scale(${pieceScale})`, transformOrigin: 'top left' }}><PromoDesignRenderer {...c} /></div>
            </div>
        </div>
    );
}

/** La ficha ampliada (o reducida) al ancho disponible, para juzgar su diseño. */
export function PromoZoom({ maxScale = 1.25, ...c }: Common & { maxScale?: number }) {
    const pad = 20;
    const { box, scale } = useFit(c.design.canvas.width + pad * 2, maxScale);
    return (
        <div ref={box} style={{ position: 'relative', width: '100%', height: c.design.canvas.height * scale + pad * 2 * scale + 4, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--ds-border)', background: 'radial-gradient(120% 120% at 30% 20%, var(--ds-raised), var(--ds-bg))' }}>
            <div style={{ position: 'absolute', left: pad * scale, top: pad * scale, width: c.design.canvas.width, height: c.design.canvas.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <PromoDesignRenderer {...c} />
            </div>
        </div>
    );
}
