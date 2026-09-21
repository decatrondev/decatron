import { useEffect, useState } from 'react';
import { Loader2, Layers, Coins, BookOpen, Award, Package, Gift } from 'lucide-react';
import api from '../../../services/api';
import TcgPageHeader from './TcgPageHeader';
import CardSlab, { gradeLabel } from './CardSlab';

// Estadísticas de la colección. Todo se calcula server-side sobre las cartas que ya
// existen; no hay tabla de métricas ni nada que mantener sincronizado.

const RARITY_ORDER = ['MR', 'LR', 'UR', 'SSR', 'SR', 'R', 'N'];

const RARITY_COLORS: Record<string, string> = {
    N: '#94a3b8',
    R: '#60a5fa',
    SR: '#a855f7',
    SSR: '#ec4899',
    UR: '#fbbf24',
    LR: '#fb923c',
    MR: '#e879f9',
};

interface Stats {
    totalCards: number;
    totalValue: number;
    distinctCards: number;
    totalInGame: number;
    unopenedPacks: number;
    claimedCards: number;
    gradedCards: number;
    byRarity: { rarity: string; count: number; value: number }[];
    byGrade: { grade: number; count: number }[];
    byElement: { element: string; count: number }[];
    gradeStats: { total: number; exitosos: number; fallidos: number; vencidos: number; gastado: number };
    bestCard: { name: string | null; rarity: string; level: number; catalogValue: number; imageUrl: string | null } | null;
}

