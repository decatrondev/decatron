import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { LINK_REL, hostOf, pageParts, textOn, type TemplateProps } from './shared';
import MediaBlocks from './MediaBlocks';

// Plantilla «Póster de gira»: el nombre es la obra (cada palabra se mide y llena el ancho de la columna) y las redes van como los créditos
// de un cartel: grandes, medianas o chicas según el tamaño del enlace. Si ninguna está marcada como grande, la primera red va
// grande para que el cartel tenga cabeza. Maqueta: .dev/plans/pagina-personal/maquetas/Poster.dc.html

const PALETTES = {
    light: { bg: '#D9DBDF', ink: '#15171B', soft: '#4A4E57', block: '#15171B', blockText: '#C9CCD2' },
    dark: { bg: '#15171B', ink: '#E2E4E8', soft: '#A6ABB5', block: '#2A2D33', blockText: '#C9CCD2' },
} as const;

/**
 * Ajusta cada palabra del nombre al ancho de la columna midiendo el texto real (sirve para cualquier tipografía).
 * Se recalcula si cambia el ancho, la tipografía o cuando terminan de cargar las fuentes.
 */
function useFitWords(deps: unknown[]) {
    const ref = useRef<HTMLHeadingElement>(null);
    useLayoutEffect(() => {
        const box = ref.current;
        if (!box) return;
        const fit = () => {
            const width = box.clientWidth;
            if (!width) return;
            box.querySelectorAll<HTMLSpanElement>('span').forEach(span => {
                span.style.fontSize = '100px';
                const natural = span.scrollWidth || 1;
                span.style.fontSize = `${Math.min(width * 0.6, (100 * width) / natural) * 0.98}px`;
            });
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(box);
        // La tipografía de la página se carga después del primer dibujo: al llegar cada fuente se vuelve a medir
        const fonts = document.fonts;
        fonts?.ready.then(fit).catch(() => undefined);
        fonts?.addEventListener?.('loadingdone', fit);
        return () => { ro.disconnect(); fonts?.removeEventListener?.('loadingdone', fit); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return ref;
}

export default function PosterTemplate({ content, channelPhotoUrl, labels, embedded }: TemplateProps) {
    const p = content.theme === 'dark' ? PALETTES.dark : PALETTES.light;
    const parts = pageParts(content, channelPhotoUrl);
    const words = parts.name.trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
    const nameRef = useFitWords([parts.name, parts.font.family]);
    const networks = parts.networks.filter(l => !parts.isAdult(l));
    const adult = parts.links.filter(l => parts.isAdult(l));
    const anyBig = networks.some(l => l.size === 'big');
    const sizeOf = (id: string, size?: string) => (!anyBig && networks[0]?.id === id ? 'big' : size ?? 'normal');
    const big = networks.filter(l => sizeOf(l.id, l.size) === 'big');
    const wide = networks.filter(l => sizeOf(l.id, l.size) === 'wide');
    const small = networks.filter(l => sizeOf(l.id, l.size) === 'normal');
    const vars = {
        '--po-bg': p.bg, '--po-ink': p.ink, '--po-soft': p.soft, '--po-block': p.block, '--po-block-text': p.blockText,
        '--po-accent': parts.accent, '--po-on-accent': textOn(parts.accent), '--po-font': `'${parts.font.family}', system-ui, sans-serif`,
        '--po-stretch': parts.font.wide ? '125%' : '100%',
    } as CSSProperties;

    return (
        <div className={`po-root${embedded ? ' po-embedded' : ''}`} style={vars}>
            <style>{CSS}</style>
            <div className="po-wrap">
                <h1 className="po-name" aria-label={parts.name} ref={nameRef}>
                    {words.map((w, i) => <span key={i} aria-hidden="true">{w}</span>)}
                </h1>

                {parts.photo && (
                    <div className="po-photo"><img src={parts.photo} alt="" referrerPolicy="no-referrer" /></div>
                )}
                {content.bio && <p className="po-bio">{content.bio}</p>}

                <div className="po-credits">
                    {parts.links.length === 0 && <p className="po-small">{labels.noLinks}</p>}
                    {networks.length > 0 && <p className="po-kicker">{labels.findMeAt}</p>}
                    {big.map(l => <a key={l.id} href={l.url} target="_blank" rel={LINK_REL} className="po-big">{parts.labelOf(l)}</a>)}
                    {wide.length > 0 && (
                        <p className="po-line po-wide">{wide.map(l => <a key={l.id} href={l.url} target="_blank" rel={LINK_REL}>{parts.labelOf(l)}</a>)}</p>
                    )}
                    {small.length > 0 && (
                        <p className="po-line po-smallrow">{small.map(l => <a key={l.id} href={l.url} target="_blank" rel={LINK_REL}>{parts.labelOf(l)}</a>)}</p>
                    )}
                    {parts.custom.filter(l => !parts.isAdult(l)).map(l => (
                        <a key={l.id} href={l.url} target="_blank" rel={LINK_REL} className="po-custom"><span className="po-custom-label">{parts.labelOf(l)}</span><span className="po-host">{hostOf(l.url)}</span></a>
                    ))}
                </div>

                {adult.map(l => (
                    <a key={l.id} href={l.url} target="_blank" rel={LINK_REL} className="po-adult"><span className="po-adult-badge">{labels.adult}</span>{parts.labelOf(l)}{l.kind === 'custom' && <span className="po-host">{hostOf(l.url)}</span>}</a>
                ))}
                <div className="po-media"><MediaBlocks content={content} labels={labels} embedded={embedded} /></div>
                <a className="po-made" href="https://decatron.net" target="_blank" rel="noopener noreferrer">{labels.madeWith}</a>
            </div>
        </div>
    );
}

const CSS = `
.po-root{container-type:inline-size;container-name:po;background:var(--po-bg);color:var(--po-ink);font-family:var(--po-font);
  font-size:clamp(16px,calc(9px + .45vw),30px);min-height:100vh;min-height:100dvh;-webkit-font-smoothing:antialiased}
.po-root.po-embedded{font-size:16px;min-height:0}
.po-root *{box-sizing:border-box}
.po-root{--mb-text:var(--po-block-text);--mb-soft:var(--po-block-text);--mb-heading:var(--po-soft);--mb-panel:var(--po-block);--mb-line:var(--po-block);--mb-accent:var(--po-accent);--mb-on-accent:var(--po-on-accent);--mb-radius:0}
.po-media{margin-top:1.4em}
.po-wrap{container-type:inline-size;display:flex;flex-direction:column;padding:1.1em 1em 1.5em;min-height:inherit}
.po-name{margin:0;min-width:0;width:100%;overflow:hidden;font-weight:900;font-stretch:var(--po-stretch);line-height:.82;letter-spacing:-.01em;text-transform:uppercase}
.po-name span{display:block;white-space:nowrap;width:max-content;max-width:none}
.po-photo{margin-top:.9em;height:10.5em;background:var(--po-block);overflow:hidden}
.po-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(.15) contrast(1.05)}
.po-bio{margin:.8em 0 0;font-size:.9em;line-height:1.45;color:var(--po-soft);white-space:pre-line;text-align:center}
.po-credits{display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:1em;gap:.15em}
.po-kicker{margin:0;font-size:.85em;color:var(--po-soft)}
.po-credits a{color:var(--po-ink);text-decoration:none}
.po-credits a:hover{color:var(--po-accent)}
.po-big{font-size:3em;font-weight:900;line-height:1;text-transform:uppercase;font-stretch:var(--po-stretch);overflow-wrap:anywhere}
.po-line{margin:.1em 0 0;display:flex;flex-wrap:wrap;justify-content:center;gap:.3em 1em}
.po-wide{font-size:1.85em;font-weight:800;text-transform:uppercase;font-stretch:var(--po-stretch)}
.po-smallrow{font-size:1em;font-weight:700}
.po-custom{margin-top:.45em;font-size:.9em;overflow-wrap:anywhere}
.po-custom-label{text-decoration:underline;text-underline-offset:.2em}
.po-host{display:block;margin-top:.1em;font-size:.78em;font-weight:500;color:var(--po-soft);text-decoration:none}
.po-adult .po-host{display:inline;margin:0 0 0 .5em}
.po-small{margin:0;color:var(--po-soft)}
.po-adult{margin-top:1em;min-height:3em;display:flex;align-items:center;justify-content:center;gap:.6em;border:2px solid var(--po-ink);color:var(--po-ink);
  text-decoration:none;font-weight:700;font-size:.9em;padding:.4em .8em}
.po-adult-badge{background:var(--po-accent);color:var(--po-on-accent);padding:.1em .4em;font-size:.85em}
.po-made{margin-top:auto;padding-top:1em;text-align:center;font-size:.75em;color:var(--po-soft);text-decoration:none}
.po-root a:focus-visible{outline:2px solid var(--po-accent);outline-offset:3px}
@container po (min-width: 700px){ .po-wrap{max-width:38em;margin:0 auto;padding:2em 1em} .po-photo{height:14em} }
`;
