import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Loader2, Pencil, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import api from '../../services/api';

// Emotes globales de Decatron: el set de la plataforma que se ve en todos los canales (prioridad más baja).
// Lo manejan los admins del sistema y quienes el dueño autorice por usuario de Twitch.

interface GlobalEmote {
    id: number; name: string; status: 'approved' | 'hidden' | 'removed'; animated: boolean; zeroWidth: boolean;
    uploadedBy: string; removedAt?: string | null; removedBy?: string | null; urls: { x1: string; x2: string; x4: string };
}
interface Manager { id: number; login: string; addedBy: string }
interface LogRow { id: number; actor: string; action: string; detail?: string | null; createdAt: string }
interface Req { id: number; login: string; message?: string | null; createdAt: string }
const TRASH_DAYS = 30;

const card = 'rounded-lg border border-ds-border bg-ds-surface p-4 3xl:p-6 ';
const input = 'px-3 py-2 rounded-lg border border-ds-border bg-ds-surface text-sm 3xl:text-base text-ds-text ';
const btnBlue = 'px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-ds-accent text-ds-on-accent hover:bg-ds-accent-hover disabled:opacity-50 flex items-center gap-2';
const iconBtn = 'p-2 rounded-lg bg-ds-raised text-ds-soft hover:bg-ds-raised ';

