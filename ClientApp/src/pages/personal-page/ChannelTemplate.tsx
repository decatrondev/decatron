import type { CSSProperties } from 'react';
import { LINK_REL, hostOf, pageParts, textOn, type TemplateProps } from './shared';
import MediaBlocks from './MediaBlocks';

// Plantilla «Canal de TV»: la página es el canal del streamer. Arriba la identificación del canal (con líneas de pantalla) y
// debajo la guía de canales: cada red o enlace es un canal numerado. Maqueta: .dev/plans/pagina-personal/maquetas/Canal.dc.html
// La luz «al aire» de la maqueta llega con el estado en vivo real (subfase 5.5); hasta entonces no se muestra nada inventado.

const PALETTES = {
    dark: { bg: '#101317', ident: '#1E232B', line: '#262C36', text: '#DDE2E8', soft: '#C3CAD4', faint: '#9AA4B2', num: '#7E8897', scan: 'rgba(255,255,255,0.035)' },
    light: { bg: '#EEF1F4', ident: '#FFFFFF', line: '#D5DAE1', text: '#14181E', soft: '#3C4450', faint: '#5A6370', num: '#7A8492', scan: 'rgba(0,0,0,0.035)' },
} as const;

export default function ChannelTemplate({ content, channelPhotoUrl, labels, handle, embedded }: TemplateProps) {
    const p = content.theme === 'light' ? PALETTES.light : PALETTES.dark;
    const parts = pageParts(content, channelPhotoUrl);
    const nameScale = Math.min(1, 10 / Math.max(parts.name.length, 1));
    const vars = {
        '--ch-bg': p.bg, '--ch-ident': p.ident, '--ch-line': p.line, '--ch-text': p.text, '--ch-soft': p.soft, '--ch-faint': p.faint,
        '--ch-num': p.num, '--ch-scan': p.scan, '--ch-accent': parts.accent, '--ch-on-accent': textOn(parts.accent),
        '--ch-font': `'${parts.font.family}', system-ui, sans-serif`, '--ch-name-scale': String(nameScale),
    } as CSSProperties;

    return (
        <div className={`ch-root${embedded ? ' ch-embedded' : ''}`} style={vars}>
            <style>{CSS}</style>
            <div className="ch-wrap">
                <header className="ch-ident">
                    <div className="ch-scan" aria-hidden="true" />
                    {parts.photo && <img className="ch-photo" src={parts.photo} alt="" referrerPolicy="no-referrer" />}
                    {handle && <span className="ch-handle">@{handle}</span>}
                    <p className="ch-watching">{labels.nowWatching}</p>
                    <h1 className="ch-name">{parts.name}</h1>
                    {content.bio && <p className="ch-bio">{content.bio}</p>}
                </header>

                <main className="ch-body">
                    <h2 className="ch-guide-title">{labels.guide}</h2>
                    {parts.links.length === 0 && <p className="ch-empty">{labels.noLinks}</p>}
                    <ol className="ch-guide">
                        {parts.links.map((l, i) => (
                            <li key={l.id}>
                                <a href={l.url} target="_blank" rel={LINK_REL} className="ch-row">
                                    <span className="ch-num">{i + 1}</span>
                                    <span className="ch-row-text">
                                        <span className="ch-row-name">{parts.labelOf(l)}</span>
                                        <span className="ch-row-host">{hostOf(l.url)}</span>
                                    </span>
                                    {parts.isAdult(l) && <span className="ch-adult">{labels.adult}</span>}
                                </a>
                            </li>
                        ))}
                    </ol>
                    <MediaBlocks content={content} labels={labels} embedded={embedded} />
                    <a className="ch-made" href="https://decatron.net" target="_blank" rel="noopener noreferrer">{labels.madeWith}</a>
                </main>
            </div>
        </div>
    );
}

const CSS = `
.ch-root{--mb-text:var(--ch-text);--mb-soft:var(--ch-soft);--mb-panel:var(--ch-ident);--mb-line:var(--ch-line);--mb-accent:var(--ch-accent);--mb-on-accent:var(--ch-on-accent);--mb-radius:.5em}
.ch-root{container-type:inline-size;container-name:ch;background:var(--ch-bg);color:var(--ch-text);font-family:var(--ch-font);
  font-size:clamp(16px,calc(9px + .45vw),30px);min-height:100vh;min-height:100dvh;-webkit-font-smoothing:antialiased}
.ch-root.ch-embedded{font-size:16px;min-height:0}
.ch-root *{box-sizing:border-box}
.ch-wrap{display:flex;flex-direction:column;min-height:inherit;padding:1em}
.ch-ident{position:relative;overflow:hidden;min-height:18.5em;border-radius:1.4em;background:var(--ch-ident);border:1px solid var(--ch-line);
  padding:1.25em;display:flex;flex-direction:column;justify-content:flex-end}
.ch-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,var(--ch-scan) 0 1px,transparent 1px 4px);pointer-events:none}
.ch-photo{position:absolute;top:1em;left:1em;width:3.2em;height:3.2em;border-radius:.6em;object-fit:cover;border:2px solid var(--ch-accent)}
.ch-handle{position:absolute;top:1.15em;right:1.15em;font-size:.8em;color:var(--ch-faint)}
.ch-watching{position:relative;margin:0;font-size:.85em;color:var(--ch-faint)}
.ch-name{position:relative;margin:.1em 0 0;font-size:calc(3.9em * var(--ch-name-scale));font-weight:900;font-style:italic;line-height:.88;letter-spacing:-.03em;overflow-wrap:anywhere}
.ch-name::after{content:"";display:block;width:2.2em;height:.12em;margin-top:.18em;background:var(--ch-accent)}
.ch-bio{position:relative;margin:.65em 0 0;font-size:.95em;line-height:1.45;color:var(--ch-soft);white-space:pre-line}
.ch-body{padding:1.1em 0 0;display:flex;flex-direction:column;flex:1}
.ch-guide-title{margin:0 0 .35em;font-size:1.1em;font-weight:800}
.ch-guide{list-style:none;margin:0;padding:0}
.ch-row{display:grid;grid-template-columns:2.75em minmax(0,1fr) auto;align-items:center;gap:.6em;min-height:3.25em;border-top:1px solid var(--ch-line);
  color:var(--ch-text);text-decoration:none}
.ch-row:hover .ch-row-name{color:var(--ch-accent)}
.ch-num{font-size:1.4em;font-weight:900;color:var(--ch-num);font-variant-numeric:tabular-nums}
.ch-row-name{display:block;font-size:1em;font-weight:700;overflow-wrap:anywhere}
.ch-row-host{display:block;font-size:.8em;color:var(--ch-faint)}
.ch-adult{font-size:.75em;font-weight:800;padding:.15em .45em;border-radius:.35em;background:var(--ch-accent);color:var(--ch-on-accent)}
.ch-empty{margin:0;color:var(--ch-faint)}
.ch-body>.mb-root{margin-top:1.2em}
.ch-made{margin-top:auto;padding-top:1.2em;text-align:center;font-size:.75em;color:var(--ch-faint);text-decoration:none}
.ch-root a:focus-visible{outline:2px solid var(--ch-accent);outline-offset:3px}
@container ch (min-width: 700px){ .ch-wrap{max-width:38em;margin:0 auto;padding:2em 1em} .ch-ident{min-height:22em;padding:2em} .ch-name{font-size:calc(4.8em * var(--ch-name-scale))} }
`;
