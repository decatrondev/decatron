import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign, Loader2, RefreshCw, Save, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import api from '../../services/api';
import { CallsTable, MODULE_LABEL } from '../../components/admin/AiCallsTable';

interface Summary {
    days: number;
    totals: { calls: number; failed: number; promptTokens: number; completionTokens: number; costUsd: number };
    todayCost: number;
    byModule: { module: string; calls: number; failed: number; promptTokens: number; completionTokens: number; costUsd: number; avgMs: number }[];
    byModel: { provider: string; model: string; calls: number; promptTokens: number; completionTokens: number; costUsd: number }[];
    byDay: { day: string; calls: number; costUsd: number; modules: Record<string, number> }[];
    topChannels: { userId: number; channel: string | null; calls: number; tokens: number; costUsd: number }[];
}
interface Credits { success: boolean; configured?: boolean; totalCredits?: number; totalUsage?: number; remaining?: number }
interface Models { chatProvider: string; fallbackEnabled: boolean; chatModel: string; geminiModel: string; translationModel: string; coachModel: string; fallbackModels: string; prices: Record<string, { in: number; out: number }> }

const usd = (n: number) => `$${n.toFixed(n < 0.01 && n > 0 ? 4 : 2)}`;
const k = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const cardClass = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';
const h2 = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4';
const muted = 'text-xs text-[#64748b] dark:text-[#94a3b8]';
const input = 'w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-sm text-[#1e293b] dark:text-[#f8fafc] font-mono';
const th = 'py-1 text-left text-[#64748b] dark:text-[#94a3b8] font-medium';
const tr = 'border-t border-[#f1f5f9] dark:border-[#26262c]';

/**
 * Admin → Costos de IA: todo lo que el bot gasta en LLMs (OpenRouter + Gemini), por módulo,
 * modelo, día y streamer. Se alimenta de ai_usage_logs, que escribe cada llamada. El costo es
 * estimado con la tabla de precios de abajo; la cifra oficial está en OpenRouter → Activity.
 * Plan: .dev/plans/AI_OPENROUTER_UNIFICACION_PLAN.md
 */
