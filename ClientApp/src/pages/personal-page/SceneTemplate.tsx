import type { CSSProperties } from 'react';
import { ADULT_KINDS, FONTS, PLATFORM_INITIALS, PLATFORM_NAMES, hostOf, textOn, type PageLabels, type TemplateProps } from './shared';

// Plantilla «Escena» (subfase 5.1, sin capas todavía: llegan en 5.3). Maqueta: .dev/plans/pagina-personal/maquetas/Main.dc.html.
// La misma pieza dibuja la página pública y la vista previa del panel. En escritorio se mantiene la composición de la
// maqueta, centrada y más grande (container queries: la vista previa de celular del panel se ve como en un celular).

const PALETTES = {
    dark: { bg: '#1A1D23', panel: '#262A33', line: '#353B47', text: '#E9EBEF', soft: '#B7BECB', faint: '#8A93A3', scene: '#0F1218', stripeA: '#141821', stripeB: '#10131A' },
    light: { bg: '#EEF0F3', panel: '#FFFFFF', line: '#D3D8E0', text: '#15181D', soft: '#4A5260', faint: '#6A7280', scene: '#DCE0E6', stripeA: '#D5DAE1', stripeB: '#DCE0E6' },
} as const;

export type SceneLabels = PageLabels;

export default function SceneTemplate({ content, channelPhotoUrl, labels, embedded }: TemplateProps) {
    const p = content.theme === 'light' ? PALETTES.light : PALETTES.dark;
    const font = FONTS[content.font] ?? FONTS.archivo;
    const accent = /^#[0-9a-f]{6}$/i.test(content.accent) ? content.accent : '#5B8CFF';
    const onAccent = textOn(accent);
    const photo = content.avatarUrl || channelPhotoUrl || '';
    const name = content.displayName || '';
    const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '·';
    // Un nombre largo baja de tamaño para no partirse letra por letra
    const nameScale = Math.min(1, 11 / Math.max(name.length, 1));
    const links = (content.links ?? []).filter(l => l.visible !== false);
    const networks = links.filter(l => l.kind !== 'custom');
    const custom = links.filter(l => l.kind === 'custom');

    const vars = {
        '--pp-bg': p.bg, '--pp-panel': p.panel, '--pp-line': p.line, '--pp-text': p.text, '--pp-soft': p.soft, '--pp-faint': p.faint,
        '--pp-scene': p.scene, '--pp-stripe-a': p.stripeA, '--pp-stripe-b': p.stripeB, '--pp-accent': accent, '--pp-on-accent': onAccent,
        '--pp-font': `'${font.family}', system-ui, sans-serif`, '--pp-name-scale': String(nameScale), '--pp-name-stretch': font.wide ? '125%' : '100%',
    } as CSSProperties;

    return (
        <div className={`pp-scene-root${embedded ? ' pp-embedded' : ''}`} style={vars}>
            <style>{CSS}</style>
            <div className="pp-wrap">
                <header className="pp-scene">
                    <div className="pp-stripes" aria-hidden="true" />
                    <div className="pp-photo">
                        {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
                    </div>
                    <div className="pp-title">
                        <h1 className="pp-name">{name}</h1>
                        {content.bio && <p className="pp-bio">{content.bio}</p>}
                    </div>
                </header>

                <main className="pp-body">
                    {networks.length > 0 && (
                        <ul className="pp-networks">
                            {networks.map(l => (
                                <li key={l.id}>
                                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="pp-network" aria-label={l.title || PLATFORM_NAMES[l.kind] || l.kind}>
                                        <span className="pp-tile">{PLATFORM_INITIALS[l.kind] ?? '•'}</span>
                                        <span className="pp-tile-name">{l.title || PLATFORM_NAMES[l.kind] || l.kind}</span>
                                        {(l.adult || ADULT_KINDS.includes(l.kind)) && <span className="pp-adult">{labels.adult}</span>}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}

                    {custom.length > 0 && (
                        <ul className="pp-links">
                            {custom.map(l => (
                                <li key={l.id}>
                                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="pp-link">
                                        <span className="pp-link-text">
                                            <span className="pp-link-title">{l.adult && <span className="pp-link-adult">{labels.adult}</span>}{l.title}</span>
                                            <span className="pp-link-host">{labels.opensIn(hostOf(l.url))}</span>
                                        </span>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}

                    {links.length === 0 && <p className="pp-empty">{labels.noLinks}</p>}

                    <footer className="pp-footer">
                        <a href="https://decatron.net" target="_blank" rel="noopener noreferrer">{labels.madeWith}</a>
                    </footer>
                </main>
            </div>
        </div>
    );
}

const CSS = `
.pp-scene-root{container-type:inline-size;container-name:pp;background:var(--pp-bg);color:var(--pp-text);font-family:var(--pp-font);
  font-size:clamp(16px,calc(9px + .45vw),30px);min-height:100vh;min-height:100dvh;-webkit-font-smoothing:antialiased}
.pp-scene-root.pp-embedded{font-size:16px;min-height:0}
.pp-scene-root *{box-sizing:border-box}
.pp-wrap{display:flex;flex-direction:column;min-height:inherit}
.pp-scene{position:relative;overflow:hidden;background:var(--pp-scene);min-height:21em;padding:1.25em;display:flex;flex-direction:column;justify-content:flex-end;gap:1em}
.pp-stripes{position:absolute;inset:0;background:repeating-linear-gradient(115deg,var(--pp-stripe-a) 0 .9em,var(--pp-stripe-b) .9em 1.8em)}
.pp-photo{position:absolute;left:1.25em;top:2.6em;width:6.5em;height:6.5em;border-radius:50%;border:.25em solid var(--pp-accent);background:var(--pp-panel);
  display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:800;font-size:1em}
.pp-photo img{width:100%;height:100%;object-fit:cover}
.pp-photo span{font-size:2.1em}
.pp-title{position:relative;margin-top:9.5em}
.pp-name{margin:0;font-weight:900;font-stretch:var(--pp-name-stretch);font-size:calc(3.4em * var(--pp-name-scale));line-height:.92;letter-spacing:-.01em;overflow-wrap:anywhere}
.pp-bio{margin:.7em 0 0;font-size:.95em;line-height:1.45;color:var(--pp-soft);white-space:pre-line;max-width:34em}
.pp-body{padding:1em 1em 1.5em;display:flex;flex-direction:column;gap:1em;flex:1}
.pp-networks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(4.6em,1fr));gap:.6em}
.pp-network{position:relative;display:flex;flex-direction:column;align-items:center;gap:.4em;text-decoration:none;color:var(--pp-text);padding:.2em;border-radius:.9em}
.pp-tile{width:3.5em;height:3.5em;border-radius:.9em;background:var(--pp-panel);border:1px solid var(--pp-line);display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:1.15em;font-stretch:var(--pp-name-stretch)}
.pp-network:hover .pp-tile{border-color:var(--pp-accent)}
.pp-tile-name{font-size:.75em;color:var(--pp-soft);text-align:center;overflow-wrap:anywhere}
.pp-link-adult{display:inline-block;margin-right:.45em;font-size:.72em;font-weight:800;padding:.08em .4em;border-radius:.35em;vertical-align:.12em;background:var(--pp-accent);color:var(--pp-on-accent)}
.pp-adult{position:absolute;top:0;right:.2em;font-size:.65em;font-weight:800;padding:.1em .4em;border-radius:.4em;background:var(--pp-accent);color:var(--pp-on-accent)}
.pp-links{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.6em}
.pp-link{display:flex;align-items:center;gap:.8em;min-height:3.4em;padding:.75em .9em;border:1px solid var(--pp-line);border-radius:.65em;text-decoration:none;color:var(--pp-text);background:transparent}
.pp-link:hover{border-color:var(--pp-accent)}
.pp-link svg{flex-shrink:0;color:var(--pp-soft);width:1.25em;height:1.25em}
.pp-link-text{flex:1;min-width:0}
.pp-link-title{display:block;font-weight:700;font-size:1em;overflow-wrap:anywhere}
.pp-link-host{display:block;font-size:.8em;color:var(--pp-faint);margin-top:.15em}
.pp-empty{margin:0;color:var(--pp-faint);font-size:.9em}
.pp-footer{margin-top:auto;padding-top:1em;text-align:center;font-size:.75em}
.pp-footer a{color:var(--pp-faint);text-decoration:none}
.pp-footer a:hover{color:var(--pp-text)}
.pp-scene-root a:focus-visible{outline:2px solid var(--pp-accent);outline-offset:3px}
/* Escritorio: la misma composición de la maqueta, centrada y más grande (no dos columnas) */
@container pp (min-width: 700px){
  .pp-wrap{width:100%;max-width:38em;margin:0 auto}
  .pp-scene{min-height:24em;padding:2em}
  .pp-photo{left:2em;top:2.5em;width:8em;height:8em}
  .pp-photo span{font-size:2.6em}
  .pp-title{margin-top:10.5em}
  .pp-name{font-size:calc(4.2em * var(--pp-name-scale))}
  .pp-body{padding:1.5em 2em 2em}
  .pp-networks{grid-template-columns:repeat(auto-fill,minmax(5.2em,1fr))}
}
@media (prefers-reduced-motion: reduce){.pp-scene-root *{transition:none!important;animation:none!important}}
`;
