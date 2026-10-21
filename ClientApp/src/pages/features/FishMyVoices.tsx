// Voces propias del canal (rango Patrocinador o superior): buscar en Fish, escuchar la muestra y agregarlas a la lista propia.
import { useRef, useState } from 'react';
import { Search, Volume2 } from 'lucide-react';
import api from '../../services/api';
import { refreshFishVoices, useFishVoices } from './fishVoices';

interface Hit {
    id: string;
    title: string;
    languages: string[];
    author?: string | null;
    sampleUrl?: string | null;
    likes: number;
    uses: number;
    added: boolean;
    inCatalog: boolean;
}

/** bare: sin caja propia, para usarlo dentro de una tarjeta de pestaña. */
export default function FishMyVoices({ bare = false }: { bare?: boolean }) {
    const { voices, maxPrivate, privateCount } = useFishVoices();
    const mine = voices.filter(v => v.private);
    const [q, setQ] = useState('');
    const [lang, setLang] = useState('es');
    const [hits, setHits] = useState<Hit[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const play = (url: string) => {
        audioRef.current?.pause();
        const a = new Audio(url);
        audioRef.current = a;
        a.play().catch(() => setMsg({ ok: false, text: 'El navegador no pudo reproducir el audio' }));
    };

    const search = async () => {
        setBusy(true);
        setMsg(null);
        try {
            const res = await api.get('/tts/fish-voices/search', { params: { q, language: lang } });
            setHits(res.data.results ?? []);
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'La búsqueda falló' });
        } finally {
            setBusy(false);
        }
    };

    const add = async (h: Hit) => {
        setMsg(null);
        try {
            await api.post('/tts/fish-voices/mine', { referenceId: h.id });
            setHits(list => list?.map(x => x.id === h.id ? { ...x, added: true } : x) ?? null);
            setMsg({ ok: true, text: `«${h.title}» agregada a tu lista` });
            await refreshFishVoices();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'No se pudo agregar' });
        }
    };

    const remove = async (id: string, name: string) => {
        setMsg(null);
        try {
            await api.delete(`/tts/fish-voices/mine/${id}`);
            setHits(list => list?.map(x => x.id === id ? { ...x, added: false } : x) ?? null);
            setMsg({ ok: true, text: `«${name}» quitada de tu lista` });
            await refreshFishVoices();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'No se pudo quitar' });
        }
    };

    return (
        <div className={bare ? 'space-y-3' : 'mt-4 rounded-xl border border-ds-border bg-ds-bg p-4 space-y-3'}>
            <div>
                <h3 className="text-sm font-black text-ds-text">🎭 Tus voces propias ({privateCount}/{maxPrivate})</h3>
                <p className="text-xs text-ds-soft mt-1">
                    Como Patrocinador buscas en Fish y agregas voces a tu lista sin esperar aprobación. Aparecen en el desplegable
                    solo en tu canal, con la marca «mía». Buscar, escuchar la muestra y agregar no gasta créditos; solo cuesta leer con ellas.
                    La licencia de cada voz es la de su autor: revisa que puedas usarla en tu stream.
                </p>
            </div>
            <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); search(); }}>
                <input
                    value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre del personaje o la voz"
                    className="flex-1 min-w-[180px] px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-sm focus:ring-2 focus:ring-ds-accent outline-none"
                />
                <select value={lang} onChange={e => setLang(e.target.value)} className="px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-sm">
                    <option value="es">Español</option>
                    <option value="en">Inglés</option>
                    <option value="pt">Portugués</option>
                    <option value="ja">Japonés</option>
                </select>
                <button type="submit" className="ds-btn ds-btn--primary ds-btn--sm" disabled={busy || q.trim().length < 2}>
                    <Search className="w-4 h-4" /> {busy ? 'Buscando…' : 'Buscar'}
                </button>
            </form>
            {msg && <p className={'text-xs font-bold ' + (msg.ok ? 'text-ds-ok' : 'text-ds-danger')}>{msg.text}</p>}

            {hits && hits.length === 0 && <p className="text-xs text-ds-soft">Sin resultados.</p>}
            {hits && hits.length > 0 && (
                <ul className="space-y-2">
                    {hits.map(h => (
                        <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ds-border p-2">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-ds-text truncate">{h.title}</p>
                                <p className="text-xs text-ds-soft">{h.languages.join(', ') || 'sin idioma'}{h.author ? ` · ${h.author}` : ''} · {h.uses.toLocaleString('es')} usos</p>
                            </div>
                            <div className="flex gap-2">
                                {h.sampleUrl && (
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => play(h.sampleUrl!)}>
                                        <Volume2 className="w-4 h-4" /> Muestra
                                    </button>
                                )}
                                {h.inCatalog ? (
                                    <span className="text-xs font-bold text-ds-ok self-center">Ya está en la lista de todos</span>
                                ) : h.added ? (
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => remove(h.id, h.title)}>Quitar</button>
                                ) : (
                                    <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" onClick={() => add(h)}>Agregar</button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {mine.length > 0 && (
                <div className="border-t border-ds-border pt-2 space-y-1">
                    <p className="text-xs font-bold text-ds-soft">Tu lista</p>
                    {mine.map(v => (
                        <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-ds-text truncate">{v.name}</span>
                            <button type="button" className="text-xs font-bold text-ds-danger hover:underline" onClick={() => remove(v.id, v.name)}>Quitar</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
