/**
 * Voces de personaje (Fish Audio) — /admin/fish-voices
 *
 * Catálogo curado: buscar en Fish, escuchar la muestra del autor (todo gratis, no se genera audio) y aprobar
 * con la licencia anotada. Las voces activas son las únicas que ven los streamers y las únicas que se sintetizan.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Volume2 } from 'lucide-react';
import api from '../../services/api';

interface CatalogVoice {
    referenceId: string;
    name: string;
    languages: string;
    author?: string | null;
    sampleUrl?: string | null;
    license: License;
    licenseNote?: string | null;
    active: boolean;
    inactiveReason?: string | null;
    lastCheckedAt?: string | null;
}

interface SearchHit {
    id: string;
    title: string;
    languages: string[];
    author?: string | null;
    sampleUrl?: string | null;
    likes: number;
    uses: number;
    visibility?: string | null;
    takenDown: boolean;
    inCatalog: boolean;
}

interface VoiceRequest {
    id: number;
    login?: string | null;
    description: string;
    referenceId?: string | null;
    title?: string | null;
    sampleUrl?: string | null;
    status: 'pending' | 'approved' | 'rejected';
    adminNote?: string | null;
    createdAt: string;
}

interface UserVoice {
    userId: number;
    login?: string | null;
    referenceId: string;
    name: string;
    languages: string;
    author?: string | null;
    sampleUrl?: string | null;
    active: boolean;
    inactiveReason?: string | null;
}

type License = 'commercial' | 'noncommercial' | 'unknown';

const LICENSE_LABEL: Record<License, string> = {
    commercial: 'Uso comercial permitido',
    noncommercial: 'Solo uso no comercial',
    unknown: 'Licencia sin confirmar',
};

const INACTIVE_LABEL: Record<string, string> = {
    manual: 'Desactivada por el admin',
    missing: 'Fish ya no la devuelve',
    takedown: 'Retirada o ya no es pública',
    admin: 'Desactivada por el admin',
};

const cardClass = 'rounded-lg border border-ds-border bg-ds-surface p-6 ';
const inputClass = 'w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm';
const labelClass = 'text-xs font-bold text-ds-soft block mb-2';

export default function FishVoicesAdmin() {
    const navigate = useNavigate();
    const [voices, setVoices] = useState<CatalogVoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const [q, setQ] = useState('');
    const [lang, setLang] = useState('es');
    const [hits, setHits] = useState<SearchHit[] | null>(null);
    const [searching, setSearching] = useState(false);
    // Licencia y nota que se anotan al aprobar, por id de voz
    const [drafts, setDrafts] = useState<Record<string, { license: License; note: string }>>({});
    const [userVoices, setUserVoices] = useState<UserVoice[]>([]);
    const [requests, setRequests] = useState<VoiceRequest[]>([]);
    // Solicitud que se resuelve al aprobar la próxima voz de la búsqueda
    const [activeReq, setActiveReq] = useState<number | null>(null);
    const [rejectNotes, setRejectNotes] = useState<Record<number, string>>({});
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/admin/tts-fish-voices');
            setVoices(res.data.voices ?? []);
        } catch {
            setMsg({ ok: false, text: 'No se pudo cargar el catálogo' });
        } finally {
            setLoading(false);
        }
    }, []);

    const loadRequests = useCallback(async () => {
        try {
            const res = await api.get('/admin/tts-fish-voices/requests');
            setRequests(res.data.requests ?? []);
        } catch { /* la cola es secundaria */ }
    }, []);

    const loadUserVoices = useCallback(async () => {
        try {
            const res = await api.get('/admin/tts-fish-voices/user-voices');
            setUserVoices(res.data.voices ?? []);
        } catch { /* secundario */ }
    }, []);

    const toggleUserVoice = async (v: UserVoice) => {
        try {
            await api.patch(`/admin/tts-fish-voices/user-voices/${v.userId}/${v.referenceId}`, { active: !v.active });
            setMsg({ ok: true, text: v.active ? 'Voz desactivada para ese canal' : 'Voz reactivada' });
            await loadUserVoices();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'No se pudo guardar' });
        }
    };

    useEffect(() => { load(); loadRequests(); loadUserVoices(); }, [load, loadRequests, loadUserVoices]);

    const play = (url: string) => {
        audioRef.current?.pause();
        const a = new Audio(url);
        audioRef.current = a;
        a.play().catch(() => setMsg({ ok: false, text: 'El navegador no pudo reproducir el audio' }));
    };

    const search = async () => {
        setSearching(true);
        setMsg(null);
        try {
            const res = await api.get('/admin/tts-fish-voices/search', { params: { q, language: lang } });
            setHits(res.data.results ?? []);
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'La búsqueda falló' });
        } finally {
            setSearching(false);
        }
    };

    const draftOf = (id: string) => drafts[id] ?? { license: 'unknown' as License, note: '' };
    const setDraft = (id: string, patch: Partial<{ license: License; note: string }>) =>
        setDrafts(d => ({ ...d, [id]: { ...draftOf(id), ...patch } }));

    const approve = async (hit: SearchHit) => {
        const d = draftOf(hit.id);
        try {
            await api.post('/admin/tts-fish-voices', { referenceId: hit.id, name: hit.title, license: d.license, licenseNote: d.note, requestId: activeReq });
            if (activeReq) { setActiveReq(null); await loadRequests(); }
            setMsg({ ok: true, text: `«${hit.title}» aprobada` });
            setHits(h => h?.map(x => x.id === hit.id ? { ...x, inCatalog: true } : x) ?? null);
            await load();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'No se pudo aprobar' });
        }
    };

    // Aprueba directo cuando la solicitud trae el id de Fish (Fish verifica que sea pública)
    const approveRequestById = async (r: VoiceRequest) => {
        const d = draftOf('req' + r.id);
        try {
            await api.post('/admin/tts-fish-voices', { referenceId: r.referenceId, license: d.license, licenseNote: d.note, requestId: r.id });
            setMsg({ ok: true, text: 'Solicitud aprobada' });
            await Promise.all([load(), loadRequests()]);
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'No se pudo aprobar' });
        }
    };

    const reject = async (r: VoiceRequest) => {
        try {
            await api.post(`/admin/tts-fish-voices/requests/${r.id}/reject`, { note: rejectNotes[r.id] ?? '' });
            setMsg({ ok: true, text: 'Solicitud rechazada' });
            if (activeReq === r.id) setActiveReq(null);
            await loadRequests();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'No se pudo rechazar' });
        }
    };

    const searchForRequest = (r: VoiceRequest) => {
        setActiveReq(r.id);
        setQ(r.description.slice(0, 60));
        document.getElementById('fish-search')?.scrollIntoView({ behavior: 'smooth' });
    };

    const patch = async (v: CatalogVoice, body: Record<string, unknown>, ok: string) => {
        try {
            await api.patch(`/admin/tts-fish-voices/${v.referenceId}`, body);
            setMsg({ ok: true, text: ok });
            await load();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'No se pudo guardar' });
        }
    };

    const fmtDate = (iso?: string | null) =>
        iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

    return (
        <div className="panel-scale space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/admin')} className="ds-btn ds-btn--secondary ds-icon-btn">
                    <ArrowLeft className="w-5 h-5 text-ds-soft" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-ds-text">Voces de personaje</h1>
                    <p className="text-ds-soft mt-1 text-sm">Catálogo de Fish Audio: solo las voces activas se ofrecen y se sintetizan</p>
                </div>
            </div>

            {msg && (
                <div className={'p-3 rounded-lg border text-sm ' + (msg.ok ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok' : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger')}>
                    {msg.text}
                </div>
            )}
            {requests.some(r => r.status === 'pending') && (
                <div className={cardClass + 'space-y-4'}>
                    <h2 className="text-lg font-black text-ds-text">Solicitudes de los streamers</h2>
                    <div className="space-y-3">
                        {requests.filter(r => r.status === 'pending').map(r => (
                            <div key={r.id} className={'rounded-lg border p-4 space-y-3 ' + (activeReq === r.id ? 'border-ds-accent' : 'border-ds-border')}>
                                <div>
                                    <p className="font-black text-ds-text">{r.title || r.description}</p>
                                    {r.title && r.title !== r.description && <p className="text-xs text-ds-soft">Pidió: {r.description}</p>}
                                    {r.sampleUrl && (
                                        <button className="ds-btn ds-btn--secondary ds-btn--sm mt-1" onClick={() => play(r.sampleUrl!)}>
                                            <Volume2 className="w-4 h-4" /> Escuchar muestra
                                        </button>
                                    )}
                                    <p className="text-xs text-ds-soft">
                                        {r.login ?? 'usuario'} · {fmtDate(r.createdAt)}{r.referenceId ? ` · id de Fish: ${r.referenceId}` : ''}
                                    </p>
                                </div>
                                {r.referenceId && (
                                    <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] items-end">
                                        <div>
                                            <label className={labelClass}>Licencia</label>
                                            <select className={inputClass} value={draftOf('req' + r.id).license} onChange={e => setDraft('req' + r.id, { license: e.target.value as License })}>
                                                {(Object.keys(LICENSE_LABEL) as License[]).map(k => <option key={k} value={k}>{LICENSE_LABEL[k]}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Nota de licencia</label>
                                            <input className={inputClass} value={draftOf('req' + r.id).note} onChange={e => setDraft('req' + r.id, { note: e.target.value })} placeholder="Qué dice el autor sobre el uso" />
                                        </div>
                                        <button className="ds-btn ds-btn--primary" onClick={() => approveRequestById(r)}>Aprobar</button>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-end gap-3">
                                    <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => searchForRequest(r)}>
                                        Buscar en Fish y aprobar
                                    </button>
                                    <input
                                        className={inputClass + ' flex-1 min-w-[200px]'}
                                        value={rejectNotes[r.id] ?? ''}
                                        onChange={e => setRejectNotes(n => ({ ...n, [r.id]: e.target.value }))}
                                        placeholder="Motivo del rechazo (lo ve el streamer)"
                                    />
                                    <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => reject(r)}>Rechazar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={cardClass + 'space-y-4'}>
                <h2 className="text-lg font-black text-ds-text">Voces del catálogo</h2>
                {loading ? (
                    <p className="text-sm text-ds-soft">Cargando…</p>
                ) : voices.length === 0 ? (
                    <p className="text-sm text-ds-soft">Aún no hay voces. Busca una abajo y apruébala.</p>
                ) : (
                    <div className="space-y-3">
                        {voices.map(v => (
                            <div key={v.referenceId} className={'rounded-lg border border-ds-border p-4 space-y-3 ' + (v.active ? '' : 'opacity-70')}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="font-black text-ds-text">{v.name}</p>
                                        <p className="text-xs text-ds-soft">
                                            {v.languages || 'sin idioma'}{v.author ? ` · ${v.author}` : ''} · {v.referenceId}
                                        </p>
                                        {!v.active && (
                                            <p className="text-xs font-bold text-ds-danger mt-1">
                                                Inactiva{v.inactiveReason ? `: ${INACTIVE_LABEL[v.inactiveReason] ?? v.inactiveReason}` : ''}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {v.sampleUrl && (
                                            <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => play(v.sampleUrl!)}>
                                                <Volume2 className="w-4 h-4" /> Muestra del autor
                                            </button>
                                        )}
                                        <button
                                            className="ds-btn ds-btn--secondary ds-btn--sm"
                                            onClick={() => patch(v, { active: !v.active }, v.active ? 'Voz desactivada' : 'Voz activada')}
                                        >
                                            {v.active ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                                    <div>
                                        <label className={labelClass}>Licencia</label>
                                        <select
                                            className={inputClass}
                                            value={v.license}
                                            onChange={e => patch(v, { license: e.target.value }, 'Licencia guardada')}
                                        >
                                            {(Object.keys(LICENSE_LABEL) as License[]).map(k => <option key={k} value={k}>{LICENSE_LABEL[k]}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Nota de licencia</label>
                                        <input
                                            className={inputClass}
                                            defaultValue={v.licenseNote ?? ''}
                                            placeholder="Qué dice el autor sobre el uso"
                                            onBlur={e => { if (e.target.value !== (v.licenseNote ?? '')) patch(v, { licenseNote: e.target.value }, 'Nota guardada'); }}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-ds-soft">
                                    Último chequeo en Fish: {fmtDate(v.lastCheckedAt)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {userVoices.length > 0 && (
                <div className={cardClass + 'space-y-4'}>
                    <h2 className="text-lg font-black text-ds-text">Voces propias de los Patrocinadores</h2>
                    <p className="text-xs text-ds-soft">Las agregan ellos mismos sin aprobación y solo suenan en su canal. Si una te preocupa (licencia, contenido), desactívala: no podrán volver a agregarla.</p>
                    <div className="space-y-2">
                        {userVoices.map(v => (
                            <div key={v.userId + v.referenceId} className={'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ds-border p-3 ' + (v.active ? '' : 'opacity-70')}>
                                <div>
                                    <p className="font-bold text-ds-text">{v.name} <span className="text-xs font-normal text-ds-soft">· {v.login ?? 'usuario ' + v.userId}</span></p>
                                    <p className="text-xs text-ds-soft">
                                        {v.languages || 'sin idioma'}{v.author ? ` · ${v.author}` : ''} · {v.referenceId}
                                        {!v.active ? ` · inactiva (${INACTIVE_LABEL[v.inactiveReason ?? ''] ?? v.inactiveReason ?? ''})` : ''}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {v.sampleUrl && (
                                        <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => play(v.sampleUrl!)}>
                                            <Volume2 className="w-4 h-4" /> Muestra
                                        </button>
                                    )}
                                    {(v.active || v.inactiveReason === 'admin') && (
                                        <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => toggleUserVoice(v)}>
                                            {v.active ? 'Desactivar' : 'Reactivar'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div id="fish-search" className={cardClass + 'space-y-4'}>
                <h2 className="text-lg font-black text-ds-text">Buscar en Fish</h2>
                {activeReq && (
                    <p className="text-xs font-bold text-ds-accent">
                        Al aprobar una voz de esta búsqueda se resuelve la solicitud #{activeReq}.{' '}
                        <button className="underline" onClick={() => setActiveReq(null)}>Quitar</button>
                    </p>
                )}
                <p className="text-xs text-ds-soft">Todo es gratis: la búsqueda, la muestra del autor y aprobar no generan audio ni gastan saldo de Fish.</p>
                <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); search(); }}>
                    <div className="flex-1 min-w-[200px]">
                        <label className={labelClass}>Nombre de la voz</label>
                        <input className={inputClass} value={q} onChange={e => setQ(e.target.value)} placeholder="Ej: toji" />
                    </div>
                    <div className="w-32">
                        <label className={labelClass}>Idioma</label>
                        <select className={inputClass} value={lang} onChange={e => setLang(e.target.value)}>
                            <option value="es">Español</option>
                            <option value="en">Inglés</option>
                            <option value="pt">Portugués</option>
                            <option value="ja">Japonés</option>
                        </select>
                    </div>
                    <button type="submit" className="ds-btn ds-btn--primary" disabled={searching}>
                        <Search className="w-4 h-4" /> {searching ? 'Buscando…' : 'Buscar'}
                    </button>
                </form>

                {hits && hits.length === 0 && <p className="text-sm text-ds-soft">Sin resultados.</p>}
                {hits && hits.length > 0 && (
                    <div className="space-y-3">
                        {hits.map(h => {
                            const d = draftOf(h.id);
                            const blocked = h.takenDown || (h.visibility && h.visibility !== 'public');
                            return (
                                <div key={h.id} className="rounded-lg border border-ds-border p-4 space-y-3">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-black text-ds-text">{h.title}</p>
                                            <p className="text-xs text-ds-soft">
                                                {h.languages.join(', ') || 'sin idioma'}{h.author ? ` · ${h.author}` : ''} · {h.likes} me gusta · {h.uses.toLocaleString('es')} usos
                                            </p>
                                        </div>
                                        {h.sampleUrl && (
                                            <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => play(h.sampleUrl!)}>
                                                <Volume2 className="w-4 h-4" /> Muestra del autor
                                            </button>
                                        )}
                                    </div>
                                    {blocked ? (
                                        <p className="text-xs font-bold text-ds-danger">No es pública en Fish o fue retirada: no se puede aprobar.</p>
                                    ) : h.inCatalog ? (
                                        <p className="text-xs font-bold text-ds-ok">Ya está en el catálogo.</p>
                                    ) : (
                                        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] items-end">
                                            <div>
                                                <label className={labelClass}>Licencia</label>
                                                <select className={inputClass} value={d.license} onChange={e => setDraft(h.id, { license: e.target.value as License })}>
                                                    {(Object.keys(LICENSE_LABEL) as License[]).map(k => <option key={k} value={k}>{LICENSE_LABEL[k]}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Nota de licencia</label>
                                                <input className={inputClass} value={d.note} onChange={e => setDraft(h.id, { note: e.target.value })} placeholder="Qué dice el autor sobre el uso" />
                                            </div>
                                            <button className="ds-btn ds-btn--primary" onClick={() => approve(h)}>Aprobar</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