export default function AiCostsAdmin() {
    const navigate = useNavigate();
    const [days, setDays] = useState(30);
    const [data, setData] = useState<Summary | null>(null);
    const [credits, setCredits] = useState<Credits | null>(null);
    const [models, setModels] = useState<Models | null>(null);
    const [pricesText, setPricesText] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const [s, c, m] = await Promise.all([
                api.get(`/admin/ai-costs/summary?days=${days}`),
                api.get('/admin/ai-costs/credits'),
                api.get('/admin/ai-costs/models'),
            ]);
            setData(s.data); setCredits(c.data); setModels(m.data);
            setPricesText(JSON.stringify(m.data.prices, null, 2));
        } catch (e: any) {
            setError(e?.response?.status === 403 ? 'Solo el owner puede ver esta página.' : 'No se pudo cargar.');
        } finally { setLoading(false); }
    }, [days]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

    const saveModels = async () => {
        if (!models) return;
        let prices: unknown;
        try { prices = JSON.parse(pricesText); } catch { setError('La tabla de precios no es JSON válido.'); return; }
        setSaving(true); setError(null); setNotice(null);
        try {
            await api.put('/admin/ai-costs/models', { chatModel: models.chatModel, translationModel: models.translationModel, coachModel: models.coachModel, fallbackModels: models.fallbackModels, prices });
            setNotice('Modelos y precios guardados. Aplican desde la próxima llamada, sin reiniciar.');
            load();
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'No se pudo guardar.');
        } finally { setSaving(false); }
    };

    const maxDayCost = Math.max(0.000001, ...(data?.byDay.map(d => d.costUsd) ?? [0]));

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#222324]"><ArrowLeft className="w-5 h-5 text-[#64748b]" /></button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-3"><CircleDollarSign className="w-8 h-8 text-[#9146FF]" /> Costos de IA</h1>
                        <p className={muted}>Todo lo que el bot gasta en modelos de lenguaje, por módulo y streamer. Costo estimado con la tabla de precios de abajo.</p>
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
            {notice && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">{notice}</div>}
            {loading && !data && <Loader2 className="w-6 h-6 animate-spin text-[#94a3b8]" />}

            {data && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Stat label={`Gasto ${days} días`} value={usd(data.totals.costUsd)} hint={`hoy ${usd(data.todayCost)}`} accent />
                        <Stat label="Llamadas" value={data.totals.calls.toLocaleString()} hint={data.totals.failed ? `${data.totals.failed} fallidas` : 'sin fallos'} />
                        <Stat label="Tokens entrada" value={k(data.totals.promptTokens)} />
                        <Stat label="Tokens salida" value={k(data.totals.completionTokens)} />
                        <Stat
                            label="Saldo OpenRouter"
                            value={credits?.success ? usd(credits.remaining ?? 0) : credits?.configured === false ? 'sin key' : '—'}
                            hint={credits?.success ? `comprado ${usd(credits.totalCredits ?? 0)} · usado ${usd(credits.totalUsage ?? 0)}` : 'no se pudo leer'}
                            accent={!!credits?.success && (credits.remaining ?? 0) < 2}
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className={cardClass}>
                            <h2 className={h2}>Por módulo</h2>
                            {data.byModule.length === 0 ? <p className={muted}>Sin llamadas en el período.</p> : (
                                <table className="w-full text-sm">
                                    <thead><tr><th className={th}>Módulo</th><th className={th}>Llamadas</th><th className={th}>Tokens in/out</th><th className={th}>Prom.</th><th className={`${th} text-right`}>Costo</th></tr></thead>
                                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                        {data.byModule.map(m => (
                                            <tr key={m.module} className={tr}>
                                                <td className="py-2 font-semibold">{MODULE_LABEL[m.module] ?? m.module}</td>
                                                <td>{m.calls.toLocaleString()}{m.failed ? <span className="text-red-500 text-xs"> ({m.failed} ✗)</span> : null}</td>
                                                <td className="font-mono text-xs">{k(m.promptTokens)} / {k(m.completionTokens)}</td>
                                                <td className="text-xs">{m.avgMs} ms</td>
                                                <td className="text-right font-mono">{usd(m.costUsd)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className={cardClass}>
                            <h2 className={h2}>Por modelo</h2>
                            {data.byModel.length === 0 ? <p className={muted}>Sin llamadas en el período.</p> : (
                                <table className="w-full text-sm">
                                    <thead><tr><th className={th}>Modelo</th><th className={th}>Llamadas</th><th className={th}>Tokens in/out</th><th className={`${th} text-right`}>Costo</th></tr></thead>
                                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                        {data.byModel.map(m => (
                                            <tr key={m.provider + m.model} className={tr}>
                                                <td className="py-2 font-mono text-xs">{m.model}<span className={`${muted} ml-1`}>({m.provider})</span></td>
                                                <td>{m.calls.toLocaleString()}</td>
                                                <td className="font-mono text-xs">{k(m.promptTokens)} / {k(m.completionTokens)}</td>
                                                <td className="text-right font-mono">{usd(m.costUsd)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className={cardClass}>
                        <h2 className={h2}>Gasto por día</h2>
                        {data.byDay.length === 0 ? <p className={muted}>Sin datos.</p> : (
                            <div className="flex items-end gap-1 h-32">
                                {data.byDay.map(d => (
                                    <div key={d.day} className="flex-1 flex flex-col justify-end group relative" title={`${d.day}: ${usd(d.costUsd)} · ${d.calls} llamadas`}>
                                        <div className="bg-[#9146FF]/80 rounded-t" style={{ height: `${Math.max(2, (d.costUsd / maxDayCost) * 100)}%` }} />
                                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-[#94a3b8] hidden group-hover:block whitespace-nowrap">{d.day.slice(5)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className={cardClass}>
                            <h2 className={h2}>Top streamers</h2>
                            {data.topChannels.length === 0 ? <p className={muted}>Sin datos.</p> : (
                                <table className="w-full text-sm">
                                    <thead><tr><th className={th}>Canal</th><th className={th}>Llamadas</th><th className={th}>Tokens</th><th className={`${th} text-right`}>Costo</th></tr></thead>
                                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                        {data.topChannels.map(c => (
                                            <tr key={`${c.userId}-${c.channel}`} className={tr}>
                                                <td className="py-2 font-semibold">{c.channel ?? `user #${c.userId}`}</td>
                                                <td>{c.calls.toLocaleString()}</td>
                                                <td className="font-mono text-xs">{k(c.tokens)}</td>
                                                <td className="text-right font-mono">{usd(c.costUsd)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className={cardClass}>
                            <h2 className={h2}>Modelos por módulo</h2>
                            {models && (
                                <div className="space-y-3">
                                    <Field label="!decatronai / chat web" value={models.chatModel} onChange={v => setModels({ ...models, chatModel: v })} hint={`proveedor: ${models.chatProvider}${models.fallbackEnabled ? ` · fallback Gemini ${models.geminiModel}` : ''}`} />
                                    <Field label="Traducción en vivo" value={models.translationModel} onChange={v => setModels({ ...models, translationModel: v })} hint="frase a frase, timeout 4 s, cae a Gemini si falla" />
                                    <Field label="Coach de LoL" value={models.coachModel} onChange={v => setModels({ ...models, coachModel: v })} />
                                    <Field label="Respaldo (en orden, separados por coma)" value={models.fallbackModels} onChange={v => setModels({ ...models, fallbackModels: v })} hint="si el modelo del módulo da 429, se cae o rechaza, OpenRouter pasa solo al siguiente en la misma petición · aplica a chat, traducción y coach · máx. 3" />
                                    <div>
                                        <div className={`${muted} mb-1`}>Precios USD por 1M tokens: {"{ \"modelo\": { \"in\": n, \"out\": n } }"}</div>
                                        <textarea value={pricesText} onChange={e => setPricesText(e.target.value)} rows={7} className={input} spellCheck={false} />
                                    </div>
                                    <button onClick={saveModels} disabled={saving} className="px-4 py-2 rounded-lg bg-[#9146FF] hover:bg-[#7c3aed] text-white text-sm inline-flex items-center gap-2 disabled:opacity-50">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <CallsTable />

                    <div className={`${cardClass} flex flex-wrap gap-4 text-sm`}>
                        <Link href="https://openrouter.ai/activity">OpenRouter · Activity (cifra oficial)</Link>
                        <Link href="https://openrouter.ai/credits">OpenRouter · Créditos</Link>
                        <Link href="https://console.deepgram.com/">Deepgram · Uso (STT/TTS, no está aquí)</Link>
                        <Link href="https://aistudio.google.com/usage">Google AI Studio · Uso (fallback)</Link>
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

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
    return (
        <div>
            <div className={`${muted} mb-1`}>{label}</div>
            <input value={value} onChange={e => onChange(e.target.value)} className={input} />
            {hint && <div className={`${muted} mt-1`}>{hint}</div>}
        </div>
    );
}

function Link({ href, children }: { href: string; children: ReactNode }) {
    return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#9146FF] hover:underline">{children} <ExternalLink className="w-3 h-3" /></a>;
}
