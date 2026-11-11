import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { isTokenExpired } from '../../utils/jwt';
import { currentLoginReturn, loginUrlFor } from '../../utils/loginReturn';
import { gateVars } from './AgeGate';
import { PLATFORM_NAMES, type PersonalPageContent } from './shared';

// «Denunciar» al pie de toda página personal (subfase 5.2). Solo con sesión (decisión 2026-11-10); sin sesión se ofrece
// iniciarla y volver acá. La denuncia la revisa admin: nunca se oculta nada automáticamente.

function hasSession(): boolean {
    try { const token = localStorage.getItem('token'); return !!token && !isTokenExpired(token, 0); } catch { return false; }
}

export default function ReportBar({ handle, content, reasons }: { handle: string; content: PersonalPageContent; reasons: string[] }) {
    const { t } = useTranslation('personal-page');
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [linkId, setLinkId] = useState('');
    const [detail, setDetail] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
    const first = useRef<HTMLInputElement>(null);
    const logged = hasSession();

    useEffect(() => {
        if (!open) return;
        first.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const send = async () => {
        setSending(true);
        try {
            await api.post(`/public/personal-pages/${encodeURIComponent(handle)}/report`, { reason, detail, linkId: linkId || null });
            setResult({ ok: true, text: t('report.sent') });
        } catch (err) {
            const e = err as { response?: { status?: number; data?: { code?: string } } };
            const code = e.response?.status === 429 ? 'report_limit' : e.response?.data?.code ?? 'failed';
            setResult({ ok: false, text: t(`errors.${code}`, { defaultValue: t('errors.failed') }) });
        } finally { setSending(false); }
    };

    const close = () => { setOpen(false); if (result?.ok) { setReason(''); setLinkId(''); setDetail(''); } setResult(null); };
    const links = content.links ?? [];

    return (
        <div className="rb-bar" style={gateVars(content)}>
            <style>{CSS}</style>
            <button type="button" className="rb-open" onClick={() => setOpen(true)}>{t('report.open')}</button>
            {open && (
                <div className="rb-overlay" role="presentation" onClick={close}>
                    <div className="rb-dialog" role="dialog" aria-modal="true" aria-labelledby="rb-title" onClick={e => e.stopPropagation()}>
                        <h2 id="rb-title" className="rb-title">{t('report.title', { handle })}</h2>
                        {!logged ? (
                            <>
                                <p className="rb-text">{t('report.needLogin')}</p>
                                <div className="rb-actions">
                                    <a className="rb-primary" href={loginUrlFor(currentLoginReturn())}>{t('report.login')}</a>
                                    <button type="button" className="rb-secondary" onClick={close}>{t('report.cancel')}</button>
                                </div>
                            </>
                        ) : result?.ok ? (
                            <>
                                <p className="rb-text">{result.text}</p>
                                <div className="rb-actions"><button type="button" className="rb-primary" onClick={close}>{t('report.close')}</button></div>
                            </>
                        ) : (
                            <>
                                <fieldset className="rb-reasons">
                                    <legend className="rb-label">{t('report.reasonLabel')}</legend>
                                    {reasons.map((r, i) => (
                                        <label key={r} className={`rb-reason${reason === r ? ' rb-reason-on' : ''}`}>
                                            <input ref={i === 0 ? first : undefined} type="radio" name="rb-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                                            <span>{t(`report.reasons.${r}`)}</span>
                                        </label>
                                    ))}
                                </fieldset>
                                {links.length > 0 && (
                                    <label className="rb-field">
                                        <span className="rb-label">{t('report.linkLabel')}</span>
                                        <select value={linkId} onChange={e => setLinkId(e.target.value)}>
                                            <option value="">{t('report.wholePage')}</option>
                                            {links.map(l => <option key={l.id} value={l.id}>{l.title || PLATFORM_NAMES[l.kind] || l.kind}</option>)}
                                        </select>
                                    </label>
                                )}
                                <label className="rb-field">
                                    <span className="rb-label">{t('report.detailLabel')}</span>
                                    <textarea value={detail} maxLength={1000} rows={3} onChange={e => setDetail(e.target.value)} placeholder={t('report.detailPlaceholder')} />
                                </label>
                                {result && !result.ok && <p className="rb-error" role="alert">{result.text}</p>}
                                <div className="rb-actions">
                                    <button type="button" className="rb-primary" disabled={!reason || sending} onClick={send}>{t('report.send')}</button>
                                    <button type="button" className="rb-secondary" onClick={close}>{t('report.cancel')}</button>
                                </div>
                                <p className="rb-note">{t('report.note')}</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const CSS = `
.rb-bar{background:var(--ag-bg);border-top:1px solid var(--ag-line);display:flex;justify-content:center;padding:10px 16px;font-family:var(--ag-font);
  font-size:clamp(14px,calc(8px + .4vw),24px)}
.rb-bar *{box-sizing:border-box}
.rb-open{background:none;border:0;padding:.4em .6em;color:var(--ag-soft);font:inherit;font-size:.85em;text-decoration:underline;text-underline-offset:.2em;cursor:pointer}
.rb-open:hover{color:var(--ag-text)}
.rb-open:focus-visible,.rb-dialog :focus-visible{outline:2px solid var(--ag-accent);outline-offset:2px}
.rb-overlay{position:fixed;inset:0;z-index:60;background:rgba(8,10,14,.62);display:flex;align-items:flex-end;justify-content:center;padding:16px;
  font-size:clamp(15px,calc(9px + .4vw),24px)}
@media (min-width:640px){.rb-overlay{align-items:center}}
.rb-dialog{width:100%;max-width:26em;max-height:calc(100dvh - 32px);overflow-y:auto;background:var(--ag-panel);color:var(--ag-text);border:1px solid var(--ag-line);
  border-radius:1em;padding:1.2em 1.1em 1em}
.rb-title{margin:0;font-size:1.2em;font-weight:800;line-height:1.25;overflow-wrap:anywhere}
.rb-text{margin:.7em 0 0;line-height:1.45}
.rb-reasons{border:0;margin:.9em 0 0;padding:0;display:flex;flex-direction:column;gap:.35em}
.rb-label{display:block;font-size:.85em;font-weight:700;color:var(--ag-soft);margin-bottom:.35em;padding:0}
.rb-reason{display:flex;align-items:center;gap:.6em;min-height:2.6em;padding:0 .7em;border:1px solid var(--ag-line);border-radius:.55em;cursor:pointer}
.rb-reason input{accent-color:var(--ag-accent);width:1.05em;height:1.05em;margin:0}
.rb-reason-on{border-color:var(--ag-accent)}
.rb-field{display:block;margin-top:.9em}
.rb-field select,.rb-field textarea{width:100%;font:inherit;font-size:.95em;color:var(--ag-text);background:var(--ag-bg);border:1px solid var(--ag-line);border-radius:.5em;padding:.55em .6em}
.rb-field select{min-height:2.6em}
.rb-error{margin:.8em 0 0;color:#E5484D;font-weight:700;font-size:.9em}
.rb-actions{margin-top:1em;display:flex;flex-wrap:wrap;gap:.5em}
.rb-primary{min-height:2.8em;padding:0 1.1em;display:inline-flex;align-items:center;border:0;border-radius:.55em;background:var(--ag-accent);color:var(--ag-on-accent);
  font:inherit;font-weight:800;text-decoration:none;cursor:pointer}
.rb-primary:disabled{opacity:.5;cursor:not-allowed}
.rb-secondary{min-height:2.8em;padding:0 1em;border:2px solid var(--ag-line);border-radius:.55em;background:transparent;color:var(--ag-text);font:inherit;font-weight:700;cursor:pointer}
.rb-note{margin:.9em 0 0;font-size:.8em;line-height:1.45;color:var(--ag-soft)}
`;
