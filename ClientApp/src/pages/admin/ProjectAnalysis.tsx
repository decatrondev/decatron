/**
 * Radiografía del proyecto — /admin/project-analysis
 *
 * Los gráficos son SVG a mano y no una librería: el bundle ya pesa 4 MB y Recharts
 * añadiría medio mega más por cuatro dibujos que caben en doscientas líneas.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, FileCode, GitBranch, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

interface ExtensionStat { extension: string; files: number; lines: number; percent: number }
interface FileStat { path: string; lines: number }
interface Hotspot { path: string; lines: number; changes: number }
interface MonthlyGrowth { month: string; added: number; removed: number; total: number }
interface DebtStat { tag: string; mentions: number; files: number }
interface FolderStat { path: string; files: number; lines: number }

interface Analysis {
    generatedAt: string;
    elapsedMs: number;
    isGitRepo: boolean;
    trackedFiles: number;
    codeFiles: number;
    totalLines: number;
    untrackedFiles: number;
    byExtension: ExtensionStat[];
    largestFiles: FileStat[];
    hotspots: Hotspot[];
    hotspotWindow: string;
    growth: MonthlyGrowth[];
    debt: DebtStat[];
    folders: FolderStat[];
    git: { branch: string; commits: number; lastCommit: string | null; dirtyFiles: number } | null;
}

// Paleta estable por extensión: que .cs no cambie de color entre recargas
const EXT_COLORS: Record<string, string> = {
    '.tsx': '#2563eb', '.ts': '#3b82f6', '.cs': '#8b5cf6', '.js': '#f59e0b',
    '.jsx': '#fbbf24', '.sql': '#10b981', '.css': '#ec4899', '.scss': '#f472b6',
    '.py': '#14b8a6', '.sh': '#64748b', '.html': '#ef4444', '.yml': '#a78bfa',
    '.yaml': '#a78bfa', '.razor': '#c084fc', '.cshtml': '#c084fc',
};
const colorFor = (ext: string) => EXT_COLORS[ext] ?? '#94a3b8';

const cardClass = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';
const titleClass = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1';
const subClass = 'text-xs text-[#64748b] dark:text-[#94a3b8] mb-4';

const fmt = (n: number) => n.toLocaleString('es-ES');

/** Solo el nombre del archivo, que es lo que se lee de un vistazo. */
const basename = (p: string) => p.split('/').pop() ?? p;
const dirname = (p: string) => { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); };

