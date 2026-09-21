import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Trophy, Crown, Dices, Loader2, Package } from 'lucide-react';

interface RankingEntry {
    name: string;
    login: string | null;
    value: number;
    secondary: number;
}

interface RankingData {
    channelName: string;
    banner?: string;
    ranking: {
        totalAvailable: number;
        collectors: RankingEntry[];
        hunters: RankingEntry[];
        pullers: RankingEntry[];
    };
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GachaRanking() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';
    const [data, setData] = useState<RankingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!channel) { setError('Parametro channel requerido en la URL'); setLoading(false); return; }
        (async () => {
            try {
                const res = await fetch(`/api/gacha/public/ranking?channel=${encodeURIComponent(channel)}`);
                const json = await res.json();
                if (json.success) setData(json);
                else setError(json.message || 'Error cargando ranking');
            } catch { setError('Error de conexion'); }
            finally { setLoading(false); }
        })();
    }, [channel]);

    if (loading) return (
        <div className="min-h-screen bg-[#1B1C1D] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
    );

    if (error || !data) return (
        <div className="min-h-screen bg-[#1B1C1D] flex items-center justify-center text-white">
            <div className="text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                <p className="text-xl font-bold">{error || 'Sin datos'}</p>
            </div>
        </div>
    );

    const { ranking } = data;
    const empty = ranking.collectors.length === 0 && ranking.hunters.length === 0 && ranking.pullers.length === 0;

    return (
        <div className="min-h-screen bg-[#1B1C1D] text-white font-sans">
            {/* Banner */}
            <div className="relative h-48 sm:h-64 overflow-hidden">
                {data.banner ? (
                    <img src={data.banner} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B1C1D] via-[#1B1C1D]/60 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                    <p className="text-sm text-gray-300 font-bold uppercase tracking-wider">{data.channelName}</p>
                    <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3"><Trophy className="w-8 h-8 text-amber-400" /> Ranking del Gacha</h1>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
                {empty ? (
                    <div className="text-center py-16 text-gray-400">
                        <Package className="w-14 h-14 mx-auto mb-3 opacity-40" />
                        <p className="font-bold">Nadie tiene cartas todavia</p>
                        <p className="text-sm">Se el primero con <span className="text-white font-mono">!gcpull</span> en el chat</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <Board
                            icon={<Package className="w-5 h-5" />}
                            title="Coleccionistas"
                            subtitle="Cartas unicas conseguidas"
                            color="#3b82f6"
                            channel={data.channelName}
                            entries={ranking.collectors}
                            format={e => `${e.value}/${ranking.totalAvailable}`}
                            sub={e => ranking.totalAvailable > 0 ? `${Math.round((e.value / ranking.totalAvailable) * 100)}%` : ''}
                        />
                        <Board
                            icon={<Crown className="w-5 h-5" />}
                            title="Cazadores"
                            subtitle="Legendarias (y epicas)"
                            color="#f59e0b"
                            channel={data.channelName}
                            entries={ranking.hunters}
                            format={e => `${e.value} ★★★★★`}
                            sub={e => e.secondary > 0 ? `${e.secondary} epicas` : ''}
                        />
                        <Board
                            icon={<Dices className="w-5 h-5" />}
                            title="Mas tiros"
                            subtitle="Quien mas ha tirado"
                            color="#22c55e"
                            channel={data.channelName}
                            entries={ranking.pullers}
                            format={e => `${e.value}`}
                            sub={() => 'tiros'}
                        />
                    </div>
                )}

                <p className="text-center text-xs text-gray-500">
                    Los viewers con coleccion privada aparecen como Anonimo. Escribe <span className="font-mono text-gray-300">!gctop</span> en el chat para ver el top 3.
                </p>
            </div>
        </div>
    );
}

function Board({ icon, title, subtitle, color, channel, entries, format, sub }: {
    icon: React.ReactNode; title: string; subtitle: string; color: string; channel: string;
    entries: RankingEntry[]; format: (e: RankingEntry) => string; sub: (e: RankingEntry) => string;
}) {
    return (
        <div className="bg-[#262626] rounded-2xl border border-[#374151] overflow-hidden">
            <div className="p-4 border-b border-[#374151] flex items-center gap-3" style={{ background: `${color}14` }}>
                <span style={{ color }}>{icon}</span>
                <div>
                    <h2 className="font-black" style={{ color }}>{title}</h2>
                    <p className="text-[11px] text-gray-400">{subtitle}</p>
                </div>
            </div>
            {entries.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500">Sin datos aun</p>
            ) : (
                <ol className="divide-y divide-[#374151]">
                    {entries.map((e, i) => {
                        const name = e.login
                            ? <Link to={`/gacha/collection?channel=${encodeURIComponent(channel)}&user=${encodeURIComponent(e.login)}`} className="hover:underline">{e.name}</Link>
                            : <span className={e.name === 'Anónimo' ? 'text-gray-500 italic' : ''}>{e.name}</span>;
                        return (
                            <li key={i} className={`flex items-center gap-3 px-4 py-3 ${i < 3 ? 'bg-white/[0.02]' : ''}`}>
                                <span className="w-7 text-center font-black text-sm">{i < 3 ? MEDALS[i] : <span className="text-gray-500">{i + 1}</span>}</span>
                                <span className="flex-1 font-bold truncate">{name}</span>
                                <span className="text-right">
                                    <span className="font-black" style={{ color }}>{format(e)}</span>
                                    {sub(e) && <span className="block text-[10px] text-gray-500">{sub(e)}</span>}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}
