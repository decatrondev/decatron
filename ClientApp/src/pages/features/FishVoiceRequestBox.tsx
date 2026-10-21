// «Solicitar una voz»: el streamer busca en Fish, escucha la muestra y pide la que le gusta; el admin la revisa en /admin/fish-voices.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Volume2 } from 'lucide-react';
import api from '../../services/api';
import FishMyVoices from './FishMyVoices';
import { useFishVoices } from './fishVoices';

interface MyRequest {
    id: number;
    description: string;
    title?: string | null;
    status: 'pending' | 'approved' | 'rejected';
    adminNote?: string | null;
}

interface Hit {
    id: string;
    title: string;
    languages: string[];
    author?: string | null;
    sampleUrl?: string | null;
    uses: number;
    inCatalog: boolean;
    requested: boolean;
}

export default function FishVoiceRequestBox() {
    const { t } = useTranslation('speakchat');
    const { canAddPrivate, loading } = useFishVoices();
    const [text, setText] = useState('');
    const [list, setList] = useState<MyRequest[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [q, setQ] = useState('');
    const [lang, setLang] = useState('es');
    const [hits, setHits] = useState<Hit[] | null>(null);
    const [searching, setSearching] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/tts/fish-voice-requests');
            setList(res.data.requests ?? []);
        } catch { /* sin lista, el formulario sigue funcionando */ }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => () => audioRef.current?.pause(), []);

    const play = (url: string) => {
        audioRef.current?.pause();
        const a = new Audio(url);
        audioRef.current = a;
        a.play().catch(() => setMsg({ ok: false, text: t('request.playError') }));
    };

    const search = async () => {
        setSearching(true);
        setMsg(null);
        try {
            const res = await api.get('/tts/fish-voices/search', { params: { q, language: lang } });
            setHits(res.data.results ?? []);
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? t('request.searchError') });
        } finally {
            setSearching(false);
        }
    };

    const submit = async (body: { description?: string; referenceId?: string }, onOk: () => void) => {
        setBusy(true);
        setMsg(null);
        try {
            await api.post('/tts/fish-voice-requests', body);
            onOk();
            setMsg({ ok: true, text: t('request.sent') });
            await load();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? t('request.sendError') });
        } finally {
            setBusy(false);
        }
    };

    const requestHit = (h: Hit) =>
        submit({ referenceId: h.id }, () => setHits(l => l?.map(x => x.id === h.id ? { ...x, requested: true } : x) ?? null));

    const sendText = () => submit({ description: text }, () => setText(''));

    // Rango Patrocinador o superior: busca y agrega sus propias voces en vez de solicitarlas
    if (!loading && canAddPrivate) return <FishMyVoices />;

    const statusLabel = (s: MyRequest['status']) => t(`request.status.${s}`);

    return (
        <div className="mt-4 rounded-xl border border-ds-border bg-ds-bg p-4 space-y-3">
            <div>
                <h3 className="text-sm font-black text-ds-text">🎭 {t('request.title')}</h3>
                <p className="text-xs text-ds-soft mt-1">{t('request.intro')}</p>
            </div>

            <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); search(); }}>
                <input
                    value={q} onChange={e => setQ(e.target.value)} placeholder={t('request.searchPlaceholder')}
                    className="flex-1 min-w-[180px] px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-sm focus:ring-2 focus:ring-ds-accent outline-none"
                />
                <select value={lang} onChange={e => setLang(e.target.value)} className="px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-sm">
                    <option value="es">{t('request.lang.es')}</option>
                    <option value="en">{t('request.lang.en')}</option>
                    <option value="pt">{t('request.lang.pt')}</option>
                    <option value="ja">{t('request.lang.ja')}</option>
                </select>
                <button type="submit" className="ds-btn ds-btn--primary ds-btn--sm" disabled={searching || q.trim().length < 2}>
                    <Search className="w-4 h-4" /> {searching ? t('request.searching') : t('request.search')}
                </button>
            </form>

            {hits && hits.length === 0 && <p className="text-xs text-ds-soft">{t('request.noResults')}</p>}
            {hits && hits.length > 0 && (
                <ul className="space-y-2">
                    {hits.map(h => (
                        <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ds-border p-2">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-ds-text truncate">{h.title}</p>
                                <p className="text-xs text-ds-soft">
                                    {h.languages.join(', ') || t('request.noLanguage')}{h.author ? ` · ${h.author}` : ''} · {t('request.uses', { count: h.uses })}
                                </p>
                            </div>
                            <div className="flex gap-2 items-center">
                                {h.sampleUrl && (
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => play(h.sampleUrl!)}>
                                        <Volume2 className="w-4 h-4" /> {t('request.sample')}
                                    </button>
                                )}
                                {h.inCatalog ? (
                                    <span className="text-xs font-bold text-ds-ok">{t('request.inCatalog')}</span>
                                ) : h.requested ? (
                                    <span className="text-xs font-bold text-ds-soft">{t('request.alreadyRequested')}</span>
                                ) : (
                                    <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={busy} onClick={() => requestHit(h)}>
                                        {t('request.ask')}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <details className="border-t border-ds-border pt-2">
                <summary className="text-xs font-bold text-ds-soft cursor-pointer">{t('request.notFound')}</summary>
                <div className="space-y-2 mt-2">
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        maxLength={300}
                        rows={2}
                        placeholder={t('request.textPlaceholder')}
                        className="w-full px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-sm focus:ring-2 focus:ring-ds-accent outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={busy || text.trim().length < 3} onClick={sendText}>
                            {busy ? t('request.sending') : t('request.sendText')}
                        </button>
                        <span className="text-xs text-ds-soft">{text.trim().length}/300</span>
                    </div>
                </div>
            </details>

            {msg && <p className={'text-xs font-bold ' + (msg.ok ? 'text-ds-ok' : 'text-ds-danger')}>{msg.text}</p>}

            {list.length > 0 && (
                <div className="border-t border-ds-border pt-2 space-y-1">
                    <p className="text-xs font-bold text-ds-soft">{t('request.mine')}</p>
                    <ul className="space-y-1">
                        {list.map(r => (
                            <li key={r.id} className="text-xs text-ds-soft">
                                <span className="text-ds-text">{r.title || r.description}</span> — {statusLabel(r.status)}
                                {r.adminNote ? `: ${r.adminNote}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
