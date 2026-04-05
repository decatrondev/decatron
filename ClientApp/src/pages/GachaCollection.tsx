import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Package, Star, History, TrendingUp, Loader2, Search, Filter, Lock, LogIn, Globe, Eye, Gift } from 'lucide-react';
import api from '../services/api';

const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; stars: string }> = {
    legendary: { label: 'Legendario', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', stars: '★★★★★' },
    epic:      { label: 'Epico',      color: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: '#a855f7', stars: '★★★★' },
    rare:      { label: 'Raro',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: '#3b82f6', stars: '★★★' },
    uncommon:  { label: 'Poco Comun', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: '#22c55e', stars: '★★' },
    common:    { label: 'Comun',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: '#94a3b8', stars: '★' },
};

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

interface CollectionData {
    channelName: string;
    userName: string;
    banner?: string;
    isPrivate?: boolean;
    participant: { name: string; donationAmount: number; pulls: number; effectiveDonation: number } | null;
    stats: { uniqueCards: number; totalCards: number; totalAvailable: number; pullsUsed: number; totalDonated: number; byRarity: Record<string, number> };
    inventory: { id: number; itemId: number; name: string; rarity: string; image?: string; quantity: number; isRedeemed: boolean; lastWonAt: string }[];
    history: { id: number; itemName: string; rarity: string; image?: string; occurredAt: string }[];
    progress: { rarity: string; owned: number; total: number; percentage: number }[];
}

function getLoggedInUsername(): string | null {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload['Name'] || payload['name'] || payload['unique_name'] || null;
    } catch {
        return null;
    }
}

