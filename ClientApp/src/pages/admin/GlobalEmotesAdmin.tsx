import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';
import api from '../../services/api';

// Emotes globales de Decatron: el set de la plataforma que se ve en todos los canales (prioridad más baja).
// Lo manejan los admins del sistema y quienes el dueño autorice por usuario de Twitch.

interface GlobalEmote {
    id: number; name: string; status: 'approved' | 'hidden'; animated: boolean; zeroWidth: boolean;
    uploadedBy: string; urls: { x1: string; x2: string; x4: string };
}
interface Manager { id: number; login: string; addedBy: string }

const card = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-4 3xl:p-6 shadow-sm';
const input = 'px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-sm 3xl:text-base text-[#1e293b] dark:text-[#f1f5f9]';
const btnBlue = 'px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2';
const iconBtn = 'p-2 rounded-lg bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]';

export default function GlobalEmotesAdmin() {
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
    const fileRef = useRef<HTMLInputElement>(null);

    const err = (code?: string) => t(`errors.${code}`, { defaultValue: t(`global.errors.${code}`, { defaultValue: code ?? 'error' }) });

    const load = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/global-emotes');
            setEmotes(data.emotes ?? []);
            setManagers(data.managers ?? null);
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
            const { data } = await api.post('/admin/global-emotes', form);
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
        if (!window.confirm(t('global.confirmDelete', { name: e.name }))) return;
        try { await api.delete(`/admin/global-emotes/${e.id}`); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };
    const addManager = async () => {
        if (!login.trim()) return;
        try { await api.post('/admin/global-emotes/managers', { login: login.trim() }); setLogin(''); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };
    const removeManager = async (m: Manager) => {
        try { await api.delete(`/admin/global-emotes/managers/${m.id}`); await load(); }
        catch (x: any) { setNotice({ kind: 'err', text: err(x?.response?.data?.error) }); }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-[#2563eb]" /></div>;
    if (error) {
        return (
            <div className="p-8"><div className="max-w-xl mx-auto p-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                {error === 'forbidden' ? t('global.forbidden') : t('global.loadFailed')}
            </div></div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6 lg:p-8">
            <div className="panel-scale max-w-[1200px] mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} aria-label={t('global.back')}
                        className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] shadow-lg">
                        <ArrowLeft className="w-5 h-5 text-[#64748b]" />
                    </button>
                    <div>
                        <h1 className="text-2xl 3xl:text-3xl font-bold text-[#1e293b] dark:text-[#f1f5f9]">{t('global.title')}</h1>
                        <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">{t('global.subtitle')}</p>
                    </div>
                </div>

                {notice && (
                    <div className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${notice.kind === 'err' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300' : notice.kind === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300' : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'}`}>
                        {notice.kind === 'warn' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                        <span className="flex-1">{notice.text}</span>
                        <button onClick={() => setNotice(null)} aria-label="x"><X className="w-4 h-4" /></button>
                    </div>
                )}

                <section className={card}>
                    <h2 className="font-bold text-lg 3xl:text-xl text-[#1e293b] dark:text-[#f1f5f9] mb-4">{t('global.upload')}</h2>
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 text-sm text-[#64748b] dark:text-[#94a3b8]">{t('global.name')}
                            <input className={input} value={name} maxLength={25} onChange={e => setName(e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-[#64748b] dark:text-[#94a3b8]">{t('global.file')}
                            <input ref={fileRef} type="file" accept="image/png,image/gif,image/webp,image/jpeg" className={input} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[#475569] dark:text-[#cbd5e1] pb-2">
                            <input type="checkbox" checked={zeroWidth} onChange={e => setZeroWidth(e.target.checked)} />{t('global.zeroWidth')}
                        </label>
                        <button className={btnBlue} disabled={busy || !file || !name.trim()} onClick={upload}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{busy ? t('global.uploading') : t('global.send')}
                        </button>
                    </div>
                    {collision && (
                        <p className="mt-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="w-4 h-4" />{t('global.collides', { name: name.trim() })}</p>
                    )}
                </section>

                <section className={card}>
                    {emotes.length === 0 ? <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('global.empty')}</p> : (
                        <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
                            {emotes.map(e => (
                                <li key={e.id} className={`flex items-center gap-3 p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151] ${e.status === 'hidden' ? 'opacity-60' : ''}`}>
                                    <img src={e.urls.x2} alt={e.name} className="w-12 h-12 object-contain shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm 3xl:text-base text-[#1e293b] dark:text-[#f1f5f9] truncate">{e.name}{e.status === 'hidden' && <span className="ml-2 text-xs font-normal text-[#94a3b8]">{t('global.hidden')}</span>}</div>
                                        <div className="text-xs text-[#94a3b8] truncate">{t('global.by', { name: e.uploadedBy })}</div>
                                    </div>
                                    <button className={iconBtn} title={e.status === 'hidden' ? t('global.show') : t('global.hide')} onClick={() => patch(e, { visible: e.status === 'hidden' })}>
                                        {e.status === 'hidden' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <button className={iconBtn} title={t('global.rename')} onClick={() => rename(e)}><Pencil className="w-4 h-4" /></button>
                                    <button className={iconBtn} title={t('global.delete')} onClick={() => remove(e)}><Trash2 className="w-4 h-4 text-red-500" /></button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {managers && (
                    <section className={card}>
                        <h2 className="font-bold text-lg 3xl:text-xl text-[#1e293b] dark:text-[#f1f5f9]">{t('global.people')}</h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">{t('global.peopleHint')}</p>
                        <div className="flex flex-wrap gap-3 mb-4">
                            <input className={input} value={login} placeholder={t('global.loginPlaceholder')} onChange={e => setLogin(e.target.value)} onKeyDown={e => e.key === 'Enter' && addManager()} />
                            <button className={btnBlue} onClick={addManager} disabled={!login.trim()}>{t('global.add')}</button>
                        </div>
                        {managers.length === 0 ? <p className="text-sm text-[#94a3b8]">{t('global.noPeople')}</p> : (
                            <ul className="flex flex-wrap gap-2">
                                {managers.map(m => (
                                    <li key={m.id} className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-[#f1f5f9] dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f1f5f9]">
                                        {m.login}
                                        <button className="p-1 rounded-full hover:bg-[#e2e8f0] dark:hover:bg-[#374151]" title={t('global.remove')} aria-label={t('global.remove')} onClick={() => removeManager(m)}><X className="w-3.5 h-3.5" /></button>
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