/** Gestor de los emotes globales. `embedded` lo deja sin cabecera ni pantalla completa para usarlo dentro de la página pública. */
export default function GlobalEmotesAdmin({ embedded = false }: { embedded?: boolean }) {
    const { t } = useTranslation('emotes');
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [emotes, setEmotes] = useState<GlobalEmote[]>([]);
    const [managers, setManagers] = useState<Manager[] | null>(null);
    const [name, setName] = useState('');
    const [zeroWidth, setZeroWidth] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
    const [collision, setCollision] = useState(false);
    const [login, setLogin] = useState('');
    const [canRestore, setCanRestore] = useState(false);
    const [requests, setRequests] = useState<Req[]>([]);
    const [log, setLog] = useState<LogRow[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    const err = (code?: string) => t(`global.errors.${code}`, { defaultValue: t(`errors.${code}`, { defaultValue: code ?? 'error' }) });

    const load = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/global-emotes');
            setEmotes(data.emotes ?? []);
            setManagers(data.managers ?? null);
            setCanRestore(!!data.canRestore);
            setRequests(data.requests ?? []);
            if (data.canRestore) {
                try { setLog((await api.get('/admin/global-emotes/log')).data.log ?? []); } catch { /* sin historial */ }
            }
            setError(null);
        } catch (e: any) {
            setError(e?.response?.status === 403 ? 'forbidden' : 'load');
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    // Avisa en vivo si el nombre choca con un global de 7TV/BTTV/FFZ
    useEffect(() => {
        const n = name.trim();
        if (n.length < 2) { setCollision(false); return; }
        const h = setTimeout(async () => {
            try { const { data } = await api.get('/admin/global-emotes/check', { params: { name: n } }); setCollision(!!data.collides); } catch { setCollision(false); }
        }, 400);
        return () => clearTimeout(h);
    }, [name]);

    const upload = async () => {
        if (!file || !name.trim()) return;
        setBusy(true); setNotice(null);
        try {
            const form = new FormData();
            form.append('file', file); form.append('name', name.trim()); form.append('zeroWidth', String(zeroWidth));
            const { data } = await api.post('/admin/global-emotes', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setNotice(data.collides ? { kind: 'warn', text: t('global.collides', { name: name.trim() }) } : { kind: 'ok', text: t('global.saved') });
            setName(''); setFile(null); setZeroWidth(false); if (fileRef.current) fileRef.current.value = '';
            await load();
        } catch (e: any) { setNotice({ kind: 'err', text: err(e?.response?.data?.error) }); }
        finally { setBusy(false); }
    };

    const patch = async (e: GlobalEmote, body: object) => {
        try { await api.patch(`/admin/global-emotes/${e.id}`, body); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };
    const rename = (e: GlobalEmote) => {
        const n = window.prompt(t('global.rename'), e.name);
        if (n && n.trim() !== e.name) patch(e, { name: n.trim() });
    };
    const remove = async (e: GlobalEmote) => {
        if (!window.confirm(t('global.confirmDelete', { name: e.name, days: TRASH_DAYS }))) return;
        try { await api.delete(`/admin/global-emotes/${e.id}`); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };
    const restore = async (e: GlobalEmote) => {
        try { await api.post(`/admin/global-emotes/${e.id}/restore`); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };
    const purge = async (e: GlobalEmote) => {
        if (!window.confirm(t('global.confirmPurge', { name: e.name }))) return;
        try { await api.delete(`/admin/global-emotes/${e.id}/purge`); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };
    const daysLeft = (e: GlobalEmote) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(e.removedAt ?? Date.now()).getTime()) / 86400000));
    const addManager = async () => {
        if (!login.trim()) return;
        try { await api.post('/admin/global-emotes/managers', { login: login.trim() }); setLogin(''); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };
    const resolveRequest = async (r: Req, approve: boolean) => {
        try { await api.post(`/admin/global-emotes/requests/${r.id}/resolve`, { approve }); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };
    const removeManager = async (m: Manager) => {
        try { await api.delete(`/admin/global-emotes/managers/${m.id}`); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-ds-accent-text" /></div>;
    if (error) {
        return (
            <div className="p-8"><div className="max-w-xl mx-auto p-6 rounded-lg border border-ds-danger/40 bg-ds-danger/10 text-ds-danger">
                {error === 'forbidden' ? t('global.forbidden') : t('global.loadFailed')}
            </div></div>
        );
    }

    const live = emotes.filter(e => e.status !== 'removed');
    const trash = emotes.filter(e => e.status === 'removed');

    return (
        <div className={embedded ? 'space-y-6' : 'min-h-screen bg-ds-bg p-4 sm:p-6 lg:p-8'}>
            <div className={embedded ? 'space-y-6' : 'panel-scale max-w-[1200px] mx-auto space-y-6'}>
                {!embedded && <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} aria-label={t('global.back')}
                        className="ds-btn ds-btn--secondary ds-icon-btn">
                        <ArrowLeft className="w-5 h-5 text-ds-soft" />
                    </button>
                    <div>
                        <h1 className="text-2xl 3xl:text-3xl font-bold text-ds-text">{t('global.title')}</h1>
                        <p className="text-sm 3xl:text-base text-ds-soft">{t('global.subtitle')}</p>
                    </div>
                </div>}

                {notice && (
                    <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${notice.kind === 'err' ? 'border-ds-danger/40 bg-ds-danger/10 text-ds-danger ' : notice.kind === 'warn' ? 'border-ds-warn/40 bg-ds-warn/10 text-ds-warn ' : 'border-ds-ok/40 bg-ds-ok/10 text-ds-ok '}`}>
                        {notice.kind === 'warn' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                        <span className="flex-1">{notice.text}</span>
                        <button onClick={() => setNotice(null)} aria-label="x"><X className="w-4 h-4" /></button>
                    </div>
                )}

                <section className={card}>
                    <h2 className="font-bold text-lg 3xl:text-xl text-ds-text mb-4">{t('global.upload')}</h2>
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 text-sm text-ds-soft">{t('global.name')}
                            <input className={input} value={name} maxLength={25} onChange={e => setName(e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-ds-soft">{t('global.file')}
                            <input ref={fileRef} type="file" accept="image/png,image/gif,image/webp,image/jpeg" className={input} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-ds-soft pb-2">
                            <input type="checkbox" checked={zeroWidth} onChange={e => setZeroWidth(e.target.checked)} />{t('global.zeroWidth')}
                        </label>
                        <button className={btnBlue} disabled={busy || !file || !name.trim()} onClick={upload}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{busy ? t('global.uploading') : t('global.send')}
                        </button>
                    </div>
                    {collision && (
                        <p className="mt-3 flex items-center gap-2 text-sm text-ds-warn"><AlertTriangle className="w-4 h-4" />{t('global.collides', { name: name.trim() })}</p>
                    )}
                </section>

                <section className={card}>
                    {live.length === 0 ? <p className="text-sm text-ds-soft">{t('global.empty')}</p> : (
                        <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
                            {live.map(e => (
                                <li key={e.id} className={`flex items-center gap-3 p-3 rounded-lg border border-ds-border ${e.status === 'hidden' ? 'opacity-60' : ''}`}>
                                    <img src={e.urls.x2} alt={e.name} className="w-12 h-12 object-contain shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm 3xl:text-base text-ds-text truncate">{e.name}{e.status === 'hidden' && <span className="ml-2 text-xs font-normal text-ds-soft">{t('global.hidden')}</span>}</div>
                                        <div className="text-xs text-ds-soft truncate">{t('global.by', { name: e.uploadedBy })}</div>
                                    </div>
                                    <button className={iconBtn} title={e.status === 'hidden' ? t('global.show') : t('global.hide')} onClick={() => patch(e, { visible: e.status === 'hidden' })}>
                                        {e.status === 'hidden' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <button className={iconBtn} title={t('global.rename')} onClick={() => rename(e)}><Pencil className="w-4 h-4" /></button>
                                    <button className={iconBtn} title={t('global.delete')} onClick={() => remove(e)}><Trash2 className="w-4 h-4 text-ds-danger" /></button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {trash.length > 0 && (
                    <section className={card}>
                        <h2 className="font-bold text-lg 3xl:text-xl text-ds-text">{t('global.trash')}</h2>
                        <p className="text-sm text-ds-soft mb-4">{t('global.trashHint', { days: TRASH_DAYS })}</p>
                        <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
                            {trash.map(e => (
                                <li key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-ds-border opacity-80">
                                    <img src={e.urls.x2} alt={e.name} className="w-12 h-12 object-contain shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm 3xl:text-base text-ds-text truncate">{e.name}</div>
                                        <div className="text-xs text-ds-soft truncate">{t('global.deletedBy', { name: e.removedBy ?? '?' })} · {t('global.daysLeft', { count: daysLeft(e) })}</div>
                                    </div>
                                    {canRestore && <>
                                        <button className={iconBtn} title={t('global.restore')} onClick={() => restore(e)}><RotateCcw className="w-4 h-4" /></button>
                                        <button className={iconBtn} title={t('global.purge')} onClick={() => purge(e)}><Trash2 className="w-4 h-4 text-ds-danger" /></button>
                                    </>}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {canRestore && (
                    <section className={card}>
                        <h2 className="font-bold text-lg 3xl:text-xl text-ds-text mb-4">{t('global.log')}</h2>
                        {log.length === 0 ? <p className="text-sm text-ds-soft">{t('global.logEmpty')}</p> : (
                            <ul className="divide-y divide-ds-border max-h-96 overflow-y-auto">
                                {log.map(l => (
                                    <li key={l.id} className="py-2 flex flex-wrap items-baseline gap-x-3 text-sm">
                                        <span className="text-xs text-ds-soft tabular-nums">{new Date(l.createdAt).toLocaleString()}</span>
                                        <span className="font-bold text-ds-text">{l.actor}</span>
                                        <span className="text-ds-accent-text">{t(`global.actions.${l.action}`, { defaultValue: l.action })}</span>
                                        <span className="text-ds-soft break-all">{l.detail}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}

                {managers && (
                    <section className={card}>
                        {requests.length > 0 && (
                            <div className="mb-6 p-4 rounded-lg border border-ds-warn/40 bg-ds-warn/10">
                                <h3 className="font-bold text-sm 3xl:text-base text-ds-warn mb-3">{t('global.requests', { count: requests.length })}</h3>
                                <ul className="space-y-2">
                                    {requests.map(r => (
                                        <li key={r.id} className="flex flex-wrap items-center gap-3">
                                            <div className="min-w-0 flex-1">
                                                <span className="font-bold text-sm text-ds-text">{r.login}</span>
                                                <span className="ml-2 text-xs text-ds-soft">{new Date(r.createdAt).toLocaleDateString()}</span>
                                                {r.message && <p className="text-sm text-ds-soft break-words">{r.message}</p>}
                                            </div>
                                            <button className={btnBlue} onClick={() => resolveRequest(r, true)}>{t('global.approve')}</button>
                                            <button className={iconBtn} onClick={() => resolveRequest(r, false)}>{t('global.reject')}</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <h2 className="font-bold text-lg 3xl:text-xl text-ds-text">{t('global.people')}</h2>
                        <p className="text-sm text-ds-soft mb-4">{t('global.peopleHint')}</p>
                        <div className="flex flex-wrap gap-3 mb-4">
                            <input className={input} value={login} placeholder={t('global.loginPlaceholder')} onChange={e => setLogin(e.target.value)} onKeyDown={e => e.key === 'Enter' && addManager()} />
                            <button className={btnBlue} onClick={addManager} disabled={!login.trim()}>{t('global.add')}</button>
                        </div>
                        {managers.length === 0 ? <p className="text-sm text-ds-soft">{t('global.noPeople')}</p> : (
                            <ul className="flex flex-wrap gap-2">
                                {managers.map(m => (
                                    <li key={m.id} className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-ds-raised text-sm text-ds-text">
                                        {m.login}
                                        <button className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm" title={t('global.remove')} aria-label={t('global.remove')} onClick={() => removeManager(m)}><X className="w-3.5 h-3.5" /></button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}
