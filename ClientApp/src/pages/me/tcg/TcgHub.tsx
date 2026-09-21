import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShoppingBag, LayoutGrid, BookOpen, Coins, PackageOpen, Gift,
    Swords, Store, BarChart3, Trophy, Star, Award,
} from 'lucide-react';
import api from '../../../services/api';
import TcgContextBanner from './TcgContextBanner';

interface TcgCard {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    route: string;
    /** Sin ruta funcional todavía: se muestra apagada y no navega. */
    soon?: boolean;
}

const CARDS: TcgCard[] = [
    {
        id: 'claim',
        name: 'Carta gratis',
        description: 'Una carta por día, sin gastar coins',
        icon: <Gift className="w-6 h-6 text-[#22c55e]" />,
        route: '/me/tcg/claim',
    },
    {
        id: 'shop',
        name: 'Tienda de sobres',
        description: 'Comprá sobres con tus DecaCoins',
        icon: <ShoppingBag className="w-6 h-6 text-[#2563eb]" />,
        route: '/me/tcg/shop',
    },
    {
        id: 'open',
        name: 'Abrir sobres',
        description: 'Abrí los sobres que ya compraste',
        icon: <PackageOpen className="w-6 h-6 text-[#eab308]" />,
        route: '/me/tcg/open',
    },
    {
        id: 'collection',
        name: 'Mi colección',
        description: 'Todas tus cartas, con filtros y orden',
        icon: <LayoutGrid className="w-6 h-6 text-[#a855f7]" />,
        route: '/me/tcg/collection',
    },
    {
        id: 'dex',
        name: 'Catálogo',
        description: 'Todas las cartas que existen en el juego',
        icon: <BookOpen className="w-6 h-6 text-[#22c55e]" />,
        route: '/me/tcg/dex',
    },
    {
        id: 'stats',
        name: 'Estadísticas',
        description: 'Tu colección en números: valor, grados, progreso',
        icon: <BarChart3 className="w-6 h-6 text-[#06b6d4]" />,
        route: '/me/tcg/stats',
    },
    {
        id: 'battles',
        name: 'Batallas',
        description: 'Peleá con tus cartas contra el bot o contra otros jugadores',
        icon: <Swords className="w-6 h-6 text-[#ef4444]" />,
        route: '/me/tcg/battles',
        soon: true,
    },
    {
        id: 'showcase',
        name: 'Vitrina',
        description: 'Una página pública con tus mejores cartas, para compartir',
        icon: <Star className="w-6 h-6 text-[#f59e0b]" />,
        route: '/me/tcg/showcase',
        soon: true,
    },
    {
        id: 'ranking',
        name: 'Ranking',
        description: 'Las colecciones más valiosas de la plataforma',
        icon: <Trophy className="w-6 h-6 text-[#eab308]" />,
        route: '/me/tcg/ranking',
        soon: true,
    },
    {
        id: 'achievements',
        name: 'Logros',
        description: 'Hitos por completar con tu colección',
        icon: <Award className="w-6 h-6 text-[#8b5cf6]" />,
        route: '/me/tcg/achievements',
        soon: true,
    },
    {
        id: 'marketplace',
        name: 'Marketplace',
        description: 'Intercambiar cartas con otros jugadores',
        icon: <Store className="w-6 h-6 text-[#ec4899]" />,
        route: '/me/tcg/marketplace',
        soon: true,
    },
];

export default function TcgHub() {
    const navigate = useNavigate();
    const [balance, setBalance] = useState<number | null>(null);
    const [unopened, setUnopened] = useState(0);
    const [claimAvailable, setClaimAvailable] = useState(false);

    useEffect(() => {
        api.get('/tcg/balance')
            .then((res) => setBalance(res.data.balance))
            .catch((err) => console.error('Error loading balance:', err));

        api.get('/tcg/packs')
            .then((res) => {
                const items = Array.isArray(res.data) ? res.data : [];
                setUnopened(items.reduce((sum: number, p: { count: number }) => sum + p.count, 0));
            })
            .catch((err) => console.error('Error loading packs:', err));

        api.get('/tcg/claim')
            .then((res) => setClaimAvailable(!!res.data.available))
            .catch((err) => console.error('Error loading claim status:', err));
    }, []);

    return (
        <div className="space-y-6">
            <TcgContextBanner />
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">TCG — Cards Coleccionables</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">Abrí sobres, armá tu colección y gradeá tus cartas.</p>
                </div>
                {balance != null && (
                    <div className="flex items-center gap-2 bg-[#1a1b1e] border border-[#374151] rounded-xl px-4 py-2">
                        <Coins className="w-5 h-5 text-[#eab308]" />
                        <span className="text-lg font-bold text-white">{balance.toLocaleString()}</span>
                        <span className="text-sm text-[#94a3b8]">DecaCoins</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CARDS.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => !c.soon && navigate(c.route)}
                        disabled={c.soon}
                        className={`relative text-left rounded-2xl p-5 flex flex-col gap-3 transition-colors border ${
                            c.soon
                                ? 'bg-[#1a1b1e]/50 border-[#374151]/50 cursor-default'
                                : 'bg-[#1a1b1e] border-[#374151] hover:border-[#2563eb]'
                        }`}
                    >
                        {c.soon && (
                            <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[10px] font-bold uppercase tracking-wider">
                                Próximamente
                            </span>
                        )}
                        {c.id === 'open' && unopened > 0 && (
                            <span className="absolute top-4 right-4 min-w-[1.75rem] px-2 py-0.5 rounded-full bg-[#2563eb] text-white text-xs font-bold text-center tabular-nums">
                                {unopened}
                            </span>
                        )}
                        {c.id === 'claim' && claimAvailable && (
                            <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-[#22c55e] text-white text-xs font-bold">
                                Lista
                            </span>
                        )}
                        <div className={`w-12 h-12 rounded-xl bg-black/20 flex items-center justify-center ${c.soon ? 'opacity-40' : ''}`}>
                            {c.icon}
                        </div>
                        <div>
                            <div className={`font-bold ${c.soon ? 'text-white/50' : 'text-white'}`}>{c.name}</div>
                            <div className={`text-sm mt-1 ${c.soon ? 'text-[#64748b]' : 'text-[#94a3b8]'}`}>{c.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