export default function GachaCollection() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';
    const user = searchParams.get('user') || '';
    const [data, setData] = useState<CollectionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [historyLimit, setHistoryLimit] = useState(5);

    const loggedInUser = useMemo(() => getLoggedInUsername(), []);
    const isLoggedIn = !!loggedInUser;
    const isOwner = isLoggedIn && loggedInUser?.toLowerCase() === user?.toLowerCase();

    useEffect(() => {
        if (!channel || !user) { setError('Parametros channel y user requeridos en la URL'); setLoading(false); return; }
        (async () => {
            try {
                const res = await fetch(`/api/gacha/public/collection?channel=${encodeURIComponent(channel)}&user=${encodeURIComponent(user)}`);
                const json = await res.json();
                if (json.success) setData({
                    ...json,
                    stats: json.stats || { uniqueCards: 0, totalCards: 0, totalAvailable: 0, pullsUsed: 0, totalDonated: 0, byRarity: {} },
                    inventory: json.inventory || [],
                    history: json.history || [],
                    progress: json.progress || [],
                });
                else setError(json.message || 'Error cargando coleccion');
            } catch { setError('Error de conexion'); }
            finally { setLoading(false); }
        })();
    }, [channel, user]);


    if (loading) return (
        <div className="min-h-screen bg-[#1B1C1D] flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
    );

    if (error || !data) return (
        <div className="min-h-screen bg-[#1B1C1D] flex items-center justify-center text-white font-sans">
            <div className="text-center">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-xl font-bold">{error || 'Coleccion no encontrada'}</p>
                <p className="text-sm text-gray-400 mt-2">URL: /gacha/collection?channel=nombre&user=viewer</p>
            </div>
        </div>
    );

    // Private collection - only show if NOT the owner
    if (data.isPrivate && !isOwner) return (
        <div className="min-h-screen bg-[#1B1C1D] flex items-center justify-center text-white font-sans">
            <div className="text-center">
                <Lock className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                <p className="text-2xl font-bold mb-2">Esta coleccion es privada</p>
                <p className="text-sm text-gray-400">El usuario ha configurado su coleccion como privada.</p>
                {!isLoggedIn && (
                    <a
                        href={`/login?redirect=gacha/collection?channel=${encodeURIComponent(channel)}&user=${encodeURIComponent(user)}`}
                        className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition"
                    >
                        <LogIn className="w-4 h-4" /> Iniciar Sesion
                    </a>
                )}
            </div>
        </div>
    );

    const filteredCards = data.inventory.filter(c => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'all') return true;
        if (filter === 'redeemed') return c.isRedeemed;
        return c.rarity === filter;
    });

    return (
        <div className="min-h-screen bg-[#1B1C1D] text-white font-sans">
            {/* Top bar with login / profile link */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
                {isLoggedIn && (
                    <Link
                        to="/me/gacha"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#262626] border border-[#374151] text-gray-300 hover:text-white text-xs font-bold rounded-lg transition"
                    >
                        <Eye className="w-3.5 h-3.5" /> Ver mi perfil
                    </Link>
                )}
                {!isLoggedIn && (
                    <a
                        href={`/login?redirect=gacha/collection?channel=${encodeURIComponent(channel)}&user=${encodeURIComponent(user)}`}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                    >
                        <LogIn className="w-3.5 h-3.5" /> Iniciar Sesion
                    </a>
                )}
            </div>

            {/* Banner */}
            <div className="relative h-48 sm:h-64 overflow-hidden">
                {data.banner ? (
                    <img src={data.banner} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B1C1D] via-[#1B1C1D]/60 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                    <p className="text-sm text-gray-300 font-bold uppercase tracking-wider">{data.channelName}</p>
                    <h1 className="text-3xl sm:text-4xl font-black">{data.userName}</h1>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={<Package className="w-5 h-5" />} label="Cartas Unicas" value={`${data.stats.uniqueCards}/${data.stats.totalAvailable}`} color="#3b82f6" />
                    <StatCard icon={<Star className="w-5 h-5" />} label="Total Cartas" value={String(data.stats.totalCards)} color="#a855f7" />
                    <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Tiros Usados" value={String(data.stats.pullsUsed)} color="#22c55e" />
                    <StatCard icon={<span className="text-lg">$</span>} label="Total Donado" value={`$${data.stats.totalDonated.toFixed(2)}`} color="#f59e0b" />
                </div>

                {/* Progress bars */}
                {data.progress.length > 0 && (
                    <div className="bg-[#262626] rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-cyan-400" /> Progreso por Rareza</h2>
                        {RARITY_ORDER.map(r => {
                            const prog = data.progress.find(p => p.rarity === r);
                            if (!prog || prog.total === 0) return null;
                            const rc = RARITY_CONFIG[r];
                            return (
                                <div key={r} className="flex items-center gap-3">
                                    <span className="text-xs font-bold w-24 text-right" style={{ color: rc.color }}>{rc.label}</span>
                                    <div className="flex-1 h-4 bg-[#1B1C1D] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${prog.percentage}%`, backgroundColor: rc.color }} />
                                    </div>
                                    <span className="text-xs font-bold w-20 text-gray-400">{prog.owned}/{prog.total} ({prog.percentage}%)</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Gallery */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h2 className="text-lg font-bold">Coleccion ({filteredCards.length})</h2>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 pr-3 py-2 bg-[#262626] border border-[#374151] rounded-xl text-sm text-white w-40" />
                            </div>
                        </div>
                    </div>

                    {/* Rarity filters */}
                    <div className="flex gap-1.5 flex-wrap">
                        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} color="#3b82f6">Todos</FilterBtn>
                        {RARITY_ORDER.map(r => {
                            const rc = RARITY_CONFIG[r];
                            return <FilterBtn key={r} active={filter === r} onClick={() => setFilter(r)} color={rc.color}>{rc.label}</FilterBtn>;
                        })}
                        <FilterBtn active={filter === 'redeemed'} onClick={() => setFilter('redeemed')} color="#22c55e">Canjeados</FilterBtn>
                    </div>

                    {filteredCards.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="font-bold">{data.inventory.length === 0 ? 'Sin cartas aun' : 'Sin resultados con este filtro'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {filteredCards.map(card => {
                                const rc = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.common;
                                return (
                                    <div key={card.id} className="rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.03]" style={{ borderColor: rc.border }}>
                                        <div className="aspect-[3/4] relative" style={{ backgroundColor: `${rc.bg}` }}>
                                            {card.image ? (
                                                <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="w-10 h-10" style={{ color: rc.color, opacity: 0.2 }} />
                                                </div>
                                            )}
                                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: rc.color, color: '#fff' }}>
                                                {rc.stars}
                                            </div>
                                            {card.quantity > 1 && (
                                                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">x{card.quantity}</span>
                                            )}
                                            {card.isRedeemed && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                                                    <span className="px-3 py-1 bg-green-600 text-white text-[10px] font-bold rounded-lg shadow-lg rotate-[-8deg] border border-green-400">CANJEADO</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2 bg-[#262626] text-center">
                                            <p className="text-xs font-bold text-white truncate">{card.name}</p>
                                            <p className="text-[10px]" style={{ color: rc.color }}>{rc.label}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* History */}
                {data.history.length > 0 && (
                    <div className="bg-[#262626] rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2"><History className="w-5 h-5 text-orange-400" /> Historial Reciente</h2>
                            <span className="text-xs text-gray-500">{Math.min(historyLimit, data.history.length)} de {data.history.length}</span>
                        </div>
                        <div className="space-y-1.5">
                            {data.history.slice(0, historyLimit).map(h => {
                                const rc = RARITY_CONFIG[h.rarity] || RARITY_CONFIG.common;
                                return (
                                    <div key={h.id} className="flex items-center gap-3 px-3 py-2 bg-[#1B1C1D] rounded-lg">
                                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 border" style={{ borderColor: rc.border }}>
                                            {h.image ? (
                                                <img src={h.image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: rc.bg }}>
                                                    <Package className="w-4 h-4" style={{ color: rc.color, opacity: 0.4 }} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold truncate">{h.itemName}</p>
                                            <p className="text-[10px]" style={{ color: rc.color }}>{rc.stars} {rc.label}</p>
                                        </div>
                                        <span className="text-[10px] text-gray-500 whitespace-nowrap">{new Date(h.occurredAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {data.history.length > historyLimit && (
                            <button
                                onClick={() => setHistoryLimit(prev => prev + 10)}
                                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-white bg-[#1B1C1D] rounded-lg transition"
                            >
                                Ver mas ({data.history.length - historyLimit} restantes)
                            </button>
                        )}
                        {historyLimit > 5 && (
                            <button
                                onClick={() => setHistoryLimit(5)}
                                className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition"
                            >
                                Mostrar menos
                            </button>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="text-center py-6 text-xs text-gray-600">
                    Powered by <span className="font-bold text-gray-400">Decatron</span> Gacha System
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div className="bg-[#262626] rounded-xl p-4 border border-[#374151]">
            <div className="flex items-center gap-2 mb-2">
                <span style={{ color }}>{icon}</span>
                <span className="text-xs text-gray-400 font-bold">{label}</span>
            </div>
            <p className="text-xl font-black" style={{ color }}>{value}</p>
        </div>
    );
}

function FilterBtn({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color: string }) {
    return (
        <button
            onClick={onClick}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
            style={active ? { backgroundColor: color, color: '#fff' } : { backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
        >
            {children}
        </button>
    );
}
