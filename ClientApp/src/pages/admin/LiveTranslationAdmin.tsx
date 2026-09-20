import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Languages, Loader2, Square, RefreshCw } from 'lucide-react';
import api from '../../services/api';

interface Overview {
    days: number;
    sessions: number;
    connectedMinutes: number;
    speechMinutes: number;
    charsByLanguage: Record<string, number>;
    totalChars: number;
    creditsByEngine: { engine: string | null; credits: number; entries: number; chars: number }[];
    estimatedCostUsd: { stt: number; tts: number; total: number };
    byStreamer: { userId: number; login: string; sessions: number; speechSeconds: number; credits: number; peakListeners: number }[];
    active: { login: string; languages: string[]; listeners: Record<string, number>; activePipelines: string[]; speechSeconds: number; segments: number; creditsUsed: number; startedAt: string; lastError: string | null }[];
    limits: Record<string, string | number>;
    tariff: { sttCreditsPerSecond: number; ttsCreditsPerChar: Record<string, number>; note: string };
}

interface SessionRow {
    login: string;
    session: { id: number; startedAt: string; endedAt: string | null; speechSeconds: number; segments: number; charsByLanguage: Record<string, number>; peakListeners: number; creditsUsed: number; endReason: string | null };
}

const ENGINE_LABEL: Record<string, string> = { live_stt: 'Transcripción (Deepgram)', deepgram_aura: 'Voz Aura-2 (Deepgram)', fish: 'Voz Fish Audio' };
const LIMIT_LABEL: Record<string, string> = {
    MaxConcurrentChannels: 'Canales traduciendo a la vez (máx.)',
    MaxLanguagesPerChannel: 'Idiomas por canal (máx.)',
    IdleLanguageStopSeconds: 'Apagar idioma sin oyentes (s)',
    IngestTimeoutSeconds: 'Cerrar sesión sin audio (s)',
    MaxQueuedUtterances: 'Frases en cola por idioma (máx.)',
    SttModel: 'Modelo STT',
    translationModel: 'Modelo de traducción (OpenRouter, se cambia en Costos de IA)',
    geminiFallbackModel: 'Modelo de respaldo (Gemini directo)',
};
const fmtMin = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`;
const cardClass = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';
const h2 = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4';
const muted = 'text-xs text-[#64748b] dark:text-[#94a3b8]';

/**
 * Admin → Traducción en vivo: quién la usa, cuánto cuesta (estimado, a tarifa de lista de
 * los proveedores), qué se cobró en créditos, sesiones activas con botón para cortarlas, y
 * los límites/tarifas vigentes (vienen de appsettings; se cambian ahí, no aquí).
 */
export default function LiveTranslationAdmin() {
    const navigate = useNavigate();
    const [days, setDays] = useState(30);
    const [data, setData] = useState<Overview | null>(null);
    const [sessions, setSessions] = useState<SessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const [o, s] = await Promise.all([
                api.get(`/live-translation/admin/overview?days=${days}`),
                api.get(`/live-translation/admin/sessions?days=${days}`),
            ]);
            setData(o.data); setSessions(s.data ?? []);
        } catch (e: any) {
            setError(e?.response?.status === 403 ? 'Solo el owner puede ver esta página.' : 'No se pudo cargar.');
        } finally { setLoading(false); }
    }, [days]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

    const stop = async (login: string, userId?: number) => {
        const target = userId ?? data?.byStreamer.find(b => b.login === login)?.userId;
        if (!target || !confirm(`¿Cortar la sesión de ${login}?`)) return;
        await api.post(`/live-translation/admin/stop/${target}`);
        load();
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#222324]"><ArrowLeft className="w-5 h-5 text-[#64748b]" /></button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-3"><Languages className="w-8 h-8 text-[#9146FF]" /> Traducción en vivo</h1>
                        <p className={muted}>Uso, costos y sesiones activas. Los créditos salen del mismo saldo TTS de cada canal.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {[7, 30, 90].map(d => (
                        <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-lg text-sm border ${days === d ? 'bg-[#9146FF] border-[#9146FF] text-white' : 'border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc]'}`}>{d} días</button>
                    ))}
                    <button onClick={load} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151]" title="Actualizar"><RefreshCw className="w-4 h-4 text-[#64748b]" /></button>
                </div>
            </div>

            {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">{error}</div>}
            {loading && !data && <Loader2 className="w-6 h-6 animate-spin text-[#94a3b8]" />}

            {data && (
                <>
                    {/* Resumen */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Stat label="Sesiones" value={String(data.sessions)} />
                        <Stat label="Tiempo conectado" value={fmtMin(data.connectedMinutes)} hint="lo que se paga de STT" />
                        <Stat label="Tiempo hablado" value={fmtMin(data.speechMinutes)} />
                        <Stat label="Caracteres TTS" value={data.totalChars.toLocaleString()} hint={Object.entries(data.charsByLanguage).map(([l, c]) => `${l.toUpperCase()} ${c.toLocaleString()}`).join(' · ') || '—'} />
                        <Stat label="Costo estimado" value={`$${data.estimatedCostUsd.total.toFixed(2)}`} hint={`STT $${data.estimatedCostUsd.stt.toFixed(2)} · TTS $${data.estimatedCostUsd.tts.toFixed(2)}`} accent />
                    </div>

                    {/* Activas */}
                    <div className={cardClass}>
                        <h2 className={h2}>Traduciendo ahora ({data.active.length})</h2>
                        {data.active.length === 0 ? <p className={muted}>Ningún canal activo.</p> : (
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-[#64748b] dark:text-[#94a3b8]"><th className="py-1">Canal</th><th>Idiomas (oyentes)</th><th>Hablado</th><th>Frases</th><th>Créditos</th><th>Desde</th><th></th></tr></thead>
                                <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                    {data.active.map(a => (
                                        <tr key={a.login} className="border-t border-[#f1f5f9] dark:border-[#26262c]">
                                            <td className="py-2 font-semibold">{a.login}</td>
                                            <td>{a.languages.map(l => `${l.toUpperCase()} ${a.listeners[l] ?? 0}${a.activePipelines.includes(l) ? '●' : ''}`).join(' · ')}</td>
                                            <td>{fmtMin(a.speechSeconds / 60)}</td>
                                            <td>{a.segments}</td>
                                            <td>{a.creditsUsed.toLocaleString()}</td>
                                            <td>{new Date(a.startedAt).toLocaleTimeString()}</td>
                                            <td className="text-right"><button onClick={() => stop(a.login)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs inline-flex items-center gap-1"><Square className="w-3 h-3" /> Cortar</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Créditos cobrados */}
                        <div className={cardClass}>
                            <h2 className={h2}>Créditos cobrados por motor</h2>
                            {data.creditsByEngine.length === 0 ? <p className={muted}>Sin consumos en el periodo.</p> : (
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-[#64748b] dark:text-[#94a3b8]"><th className="py-1">Motor</th><th>Créditos</th><th>Unidades</th><th>Entradas</th></tr></thead>
                                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                        {data.creditsByEngine.map(c => (
                                            <tr key={c.engine ?? '-'} className="border-t border-[#f1f5f9] dark:border-[#26262c]">
                                                <td className="py-2">{ENGINE_LABEL[c.engine ?? ''] ?? c.engine ?? '—'}</td>
                                                <td>{c.credits.toLocaleString()}</td>
                                                <td>{c.chars.toLocaleString()} {c.engine === 'live_stt' ? 'créditos-seg' : 'chars'}</td>
                                                <td>{c.entries}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            <p className={`${muted} mt-3`}>Las cuentas con tier ilimitado (admin) registran 0 créditos aunque usen el servicio; el costo real igual aparece arriba.</p>
                        </div>

                        {/* Límites y tarifa */}
                        <div className={cardClass}>
                            <h2 className={h2}>Límites y tarifa vigentes</h2>
                            <dl className="text-sm grid grid-cols-[1fr_auto] gap-y-1.5 text-[#1e293b] dark:text-[#f8fafc]">
                                {Object.entries(data.limits).map(([k, v]) => (<><dt key={k + 'k'} className="text-[#64748b] dark:text-[#94a3b8]">{LIMIT_LABEL[k] ?? k}</dt><dd key={k + 'v'} className="text-right font-mono">{String(v)}</dd></>))}
                                <dt className="text-[#64748b] dark:text-[#94a3b8] mt-2">Transcripción</dt><dd className="text-right font-mono mt-2">{data.tariff.sttCreditsPerSecond} créditos / s de voz</dd>
                                {Object.entries(data.tariff.ttsCreditsPerChar).map(([k, v]) => (<><dt key={k + 'k'} className="text-[#64748b] dark:text-[#94a3b8]">{ENGINE_LABEL[k] ?? k}</dt><dd key={k + 'v'} className="text-right font-mono">{v} créditos / carácter</dd></>))}
                            </dl>
                            <p className={`${muted} mt-3`}>{data.tariff.note}</p>
                            <p className={`${muted} mt-1`}>Se cambian en <code>appsettings.json → LiveTranslation</code> y multiplicadores en <code>TtsCreditService</code>; el límite por canal lo pone la cuota mensual de su tier.</p>
                        </div>
                    </div>

                    {/* Por streamer */}
                    <div className={cardClass}>
                        <h2 className={h2}>Uso por canal</h2>
                        {data.byStreamer.length === 0 ? <p className={muted}>Nadie usó la función en el periodo.</p> : (
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-[#64748b] dark:text-[#94a3b8]"><th className="py-1">Canal</th><th>Sesiones</th><th>Hablado</th><th>Créditos</th><th>Pico oyentes</th><th></th></tr></thead>
                                <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                    {data.byStreamer.map(b => (
                                        <tr key={b.userId} className="border-t border-[#f1f5f9] dark:border-[#26262c]">
                                            <td className="py-2 font-semibold">{b.login}</td>
                                            <td>{b.sessions}</td>
                                            <td>{fmtMin(b.speechSeconds / 60)}</td>
                                            <td>{b.credits.toLocaleString()}</td>
                                            <td>{b.peakListeners}</td>
                                            <td className="text-right"><button onClick={() => navigate('/admin/tts-credits')} className="text-xs text-[#7c3aed] dark:text-[#bf94ff]">ver créditos</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Sesiones */}
                    <div className={cardClass}>
                        <h2 className={h2}>Últimas sesiones</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead><tr className="text-left text-[#64748b] dark:text-[#94a3b8]"><th className="py-1 pr-3">Canal</th><th className="pr-3">Inicio</th><th className="pr-3">Duración</th><th className="pr-3">Hablado</th><th className="pr-3">Frases</th><th className="pr-3">Chars</th><th className="pr-3">Pico</th><th className="pr-3">Créditos</th><th>Fin</th></tr></thead>
                                <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                    {sessions.slice(0, 100).map(({ login, session: s }) => {
                                        const start = new Date(s.startedAt); const end = s.endedAt ? new Date(s.endedAt) : null;
                                        return (
                                            <tr key={s.id} className="border-t border-[#f1f5f9] dark:border-[#26262c]">
                                                <td className="py-1.5 pr-3 font-semibold">{login}</td>
                                                <td className="pr-3 whitespace-nowrap">{start.toLocaleString()}</td>
                                                <td className="pr-3">{end ? fmtMin((end.getTime() - start.getTime()) / 60000) : 'en curso'}</td>
                                                <td className="pr-3">{fmtMin(s.speechSeconds / 60)}</td>
                                                <td className="pr-3">{s.segments}</td>
                                                <td className="pr-3">{Object.entries(s.charsByLanguage).map(([l, c]) => `${l.toUpperCase()} ${c}`).join(' · ') || '—'}</td>
                                                <td className="pr-3">{s.peakListeners}</td>
                                                <td className="pr-3">{s.creditsUsed.toLocaleString()}</td>
                                                <td>{s.endReason ?? '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
    return (
        <div className={`${cardClass} !p-4 ${accent ? 'border-[#9146FF]/50' : ''}`}>
            <div className={muted}>{label}</div>
            <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">{value}</div>
            {hint && <div className={`${muted} mt-1 truncate`} title={hint}>{hint}</div>}
        </div>
    );
}