// ─────────────────────────────────────────────────────────────────────────────
// Anillo de composición
// ─────────────────────────────────────────────────────────────────────────────
function CompositionRing({ data }: { data: ExtensionStat[] }) {
    const total = data.reduce((s, d) => s + d.lines, 0);
    if (total === 0) return null;

    const R = 70, STROKE = 26, C = 2 * Math.PI * R;
    let offset = 0;

    return (
        <div className="flex items-center gap-6 flex-wrap">
            <svg viewBox="0 0 180 180" className="w-44 h-44 flex-shrink-0 -rotate-90">
                {data.map(d => {
                    const len = (d.lines / total) * C;
                    // 0.6 de hueco entre segmentos para que se distingan sin borde
                    const seg = (
                        <circle
                            key={d.extension}
                            cx="90" cy="90" r={R}
                            fill="none"
                            stroke={colorFor(d.extension)}
                            strokeWidth={STROKE}
                            strokeDasharray={`${Math.max(0, len - 0.6)} ${C - len + 0.6}`}
                            strokeDashoffset={-offset}
                        />
                    );
                    offset += len;
                    return seg;
                })}
            </svg>

            <div className="flex-1 min-w-[180px] space-y-1.5">
                {data.slice(0, 8).map(d => (
                    <div key={d.extension} className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: colorFor(d.extension) }} />
                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] w-14">{d.extension}</span>
                        <span className="text-[#64748b] dark:text-[#94a3b8] flex-1">{fmt(d.lines)} líneas</span>
                        <span className="text-[#94a3b8] w-20 text-right">{d.files} arch · {d.percent}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Barras horizontales de los archivos más grandes
// ─────────────────────────────────────────────────────────────────────────────
function LargestFiles({ data }: { data: FileStat[] }) {
    const max = Math.max(...data.map(d => d.lines), 1);

    return (
        <div className="space-y-2">
            {data.slice(0, 15).map(f => (
                <div key={f.path} className="group">
                    <div className="flex items-baseline justify-between gap-3 text-xs mb-0.5">
                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate" title={f.path}>
                            {basename(f.path)}
                        </span>
                        <span className="font-mono text-[#64748b] dark:text-[#94a3b8] flex-shrink-0">
                            {fmt(f.lines)}
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#f1f5f9] dark:bg-[#262626] overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{
                                width: `${(f.lines / max) * 100}%`,
                                background: colorFor('.' + (f.path.split('.').pop() ?? '')),
                            }}
                        />
                    </div>
                    <p className="text-[10px] text-[#94a3b8] truncate mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {dirname(f.path)}
                    </p>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Crecimiento mensual
// ─────────────────────────────────────────────────────────────────────────────
function GrowthChart({ data }: { data: MonthlyGrowth[] }) {
    if (data.length < 2) {
        return <p className="text-xs text-[#94a3b8]">Hace falta más de un mes de historial para dibujar la curva.</p>;
    }

    const W = 560, H = 180, PAD_L = 46, PAD_B = 22, PAD_T = 10;
    const max = Math.max(...data.map(d => d.total), 1);
    const stepX = (W - PAD_L - 10) / (data.length - 1);

    const x = (i: number) => PAD_L + i * stepX;
    const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);

    const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.total)}`).join(' ');
    const area = `${line} L ${x(data.length - 1)} ${H - PAD_B} L ${x(0)} ${H - PAD_B} Z`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Rejilla: tres referencias bastan para leer la magnitud */}
            {[0, 0.5, 1].map(t => (
                <g key={t}>
                    <line
                        x1={PAD_L} x2={W - 10}
                        y1={y(max * t)} y2={y(max * t)}
                        stroke="currentColor" strokeOpacity="0.12"
                    />
                    <text
                        x={PAD_L - 6} y={y(max * t) + 3}
                        textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.45"
                    >
                        {Math.round(max * t / 1000)}k
                    </text>
                </g>
            ))}

            <path d={area} fill="url(#growthFill)" />
            <path d={line} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />

            {data.map((d, i) => (
                <g key={d.month}>
                    <circle cx={x(i)} cy={y(d.total)} r="2.5" fill="#2563eb" />
                    <title>{`${d.month}: ${fmt(d.total)} líneas (+${fmt(d.added)} / −${fmt(d.removed)})`}</title>
                    {/* Con doce meses, una etiqueta sí y otra no evita que se pisen */}
                    {(i % 2 === 0 || data.length <= 6) && (
                        <text
                            x={x(i)} y={H - 6}
                            textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.45"
                        >
                            {d.month.slice(2)}
                        </text>
                    )}
                </g>
            ))}
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuadrante de riesgo: tamaño contra veces tocado
// ─────────────────────────────────────────────────────────────────────────────
function RiskQuadrant({ data, dirtyFiles }: { data: Hotspot[]; dirtyFiles: number }) {
    const [hovered, setHovered] = useState<Hotspot | null>(null);

    // Con menos de un puñado de puntos el cuadrante engaña más que ayuda: no hay "los
    // que más cambian", hay "los únicos que cambiaron". Mejor decirlo que dibujar un
    // recuadro vacío y dejar al que mira preguntándose qué falla.
    if (data.length < 4) {
        return (
            <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900 text-xs text-yellow-800 dark:text-yellow-300 space-y-2">
                <p className="font-bold">No hay suficiente historial para dibujar el cuadrante.</p>
                <p>
                    Este gráfico cruza el tamaño de cada archivo con las veces que se ha modificado, y
                    esa segunda mitad sale de los commits. Solo {data.length === 0 ? 'no hay ninguno' : `hay ${data.length}`}{' '}
                    {data.length === 1 ? 'archivo con cambios registrados' : 'archivos con cambios registrados'}.
                </p>
                {dirtyFiles > 0 && (
                    <p>
                        Tienes <strong>{fmt(dirtyFiles)} archivos modificados sin commitear</strong>. Para git ese
                        trabajo no existe todavía, así que no cuenta aquí. En cuanto hagas commits el gráfico
                        se llena solo.
                    </p>
                )}
            </div>
        );
    }

    const W = 560, H = 300, PAD_L = 46, PAD_B = 30, PAD_T = 12, PAD_R = 12;
    const maxLines = Math.max(...data.map(d => d.lines), 1);
    const maxChanges = Math.max(...data.map(d => d.changes), 1);

    const x = (c: number) => PAD_L + (c / maxChanges) * (W - PAD_L - PAD_R);
    const y = (l: number) => PAD_T + (1 - l / maxLines) * (H - PAD_T - PAD_B);

    // Umbrales a la mitad de cada eje: el cuadrante superior derecho es el que importa
    const midX = x(maxChanges / 2), midY = y(maxLines / 2);

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                <rect
                    x={midX} y={PAD_T}
                    width={W - PAD_R - midX} height={midY - PAD_T}
                    fill="#ef4444" fillOpacity="0.07"
                />

                <line x1={midX} x2={midX} y1={PAD_T} y2={H - PAD_B} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />
                <line x1={PAD_L} x2={W - PAD_R} y1={midY} y2={midY} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 3" />

                <text x={W - PAD_R - 4} y={PAD_T + 12} textAnchor="end" fontSize="9" fill="#ef4444" fillOpacity="0.8" fontWeight="bold">
                    grande y se toca mucho
                </text>

                {data.map(d => {
                    const risky = d.changes > maxChanges / 2 && d.lines > maxLines / 2;
                    return (
                        <circle
                            key={d.path}
                            cx={x(d.changes)} cy={y(d.lines)}
                            r={hovered?.path === d.path ? 7 : 5}
                            fill={risky ? '#ef4444' : '#2563eb'}
                            fillOpacity={hovered?.path === d.path ? 0.95 : 0.55}
                            className="cursor-pointer transition-all"
                            onMouseEnter={() => setHovered(d)}
                            onMouseLeave={() => setHovered(null)}
                        />
                    );
                })}

                <text x={PAD_L} y={H - 8} fontSize="9" fill="currentColor" fillOpacity="0.45">
                    → veces modificado
                </text>
                <text x={10} y={PAD_T + 8} fontSize="9" fill="currentColor" fillOpacity="0.45" transform={`rotate(-90 10 ${PAD_T + 8})`}>
                    ↑ líneas
                </text>
            </svg>

            <div className="mt-2 min-h-[38px]">
                {hovered ? (
                    <div className="text-xs">
                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{basename(hovered.path)}</p>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            {fmt(hovered.lines)} líneas · {hovered.changes} cambios · <span className="text-[#94a3b8]">{dirname(hovered.path)}</span>
                        </p>
                    </div>
                ) : (
                    <p className="text-xs text-[#94a3b8]">
                        Pasa el ratón por un punto para ver qué archivo es.
                    </p>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProjectAnalysis() {
    const navigate = useNavigate();
    const [data, setData] = useState<Analysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);

    const load = async (refresh = false) => {
        refresh ? setRefreshing(true) : setLoading(true);
        setError(false);
        try {
            const res = await api.get('/admin/project-analysis', { params: refresh ? { refresh: true } : {} });
            if (res.data?.success) setData(res.data.analysis);
            else setError(true);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-sm text-[#64748b] dark:text-[#94a3b8]">
                Analizando el proyecto…
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={cardClass + ' max-w-md mx-auto text-center'}>
                <p className="text-sm text-red-600 dark:text-red-400 font-bold">No se pudo analizar el proyecto</p>
                <button onClick={() => load(true)} className="mt-3 text-xs font-bold text-blue-600">Reintentar</button>
            </div>
        );
    }

    const totalDebt = data.debt.reduce((s, d) => s + d.mentions, 0);
    const biggest = data.largestFiles[0];

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin')}
                        className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Radiografía del proyecto</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1 text-sm">
                            Calculado en {data.elapsedMs} ms · {new Date(data.generatedAt).toLocaleString('es-ES')}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-xs font-bold text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Recalculando…' : 'Recalcular'}
                </button>
            </div>

            {/* Cifras */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Líneas de código', value: fmt(data.totalLines), hint: `${data.codeFiles} archivos` },
                    { label: 'Archivos del repo', value: fmt(data.trackedFiles), hint: `${fmt(data.untrackedFiles)} sin versionar` },
                    { label: 'Commits', value: fmt(data.git?.commits ?? 0), hint: data.git?.branch ?? '—' },
                    { label: 'Deuda marcada', value: fmt(totalDebt), hint: 'TODO · FIXME · HACK · XXX' },
                ].map(s => (
                    <div key={s.label} className={cardClass + ' !p-4'}>
                        <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">{s.label}</p>
                        <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] leading-tight">{s.value}</p>
                        <p className="text-[10px] text-[#94a3b8]">{s.hint}</p>
                    </div>
                ))}
            </div>

            {/* El que de verdad importa, arriba */}
            <div className={cardClass}>
                <h2 className={titleClass}>Dónde está el riesgo</h2>
                <p className={subClass}>
                    Cada punto es un archivo. Cuanto más a la derecha, más veces se ha modificado;
                    cuanto más arriba, más largo es. Los de la zona roja —grandes y que además se
                    tocan a menudo— son donde aparecen los fallos: uno enorme que nadie toca es
                    deuda dormida y puede esperar.
                    {data.hotspotWindow && ` Periodo medido: ${data.hotspotWindow}.`}
                </p>
                <RiskQuadrant data={data.hotspots} dirtyFiles={data.git?.dirtyFiles ?? 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardClass}>
                    <h2 className={titleClass}>Composición</h2>
                    <p className={subClass}>Sin lockfiles ni archivos subidos por streamers.</p>
                    <CompositionRing data={data.byExtension} />
                </div>

                <div className={cardClass}>
                    <h2 className={titleClass}>Crecimiento</h2>
                    <p className={subClass}>Líneas acumuladas por mes, del historial de git.</p>
                    <GrowthChart data={data.growth} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardClass}>
                    <h2 className={titleClass}>Archivos más grandes</h2>
                    <p className={subClass}>
                        {biggest && biggest.lines > 2000
                            ? `${basename(biggest.path)} tiene ${fmt(biggest.lines)} líneas: casi seguro son varias cosas metidas en una.`
                            : 'Por dónde empezar a partir cuando el proyecto se haga incómodo.'}
                    </p>
                    <LargestFiles data={data.largestFiles} />
                </div>

                <div className="space-y-6">
                    <div className={cardClass}>
                        <h2 className={titleClass}>Deuda marcada</h2>
                        <p className={subClass}>Lo que quedó anotado en el código para más tarde.</p>
                        <div className="space-y-2">
                            {data.debt.map(d => (
                                <div key={d.tag} className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-2 font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                        {d.mentions > 0 && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                                        {d.mentions === 0 && <span className="w-3.5" />}
                                        {d.tag}
                                    </span>
                                    <span className="text-[#64748b] dark:text-[#94a3b8]">
                                        {d.mentions === 0 ? 'ninguno' : `${d.mentions} en ${d.files} archivos`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={cardClass}>
                        <h2 className={titleClass}>Carpetas con más código</h2>
                        <p className={subClass}>Dónde pesa de verdad el proyecto.</p>
                        <div className="space-y-1.5">
                            {data.folders.slice(0, 8).map(f => (
                                <div key={f.path} className="flex items-center justify-between gap-3 text-xs">
                                    <span className="flex items-center gap-1.5 text-[#1e293b] dark:text-[#f8fafc] truncate" title={f.path}>
                                        <FileCode className="w-3 h-3 text-[#94a3b8] flex-shrink-0" />
                                        {f.path}
                                    </span>
                                    <span className="text-[#64748b] dark:text-[#94a3b8] flex-shrink-0 font-mono">
                                        {fmt(f.lines)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {data.git && (
                <div className={cardClass + ' !p-4'}>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-[#64748b] dark:text-[#94a3b8]">
                        <GitBranch className="w-4 h-4" />
                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{data.git.branch}</span>
                        <span>·</span>
                        <span>{data.git.dirtyFiles} cambios locales sin subir</span>
                        {data.git.lastCommit && (
                            <>
                                <span>·</span>
                                <span className="truncate">último: {data.git.lastCommit}</span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
