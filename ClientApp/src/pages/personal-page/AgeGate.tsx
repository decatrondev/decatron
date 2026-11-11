import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FONTS, textOn, type PersonalPageContent } from './shared';

// Confirmación de edad de la página personal (subfase 5.2). Es una declaración del visitante, no una verificación: así lo
// dicen el texto y la documentación. Se recuerda en ese navegador para todas las páginas. En 5.4 esta misma puerta
// también desbloqueará el sonido («Entrar» común a todas las plantillas).

const STORAGE_KEY = 'decatron:pp-age-ok';

function readAgeOk(): boolean {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

/** [ya confirmó, confirmar]. Si el navegador no deja guardar, la confirmación vale mientras dure la visita. */
export function useAgeOk(): [boolean, () => void] {
    const [ok, setOk] = useState(readAgeOk);
    const confirm = useCallback(() => {
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* sin storage: solo esta visita */ }
        setOk(true);
    }, []);
    return [ok, confirm];
}

/** Colores de la puerta a partir del tema y el acento de la página (para que no parezca otra web). */
export function gateVars(content: PersonalPageContent): CSSProperties {
    const light = content.theme === 'light';
    const accent = /^#[0-9a-f]{6}$/i.test(content.accent) ? content.accent : '#5B8CFF';
    const font = FONTS[content.font] ?? FONTS.archivo;
    return {
        '--ag-bg': light ? '#ECEEF1' : '#15181D', '--ag-panel': light ? '#FFFFFF' : '#20242B', '--ag-line': light ? '#CDD2DA' : '#353B46',
        '--ag-text': light ? '#14171C' : '#E8EAEE', '--ag-soft': light ? '#4B5361' : '#A9B0BC',
        '--ag-accent': accent, '--ag-on-accent': textOn(accent), '--ag-font': `'${font.family}', system-ui, sans-serif`,
        '--ag-stretch': font.wide ? '118%' : '100%',
    } as CSSProperties;
}

/** Pantalla completa antes de una página +18: no se dibuja nada de la página hasta confirmar. */
export function AgeGatePage({ content, handle, onConfirm }: { content: PersonalPageContent; handle: string; onConfirm: () => void }) {
    const { t } = useTranslation('personal-page');
    const enter = useRef<HTMLButtonElement>(null);
    useEffect(() => { enter.current?.focus(); }, []);
    return (
        <div className="ag-root" style={gateVars(content)}>
            <style>{CSS}</style>
            <main className="ag-box" aria-labelledby="ag-title">
                <p className="ag-handle">decatron.net/@{handle}</p>
                <h1 id="ag-title" className="ag-mark">18+</h1>
                <p className="ag-text">{t('ageGate.pageText')}</p>
                <div className="ag-actions">
                    <button ref={enter} type="button" className="ag-yes" onClick={onConfirm}>{t('ageGate.confirm')}</button>
                    <a className="ag-no" href="/">{t('ageGate.leave')}</a>
                </div>
                <p className="ag-note">{t('ageGate.note')}</p>
            </main>
        </div>
    );
}

/** Aviso antes de abrir un enlace +18 de una página que no es +18 entera. */
export function AdultLinkDialog({ content, host, onConfirm, onCancel }: { content: PersonalPageContent; host: string; onConfirm: () => void; onCancel: () => void }) {
    const { t } = useTranslation('personal-page');
    const yes = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        yes.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel]);
    return (
        <div className="ag-overlay" style={gateVars(content)} role="presentation" onClick={onCancel}>
            <style>{CSS}</style>
            <div className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-dialog-title" onClick={e => e.stopPropagation()}>
                <p className="ag-dialog-mark" aria-hidden="true">18+</p>
                <h2 id="ag-dialog-title" className="ag-dialog-title">{t('ageGate.linkTitle')}</h2>
                <p className="ag-text">{t('ageGate.linkText', { host })}</p>
                <div className="ag-actions">
                    <button ref={yes} type="button" className="ag-yes" onClick={onConfirm}>{t('ageGate.linkConfirm')}</button>
                    <button type="button" className="ag-no" onClick={onCancel}>{t('ageGate.cancel')}</button>
                </div>
                <p className="ag-note">{t('ageGate.note')}</p>
            </div>
        </div>
    );
}

const CSS = `
.ag-root{min-height:100vh;min-height:100dvh;background:var(--ag-bg);color:var(--ag-text);font-family:var(--ag-font);display:flex;align-items:center;justify-content:center;
  padding:24px 16px;font-size:clamp(16px,calc(9px + .45vw),28px);-webkit-font-smoothing:antialiased}
.ag-root *,.ag-overlay *{box-sizing:border-box}
.ag-box{width:100%;max-width:26em;display:flex;flex-direction:column;align-items:flex-start}
.ag-handle{margin:0;font-size:.85em;color:var(--ag-soft);overflow-wrap:anywhere}
.ag-mark{margin:.1em 0 0;font-size:6.5em;line-height:.9;font-weight:900;font-stretch:var(--ag-stretch);letter-spacing:-.02em;color:var(--ag-accent)}
.ag-text{margin:.9em 0 0;font-size:1.05em;line-height:1.45}
.ag-actions{margin-top:1.4em;display:flex;flex-wrap:wrap;gap:.6em;width:100%}
.ag-yes{min-height:3em;padding:0 1.3em;border:0;border-radius:.6em;background:var(--ag-accent);color:var(--ag-on-accent);font:inherit;font-weight:800;cursor:pointer}
.ag-no{min-height:3em;padding:0 1.1em;display:inline-flex;align-items:center;border:2px solid var(--ag-line);border-radius:.6em;background:transparent;color:var(--ag-text);
  font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.ag-yes:hover{filter:brightness(1.08)}
.ag-no:hover{border-color:var(--ag-soft)}
.ag-yes:focus-visible,.ag-no:focus-visible{outline:2px solid var(--ag-accent);outline-offset:3px}
.ag-note{margin:1.2em 0 0;font-size:.8em;line-height:1.45;color:var(--ag-soft)}
.ag-overlay{position:fixed;inset:0;z-index:60;background:rgba(8,10,14,.62);display:flex;align-items:flex-end;justify-content:center;padding:16px;
  font-family:var(--ag-font);font-size:clamp(16px,calc(9px + .45vw),26px)}
.ag-dialog{width:100%;max-width:24em;background:var(--ag-panel);color:var(--ag-text);border:1px solid var(--ag-line);border-radius:1em;padding:1.3em 1.2em 1.1em}
.ag-dialog-mark{margin:0;font-size:2.2em;line-height:1;font-weight:900;font-stretch:var(--ag-stretch);color:var(--ag-accent)}
.ag-dialog-title{margin:.35em 0 0;font-size:1.25em;font-weight:800;line-height:1.2}
@media (min-width:640px){.ag-overlay{align-items:center}}
`;
