import { useEffect, useState, type CSSProperties } from 'react';
import { FONTS, LAYER_SIZE, SCENE_H, SCENE_W, isVideoUrl, textOn, type PersonalPageContent, type PersonalPageLayer } from './shared';

// Cabecera de la plantilla Escena como lienzo por capas (subfase 5.3). La misma pieza dibuja la página pública y el
// lienzo del editor: posiciones en porcentaje del lienzo y letra en unidades del contenedor (cqw), así se escala igual
// que un overlay en cualquier ancho. Maqueta: .dev/plans/pagina-personal/maquetas/Main.dc.html

export const SCENE_PALETTES = {
    dark: { bg: '#1A1D23', panel: '#262A33', line: '#353B47', text: '#E9EBEF', soft: '#B7BECB', faint: '#8A93A3', scene: '#0F1218', stripeA: '#141821', stripeB: '#10131A' },
    light: { bg: '#EEF0F3', panel: '#FFFFFF', line: '#D3D8E0', text: '#15181D', soft: '#4A5260', faint: '#6A7280', scene: '#DCE0E6', stripeA: '#D5DAE1', stripeB: '#DCE0E6' },
} as const;

function useReducedMotion(): boolean {
    const query = '(prefers-reduced-motion: reduce)';
    const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
    useEffect(() => {
        const mq = window.matchMedia?.(query);
        if (!mq) return;
        const on = () => setReduced(mq.matches);
        mq.addEventListener?.('change', on);
        return () => mq.removeEventListener?.('change', on);
    }, []);
    return reduced;
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;
const cqw = (v: number) => `${(v / SCENE_W) * 100}cqw`;

export default function SceneCanvas({ content, photo, initials }: { content: PersonalPageContent; photo: string; initials: string }) {
    const scene = content.scene!;
    const p = content.theme === 'light' ? SCENE_PALETTES.light : SCENE_PALETTES.dark;
    const accent = /^#[0-9a-f]{6}$/i.test(content.accent) ? content.accent : '#5B8CFF';
    const pageFont = FONTS[content.font] ?? FONTS.archivo;
    const reduced = useReducedMotion();
    const bgMedia = scene.background === 'media' ? scene.bgMedia ?? '' : '';

    const vars = {
        '--sc-scene': scene.background === 'color' && scene.bgColor ? scene.bgColor : p.scene, '--sc-stripe-a': p.stripeA, '--sc-stripe-b': p.stripeB,
        '--sc-text': p.text, '--sc-soft': p.soft, '--sc-accent': accent, '--sc-on-accent': textOn(accent), '--sc-panel': p.panel,
        '--sc-font': `'${pageFont.family}', system-ui, sans-serif`,
    } as CSSProperties;

    const layerStyle = (l: PersonalPageLayer, i: number): CSSProperties => ({
        left: pct(l.x, SCENE_W), top: pct(l.y, SCENE_H), width: pct(l.width, SCENE_W), height: pct(l.height, SCENE_H), zIndex: i + 1,
    });
    const textStyle = (l: PersonalPageLayer): CSSProperties => {
        const font = l.font && FONTS[l.font] ? FONTS[l.font] : pageFont;
        return {
            fontFamily: `'${font.family}', system-ui, sans-serif`,
            fontSize: cqw(l.size || LAYER_SIZE[l.kind] || 72),
            fontStretch: l.kind === 'name' && font.wide ? '125%' : undefined,
            color: l.color || (l.kind === 'bio' ? 'var(--sc-soft)' : 'var(--sc-text)'),
            textAlign: (l.align as CSSProperties['textAlign']) || 'left',
        };
    };

    return (
        <div className="sc-root" style={vars}>
            <style>{CSS}</style>
            <div className="sc-canvas">
                {/* Sin la capa del nombre, el nombre sigue siendo el título de la página para lectores de pantalla */}
                {!(scene.layers ?? []).some(l => l.kind === 'name' && l.visible !== false) && <h1 className="sc-sr">{content.displayName}</h1>}
                {scene.background === 'pattern' && <div className="sc-stripes" aria-hidden="true" />}
                {bgMedia && (isVideoUrl(bgMedia)
                    ? <video className="sc-bg" src={bgMedia} muted loop playsInline autoPlay={!reduced} preload={reduced ? 'metadata' : 'auto'} aria-hidden="true" />
                    : <img className="sc-bg" src={bgMedia} alt="" aria-hidden="true" />)}
                {(scene.layers ?? []).filter(l => l.visible !== false).map((l, i) => {
                    const style = layerStyle(l, i);
                    if (l.kind === 'photo') return (
                        <div key={l.id} className="sc-layer sc-photo" style={style}>
                            {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span style={{ fontSize: cqw(Math.min(l.width, l.height) * 0.32) }}>{initials}</span>}
                        </div>
                    );
                    if (l.kind === 'sticker') return l.mediaUrl ? <img key={l.id} className="sc-layer sc-sticker" style={style} src={l.mediaUrl} alt="" /> : null;
                    if (l.kind === 'name') return <h1 key={l.id} className="sc-layer sc-text sc-name" style={{ ...style, ...textStyle(l) }}>{content.displayName}</h1>;
                    if (l.kind === 'bio') return content.bio ? <p key={l.id} className="sc-layer sc-text sc-bio" style={{ ...style, ...textStyle(l) }}>{content.bio}</p> : null;
                    if (l.kind === 'text') return <p key={l.id} className="sc-layer sc-text sc-free" style={{ ...style, ...textStyle(l) }}>{l.text}</p>;
                    return null;
                })}
            </div>
        </div>
    );
}

const CSS = `
.sc-root{container-type:inline-size;width:100%}
.sc-canvas{position:relative;width:100%;aspect-ratio:${SCENE_W}/${SCENE_H};overflow:hidden;background:var(--sc-scene);font-family:var(--sc-font)}
.sc-stripes{position:absolute;inset:0;background:repeating-linear-gradient(115deg,var(--sc-stripe-a) 0 2.2cqw,var(--sc-stripe-b) 2.2cqw 4.4cqw)}
.sc-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.sc-layer{position:absolute;margin:0;box-sizing:border-box}
.sc-photo{border-radius:50%;overflow:hidden;border:.6cqw solid var(--sc-accent);background:var(--sc-panel);display:flex;align-items:center;justify-content:center;
  color:var(--sc-text);font-weight:800}
.sc-photo img{width:100%;height:100%;object-fit:cover;display:block}
.sc-sticker{object-fit:contain;display:block}
.sc-text{overflow:hidden;overflow-wrap:anywhere;white-space:pre-line}
.sc-name{font-weight:900;line-height:.92;letter-spacing:-.01em}
.sc-bio{line-height:1.4}
.sc-free{font-weight:800;line-height:1.1}
.sc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:-1px}
`;
