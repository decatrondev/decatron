import { useState, type CSSProperties } from 'react';
import { LINK_REL, PLATFORM_INITIALS, hostOf, pageParts, textOn, type TemplateProps } from './shared';
import MediaBlocks from './MediaBlocks';

// Plantilla «Inventario»: cada red o enlace es una casilla de inventario de juego, de 1×1, 2×1 o 2×2 (el tamaño del enlace).
// Al tocar una casilla se abre su ficha con el botón para ir. Maqueta: .dev/plans/pagina-personal/maquetas/Inventario.dc.html

const PALETTES = {
    dark: { bg: '#14171C', cell: '#232831', line: '#3A414D', text: '#E4E7EC', soft: '#A3ABB8', card: '#1B1F26', faint: '#737C8A' },
    light: { bg: '#EEF0F3', cell: '#FFFFFF', line: '#CDD2DA', text: '#14171C', soft: '#4B5361', card: '#FFFFFF', faint: '#5E6673' },
} as const;

const SPAN: Record<string, [number, number]> = { normal: [1, 1], wide: [2, 1], big: [2, 2] };

export default function InventoryTemplate({ content, channelPhotoUrl, labels, embedded }: TemplateProps) {
    const p = content.theme === 'light' ? PALETTES.light : PALETTES.dark;
    const parts = pageParts(content, channelPhotoUrl);
    const [selected, setSelected] = useState<string | null>(null);
    const current = parts.links.find(l => l.id === selected) ?? parts.links[0];
    const vars = {
        '--in-bg': p.bg, '--in-cell': p.cell, '--in-line': p.line, '--in-text': p.text, '--in-soft': p.soft, '--in-card': p.card, '--in-faint': p.faint,
        '--in-accent': parts.accent, '--in-on-accent': textOn(parts.accent), '--in-font': `'${parts.font.family}', system-ui, sans-serif`,
        '--in-stretch': parts.font.wide ? '118%' : '100%',
    } as CSSProperties;

    return (
        <div className={`in-root${embedded ? ' in-embedded' : ''}`} style={vars}>
            <style>{CSS}</style>
            <div className="in-wrap">
                <header className="in-head">
                    <div className="in-photo">{parts.photo ? <img src={parts.photo} alt="" referrerPolicy="no-referrer" /> : <span>{parts.initials}</span>}</div>
                    <div className="in-title">
                        <h1 className="in-name">{parts.name}</h1>
                        {content.bio && <p className="in-bio">{content.bio}</p>}
                    </div>
                </header>

                {parts.links.length === 0 ? <p className="in-empty">{labels.noLinks}</p> : (
                    <>
                        <div className="in-grid">
                            {parts.links.map(l => {
                                const [w, h] = SPAN[l.size ?? 'normal'] ?? SPAN.normal;
                                const active = current?.id === l.id;
                                return (
                                    <button key={l.id} type="button" onClick={() => setSelected(l.id)} aria-pressed={active}
                                        className={`in-cell${active ? ' in-active' : ''}`} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}` }}>
                                        <span className={`in-ico${h > 1 ? ' in-ico-big' : ''}`}>{l.kind === 'custom' ? parts.labelOf(l) : PLATFORM_INITIALS[l.kind] ?? '•'}</span>
                                        <span className="in-cell-name">{l.kind === 'custom' ? hostOf(l.url) : parts.labelOf(l)}</span>
                                        {parts.isAdult(l) && <span className="in-adult">{labels.adult}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        {current && (
                            <div className="in-card" aria-live="polite">
                                <p className="in-card-name">{parts.labelOf(current)}</p>
                                <p className="in-card-host">{labels.opensIn(hostOf(current.url))}</p>
                                <a href={current.url} target="_blank" rel={LINK_REL} className="in-go">{labels.open}</a>
                            </div>
                        )}
                    </>
                )}
                <MediaBlocks content={content} labels={labels} embedded={embedded} />
                <a className="in-made" href="https://decatron.net" target="_blank" rel="noopener noreferrer">{labels.madeWith}</a>
            </div>
        </div>
    );
}

const CSS = `
.in-root{container-type:inline-size;container-name:in;background:var(--in-bg);color:var(--in-text);font-family:var(--in-font);
  font-size:clamp(16px,calc(9px + .45vw),30px);min-height:100vh;min-height:100dvh;-webkit-font-smoothing:antialiased}
.in-root.in-embedded{font-size:16px;min-height:0}
.in-root *{box-sizing:border-box}
.in-root{--mb-text:var(--in-text);--mb-soft:var(--in-soft);--mb-panel:var(--in-cell);--mb-line:var(--in-line);--mb-accent:var(--in-accent);--mb-on-accent:var(--in-on-accent);--mb-radius:.65em}
.in-wrap{display:flex;flex-direction:column;gap:1em;padding:1.25em 1em 1.5em;min-height:inherit}
.in-head{display:flex;align-items:center;gap:.9em}
.in-photo{width:4.25em;height:4.25em;border-radius:.75em;border:2px solid var(--in-accent);background:var(--in-cell);overflow:hidden;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1em}
.in-photo img{width:100%;height:100%;object-fit:cover}
.in-photo span{font-size:1.5em;font-stretch:var(--in-stretch)}
.in-title{min-width:0}
.in-name{margin:0;font-size:1.9em;font-weight:800;font-stretch:var(--in-stretch);line-height:1;overflow-wrap:anywhere}
.in-bio{margin:.3em 0 0;font-size:.875em;line-height:1.4;color:var(--in-soft);white-space:pre-line}
.in-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:4.9em;grid-auto-flow:dense;gap:.5em}
.in-cell{position:relative;background:var(--in-cell);border:2px solid var(--in-line);border-radius:.65em;color:var(--in-text);font-family:inherit;
  display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;padding:.5em .6em;cursor:pointer;text-align:left;min-width:0}
.in-cell:hover{border-color:var(--in-accent)}
.in-active{border-color:var(--in-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--in-accent) 35%,transparent)}
.in-ico{font-size:1.35em;font-weight:800;font-stretch:var(--in-stretch);line-height:1;overflow:hidden;text-overflow:ellipsis;max-width:100%;white-space:nowrap}
.in-ico-big{font-size:1.9em;white-space:normal;overflow-wrap:anywhere}
.in-cell-name{font-size:.72em;color:var(--in-soft);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.in-adult{position:absolute;top:.35em;right:.35em;font-size:.65em;font-weight:800;padding:.1em .35em;border-radius:.3em;background:var(--in-accent);color:var(--in-on-accent)}
.in-card{background:var(--in-card);border:1px solid var(--in-line);border-radius:.65em;padding:.8em .9em;display:flex;flex-direction:column;gap:.25em}
.in-card-name{margin:0;font-size:1.05em;font-weight:700;font-stretch:var(--in-stretch);overflow-wrap:anywhere}
.in-card-host{margin:0;font-size:.85em;color:var(--in-soft)}
.in-go{margin-top:.4em;align-self:flex-start;min-height:2.6em;display:flex;align-items:center;padding:0 .9em;border-radius:.5em;background:var(--in-accent);
  color:var(--in-on-accent);text-decoration:none;font-weight:700;font-size:.9em}
.in-empty{margin:0;color:var(--in-faint)}
.in-made{margin-top:auto;text-align:center;font-size:.75em;color:var(--in-faint);text-decoration:none}
.in-root a:focus-visible,.in-root button:focus-visible{outline:2px solid var(--in-accent);outline-offset:3px}
@container in (min-width: 700px){ .in-wrap{max-width:38em;margin:0 auto;padding:2em 1em} .in-grid{grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:5.4em} }
`;