export default function TcgStats() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/tcg/stats')
            .then((res) => setStats(res.data))
            .catch((err) => console.error('Error loading stats:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="space-y-6">
                <TcgPageHeader title="Estadísticas" />
                <p className="text-[#64748b] dark:text-[#94a3b8]">No pudimos cargar tus estadísticas.</p>
            </div>
        );
    }

    const dexPct = stats.totalInGame > 0 ? (stats.distinctCards / stats.totalInGame) * 100 : 0;
    const maxRarityCount = Math.max(1, ...stats.byRarity.map((r) => r.count));
    const maxGradeCount = Math.max(1, ...stats.byGrade.map((g) => g.count));

    // Se ordena por la escala real de rareza, no por cómo vino del backend.
    const rarezasOrdenadas = [...stats.byRarity].sort(
        (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
    );

    return (
        <div className="space-y-6">
            <TcgPageHeader title="Estadísticas" subtitle="Tu colección en números." />

            {/* Números principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Tile icon={<Layers className="w-5 h-5 text-[#2563eb]" />} label="Cartas" value={stats.totalCards.toLocaleString()} />
                <Tile icon={<Coins className="w-5 h-5 text-[#eab308]" />} label="Valor total" value={stats.totalValue.toLocaleString()} />
                <Tile icon={<Award className="w-5 h-5 text-[#22c55e]" />} label="Gradeadas" value={stats.gradedCards.toLocaleString()} />
                <Tile icon={<Gift className="w-5 h-5 text-[#a855f7]" />} label="Gratis" value={stats.claimedCards.toLocaleString()} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Catálogo descubierto */}
                <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-5">
                    <h2 className="font-bold text-white mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#22c55e]" /> Catálogo descubierto
                    </h2>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{dexPct.toFixed(1)}%</span>
                        <span className="text-sm text-[#94a3b8]">
                            {stats.distinctCards.toLocaleString()} de {stats.totalInGame.toLocaleString()} diseños
                        </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-black/40 overflow-hidden">
                        <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${Math.min(100, dexPct)}%` }} />
                    </div>
                    {stats.unopenedPacks > 0 && (
                        <p className="text-xs text-[#94a3b8] mt-3 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5" />
                            Tenés {stats.unopenedPacks} sobre{stats.unopenedPacks === 1 ? '' : 's'} sin abrir
                        </p>
                    )}
                </div>

                {/* Carta más valiosa */}
                <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-5">
                    <h2 className="font-bold text-white mb-3">Tu mejor carta</h2>
                    {stats.bestCard ? (
                        <div className="flex gap-4">
                            <div className="w-24 shrink-0">
                                <CardSlab
                                    level={stats.bestCard.level}
                                    name={stats.bestCard.name}
                                    rarity={stats.bestCard.rarity}
                                    imageUrl={stats.bestCard.imageUrl}
                                    compact
                                />
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-white truncate">{stats.bestCard.name || '???'}</div>
                                <div className="text-sm" style={{ color: RARITY_COLORS[stats.bestCard.rarity] }}>
                                    {stats.bestCard.rarity}
                                    {stats.bestCard.level > 0 && ` · grado ${stats.bestCard.level} ${gradeLabel(stats.bestCard.level)}`}
                                </div>
                                <div className="text-2xl font-black text-[#eab308] mt-2">
                                    {stats.bestCard.catalogValue.toLocaleString()}
                                </div>
                                <div className="text-xs text-[#64748b]">valor de catálogo</div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-[#94a3b8]">Todavía no tenés cartas.</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Por rareza */}
                <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-5">
                    <h2 className="font-bold text-white mb-4">Por rareza</h2>
                    {rarezasOrdenadas.length === 0 ? (
                        <p className="text-sm text-[#94a3b8]">Sin datos todavía.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {rarezasOrdenadas.map((r) => (
                                <div key={r.rarity} className="flex items-center gap-3">
                                    <span className="w-10 text-xs font-black shrink-0" style={{ color: RARITY_COLORS[r.rarity] }}>
                                        {r.rarity}
                                    </span>
                                    <div className="flex-1 h-5 rounded-md bg-black/40 overflow-hidden">
                                        <div
                                            className="h-full rounded-md"
                                            style={{
                                                width: `${(r.count / maxRarityCount) * 100}%`,
                                                background: RARITY_COLORS[r.rarity],
                                                opacity: 0.75,
                                            }}
                                        />
                                    </div>
                                    <span className="w-10 text-right text-sm text-white tabular-nums shrink-0">{r.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Por grado */}
                <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-5">
                    <h2 className="font-bold text-white mb-4">Grados conseguidos</h2>
                    {stats.byGrade.length === 0 ? (
                        <p className="text-sm text-[#94a3b8]">Todavía no gradeaste ninguna carta.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {stats.byGrade.map((g) => (
                                <div key={g.grade} className="flex items-center gap-3">
                                    <span className={`w-16 text-xs font-black shrink-0 ${g.grade >= 10 ? 'text-[#fbbf24]' : 'text-white/70'}`}>
                                        {g.grade} · {gradeLabel(g.grade)}
                                    </span>
                                    <div className="flex-1 h-5 rounded-md bg-black/40 overflow-hidden">
                                        <div
                                            className={`h-full rounded-md ${g.grade >= 10 ? 'bg-[#fbbf24]' : 'bg-[#2563eb]'}`}
                                            style={{ width: `${(g.count / maxGradeCount) * 100}%`, opacity: 0.8 }}
                                        />
                                    </div>
                                    <span className="w-8 text-right text-sm text-white tabular-nums shrink-0">{g.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Historial de gradeo */}
            <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-5">
                <h2 className="font-bold text-white mb-1">Historial de gradeo</h2>
                <p className="text-xs text-[#64748b] mb-4">
                    Lo que gastaste se lleva aparte del valor de las cartas: el valor mide lo que
                    lograste, no lo que pusiste.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Mini label="Intentos" value={stats.gradeStats.total} />
                    <Mini label="Confirmados" value={stats.gradeStats.exitosos} tone="text-green-400" />
                    <Mini label="Destruidas" value={stats.gradeStats.fallidos + stats.gradeStats.vencidos} tone="text-red-400" />
                    <Mini label="Coins gastados" value={stats.gradeStats.gastado} tone="text-[#eab308]" />
                </div>
            </div>

            {/* Por elemento */}
            {stats.byElement.length > 0 && (
                <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-5">
                    <h2 className="font-bold text-white mb-4">Por elemento</h2>
                    <div className="flex flex-wrap gap-2">
                        {stats.byElement.map((e) => (
                            <span key={e.element} className="px-3 py-1.5 rounded-xl bg-black/30 border border-[#374151] text-sm text-white">
                                {e.element} <span className="text-[#94a3b8]">{e.count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#94a3b8]">{icon}{label}</div>
            <div className="text-2xl font-black text-white mt-1.5 tabular-nums">{value}</div>
        </div>
    );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: string }) {
    return (
        <div>
            <div className={`text-xl font-black tabular-nums ${tone || 'text-white'}`}>{value.toLocaleString()}</div>
            <div className="text-xs text-[#64748b]">{label}</div>
        </div>
    );
}
