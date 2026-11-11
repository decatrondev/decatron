import { LINK_REL, type LiveInfo, type PageLabels } from './shared';

// «En vivo ahora» (subfase 5.5): una fila por plataforma donde el canal está en directo, arriba de las redes en las cinco
// plantillas. Usa los colores de cada plantilla (variables --mb-*); el rojo es solo la señal de «en vivo».

const NAMES: Record<string, string> = { twitch: 'Twitch', kick: 'Kick' };

export default function LiveStrip({ live, labels }: { live?: LiveInfo[]; labels: PageLabels }) {
    if (!live || live.length === 0) return null;
    return (
        <div className="ls-root">
            <style>{CSS}</style>
            {live.map(l => (
                <a key={l.platform} className="ls-row" href={l.url} target="_blank" rel={LINK_REL}>
                    <span className="ls-dot" aria-hidden="true" />
                    <span className="ls-text">{labels.liveOn(NAMES[l.platform] ?? l.platform)}</span>
                    <span className="ls-go">{labels.watchLive}</span>
                </a>
            ))}
        </div>
    );
}

const CSS = `
.ls-root{display:flex;flex-direction:column;gap:.5em;width:100%}
.ls-row{display:flex;align-items:center;gap:.7em;min-height:3.2em;padding:.5em .6em .5em .9em;border-radius:var(--mb-radius,.75em);border:1px solid var(--mb-line);
  background:var(--mb-panel);color:var(--mb-text);text-decoration:none;font-weight:700;box-sizing:border-box}
.ls-dot{width:.7em;height:.7em;border-radius:50%;background:#E5484D;flex-shrink:0;box-shadow:0 0 0 0 rgba(229,72,77,.55);animation:ls-pulse 1.8s ease-out infinite}
.ls-text{flex:1;min-width:0;overflow-wrap:anywhere}
.ls-go{flex-shrink:0;padding:.45em .8em;border-radius:calc(var(--mb-radius,.75em) * .7);background:var(--mb-accent);color:var(--mb-on-accent);font-size:.85em}
.ls-row:hover .ls-go{filter:brightness(1.08)}
.ls-row:focus-visible{outline:2px solid var(--mb-accent);outline-offset:3px}
@keyframes ls-pulse{0%{box-shadow:0 0 0 0 rgba(229,72,77,.55)}70%{box-shadow:0 0 0 .55em rgba(229,72,77,0)}100%{box-shadow:0 0 0 0 rgba(229,72,77,0)}}
@media (prefers-reduced-motion: reduce){.ls-dot{animation:none}}
`;
