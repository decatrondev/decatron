import { useEffect, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import { LINK_REL, hostOf, pageParts, textOn, type TemplateProps } from './shared';
import MediaBlocks from './MediaBlocks';

// Plantilla «Credencial»: un pase de backstage colgado de una cinta del color de acento. Al frente, foto, nombre, @nombre
// y un QR que abre la página; al girarla, las redes y enlaces. Maqueta: .dev/plans/pagina-personal/maquetas/Credencial.dc.html

const PALETTES = {
    dark: { bg: '#16181D', card: '#E6E7EA', ink: '#16181D', soft: '#4A4F59', line: '#C9CCD2', photo: '#2A2E36', clip: '#8A8F99', btnText: '#E6E7EA', btnLine: '#4A4F59', faint: '#8A8F99' },
    light: { bg: '#D9DCE1', card: '#FFFFFF', ink: '#16181D', soft: '#4A4F59', line: '#D3D6DC', photo: '#2A2E36', clip: '#6A707B', btnText: '#16181D', btnLine: '#8A8F99', faint: '#4A4F59' },
} as const;

export default function BadgeTemplate({ content, channelPhotoUrl, labels, handle, embedded }: TemplateProps) {
    const p = content.theme === 'light' ? PALETTES.light : PALETTES.dark;
    const parts = pageParts(content, channelPhotoUrl);
    const [back, setBack] = useState(false);
    const [qr, setQr] = useState('');
    const url = handle ? `https://decatron.net/@${handle}` : '';

    useEffect(() => {
        if (!url) { setQr(''); return; }
        let alive = true;
        QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#16181D', light: '#FFFFFF' } })
            .then((d: string) => { if (alive) setQr(d); })
            .catch(() => { if (alive) setQr(''); });
        return () => { alive = false; };
    }, [url]);

    const vars = {
        '--bd-bg': p.bg, '--bd-card': p.card, '--bd-ink': p.ink, '--bd-soft': p.soft, '--bd-line': p.line, '--bd-photo': p.photo,
        '--bd-clip': p.clip, '--bd-btn': p.btnText, '--bd-btn-line': p.btnLine, '--bd-faint': p.faint,
        '--bd-accent': parts.accent, '--bd-on-accent': textOn(parts.accent), '--bd-font': `'${parts.font.family}', system-ui, sans-serif`,
    } as CSSProperties;

    return (
        <div className={`bd-root${embedded ? ' bd-embedded' : ''}`} style={vars}>
            <style>{CSS}</style>
            <div className="bd-wrap">
                <div className="bd-strap" aria-hidden="true"><span /><span /></div>
                <div className="bd-clip" aria-hidden="true" />
                <article className="bd-card">
                    <div className="bd-slot" aria-hidden="true" />
                    {!back ? (
                        <div className="bd-front">
                            <div className="bd-photo">
                                {parts.photo ? <img src={parts.photo} alt="" referrerPolicy="no-referrer" /> : <span>{parts.initials}</span>}
                            </div>
                            <div>
                                <h1 className="bd-name">{parts.name}</h1>
                                {handle && <p className="bd-handle">@{handle}</p>}
                            </div>
                            {content.bio && <p className="bd-bio">{content.bio}</p>}
                            {qr && (
                                <div className="bd-qr-row">
                                    <span className="bd-url">decatron.net/@{handle}</span>
                                    <img className="bd-qr" src={qr} alt={labels.qrAlt} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bd-back">
                            <h2 className="bd-back-title">{labels.whereToFind}</h2>
                            {parts.links.length === 0 && <p className="bd-empty">{labels.noLinks}</p>}
                            <ul className="bd-list">
                                {parts.links.filter(l => !parts.isAdult(l)).map(l => (
                                    <li key={l.id}>
                                        <a href={l.url} target="_blank" rel={LINK_REL} className="bd-row">
                                            <span className="bd-row-name">{parts.labelOf(l)}</span>
                                            <span className="bd-row-host">{hostOf(l.url)}</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            {parts.links.filter(l => parts.isAdult(l)).map(l => (
                                <a key={l.id} href={l.url} target="_blank" rel={LINK_REL} className="bd-stamp">
                                    <span className="bd-stamp-badge">{labels.adult}</span>
                                    <span>{parts.labelOf(l)}</span>
                                </a>
                            ))}
                        </div>
                    )}
                </article>
                <button type="button" className="bd-flip" onClick={() => setBack(b => !b)} aria-pressed={back}>{back ? labels.flipBack : labels.flip}</button>
                <MediaBlocks content={content} labels={labels} embedded={embedded} />
                <a className="bd-made" href="https://decatron.net" target="_blank" rel="noopener noreferrer">{labels.madeWith}</a>
            </div>
        </div>
    );
}

const CSS = `
.bd-root{--mb-text:var(--bd-ink);--mb-soft:var(--bd-soft);--mb-heading:var(--bd-faint);--mb-panel:var(--bd-card);--mb-line:var(--bd-line);--mb-accent:var(--bd-accent);--mb-on-accent:var(--bd-on-accent);--mb-radius:.6em}
.bd-root{container-type:inline-size;container-name:bd;background:var(--bd-bg);color:var(--bd-ink);font-family:var(--bd-font);
  font-size:clamp(16px,calc(9px + .45vw),30px);min-height:100vh;min-height:100dvh;-webkit-font-smoothing:antialiased;overflow:hidden}
.bd-root.bd-embedded{font-size:16px;min-height:0}
.bd-root *{box-sizing:border-box}
.bd-wrap{display:flex;flex-direction:column;align-items:center;padding:0 1em 1.5em;max-width:26em;margin:0 auto}
.bd-strap{display:flex;gap:2.5em;height:5em}
.bd-strap span{display:block;width:1.6em;height:100%;background:var(--bd-accent)}
.bd-strap span:first-child{transform:skewX(12deg)}
.bd-strap span:last-child{transform:skewX(-12deg)}
.bd-clip{width:3.4em;height:1.4em;border-radius:.4em;background:var(--bd-clip);margin-top:-.4em;position:relative;z-index:2}
.bd-card{position:relative;width:100%;margin-top:-.6em;background:var(--bd-card);border-radius:1.1em;padding:1.7em 1.4em 1.3em;transform:rotate(-2deg);
  box-shadow:0 1.2em 2.4em rgba(0,0,0,.28);transform-origin:50% 0;animation:bd-swing 1.6s ease-out 1}
.bd-slot{position:absolute;top:.75em;left:50%;margin-left:-1.5em;width:3em;height:.5em;border-radius:.3em;background:var(--bd-bg)}
@keyframes bd-swing{0%{transform:rotate(4deg)}35%{transform:rotate(-4deg)}65%{transform:rotate(0deg)}100%{transform:rotate(-2deg)}}
.bd-front{display:flex;flex-direction:column;gap:.9em}
.bd-photo{position:relative;height:12.5em;border-radius:.65em;background:var(--bd-photo);overflow:hidden;display:flex;align-items:flex-end;padding:.8em;color:#E6E7EA}
.bd-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.bd-photo span{font-size:4em;font-weight:700;line-height:1}
.bd-name{margin:0;font-size:2.25em;font-weight:700;line-height:1;letter-spacing:-.02em;overflow-wrap:anywhere}
.bd-handle{margin:.35em 0 0;font-size:.95em;color:var(--bd-soft)}
.bd-bio{margin:0;font-size:.9em;line-height:1.45;color:var(--bd-soft);white-space:pre-line}
.bd-qr-row{display:flex;align-items:flex-end;justify-content:space-between;gap:.8em;border-top:1px dashed var(--bd-line);padding-top:.9em}
.bd-url{font-size:.8em;color:var(--bd-soft);overflow-wrap:anywhere}
.bd-qr{width:5.8em;height:5.8em;border-radius:.4em;background:#fff;flex-shrink:0}
.bd-back{display:flex;flex-direction:column;gap:.3em;min-height:20em}
.bd-back-title{margin:0 0 .4em;font-size:1.4em;font-weight:700}
.bd-list{list-style:none;margin:0;padding:0}
.bd-row{display:flex;justify-content:space-between;align-items:center;gap:.6em;min-height:2.75em;border-bottom:1px solid var(--bd-line);color:var(--bd-ink);text-decoration:none;font-weight:600}
.bd-row:hover .bd-row-name{text-decoration:underline}
.bd-row-name{overflow-wrap:anywhere}
.bd-row-host{font-size:.85em;font-weight:400;color:var(--bd-soft);flex-shrink:0}
.bd-stamp{margin-top:.9em;display:flex;align-items:center;gap:.6em;min-height:3.4em;padding:.5em .9em;border:2px solid #B4232A;border-radius:.5em;color:#B4232A;
  text-decoration:none;font-weight:700;transform:rotate(-3deg)}
.bd-stamp-badge{background:#B4232A;color:#fff;border-radius:.3em;padding:.1em .4em;font-size:.8em}
.bd-empty{margin:0;color:var(--bd-soft)}
.bd-flip{margin-top:1.9em;min-height:3em;min-width:12.5em;border:1px solid var(--bd-btn-line);border-radius:1.5em;background:transparent;color:var(--bd-btn);
  font-family:inherit;font-size:.95em;font-weight:600;cursor:pointer}
.bd-flip:hover{border-color:var(--bd-accent)}
.bd-wrap>.mb-root{margin-top:1.6em}
.bd-made{margin-top:.9em;font-size:.75em;color:var(--bd-faint);text-decoration:none}
.bd-root a:focus-visible,.bd-root button:focus-visible{outline:2px solid var(--bd-accent);outline-offset:3px}
@container bd (min-width: 700px){ .bd-wrap{max-width:30em} .bd-photo{height:14em} }
@media (prefers-reduced-motion: reduce){.bd-card{animation:none}}
`;
