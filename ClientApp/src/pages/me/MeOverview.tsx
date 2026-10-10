import { useNavigate } from 'react-router-dom';
import { Trophy, Server, TrendingUp, Coins, Palette, ShoppingBag, BarChart3, Settings, Dices, Zap, Receipt, FileText, Sparkles } from 'lucide-react';

// Mock data — will be replaced with real API calls
const MOCK_USER = {
    username: 'AnthonyDeca',
    displayName: 'AnthonyDeca',
    avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
    globalLevel: 42,
    globalXp: 45200,
    globalXpRequired: 58000,
    coins: 1250,
    totalServers: 5,
    totalBadges: 12,
    totalMessages: 15420,
};

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

const SECTIONS = [
    { id: 'servers', name: 'Mis Servidores', description: 'Tus servidores de Discord, nivel, ranking y roles', icon: <Server className="w-6 h-6 text-ds-accent-text" />, route: '/me/servers', ready: false },
    { id: 'achievements', name: 'Achievements', description: 'Badges desbloqueados, progreso y logros', icon: <Trophy className="w-6 h-6 text-ds-accent-text" />, route: '/me/achievements', ready: false },
    { id: 'card', name: 'Mi Rank Card', description: 'Personaliza tu card con fondos, marcos y mas', icon: <Palette className="w-6 h-6 text-ds-accent-text" />, route: '/me/card', ready: false },
    { id: 'marketplace', name: 'Marketplace', description: 'Compra fondos, marcos y items cosmeticos con DecaCoins', icon: <ShoppingBag className="w-6 h-6 text-[#ec4899]" />, route: '/me/marketplace', ready: false },
    { id: 'gacha', name: 'Mi Gacha', description: 'Tus colecciones de cartas, vitrina, wishlist y logros', icon: <Dices className="w-6 h-6 text-ds-accent-text" />, route: '/me/gacha', ready: true },
    { id: 'spirits', name: 'Mis Spirits', description: 'Trackea tu colección de Fortnite Spirits, marca los que tienes y comparte tu progreso', icon: <Zap className="w-6 h-6 text-[#7B61FF]" />, route: '/me/spirits', ready: true },
    { id: 'coins', name: 'DecaCoins', description: 'Tu balance, compra paquetes y historial de transacciones', icon: <Coins className="w-6 h-6 text-[#eab308]" />, route: '/me/coins', ready: true },
    { id: 'tcg-cards', name: 'TCG Cards', description: 'Abrí sobres, armá tu colección y subí de nivel tus cartas', icon: <Sparkles className="w-6 h-6 text-[#fb923c]" />, route: '/me/tcg', ready: true },
    { id: 'invoices', name: 'Mis comprobantes', description: 'Las boletas y facturas de tus compras de tier, para ver y descargar', icon: <Receipt className="w-6 h-6 text-[#0ea5e9]" />, route: '/me/invoices', ready: true },
    { id: 'billing', name: 'Datos de facturación', description: 'Tu documento y razón social. Se completan una sola vez y valen para toda compra', icon: <FileText className="w-6 h-6 text-ds-soft" />, route: '/me/billing', ready: true },
    { id: 'progression', name: 'Progresion', description: 'Graficos de XP, actividad y estadisticas detalladas', icon: <BarChart3 className="w-6 h-6 text-ds-accent-text" />, route: '/me/progression', ready: false },
];

export default function MeOverview() {
    const navigate = useNavigate();
    const user = MOCK_USER;
    const progress = Math.round((user.globalXp / user.globalXpRequired) * 100);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-ds-text">Mi Perfil</h1>
                <p className="text-ds-soft mt-2">Tu progreso en la plataforma Decatron</p>
            </div>

            {/* Rank Card Preview */}
            <div className="bg-gradient-to-r from-[#1a1b1e] to-[#2d2f36] rounded-lg p-6 border border-ds-border">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-ds-raised flex items-center justify-center text-2xl font-black text-ds-text overflow-hidden flex-shrink-0">
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                            user.username[0]
                        )}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-ds-text">{user.displayName}</h2>
                        <p className="text-ds-soft text-sm mb-2">Nivel {user.globalLevel} Global</p>
                        <div className="w-full bg-ds-raised rounded-full h-2.5">
                            <div
                                className="bg-ds-accent h-2.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-ds-soft mt-1">
                            {formatNumber(user.globalXp)} / {formatNumber(user.globalXpRequired)} XP — {progress}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Nivel Global', value: user.globalLevel.toString(), icon: TrendingUp, color: 'text-ds-accent-text' },
                    { label: 'Servidores', value: user.totalServers.toString(), icon: Server, color: 'text-ds-ok' },
                    { label: 'Badges', value: user.totalBadges.toString(), icon: Trophy, color: 'text-ds-warn' },
                    { label: 'DecaCoins', value: formatNumber(user.coins), icon: Coins, color: 'text-[#eab308]' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-ds-surface rounded-lg p-4 border border-ds-border text-center">
                        <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                        <p className="text-xl font-black text-ds-text">{stat.value}</p>
                        <p className="text-xs text-ds-soft">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Section Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SECTIONS.map((section) => (
                    <div
                        key={section.id}
                        className={`bg-ds-surface rounded-lg p-6 border border-ds-border ${section.ready ? '' : 'opacity-70'} transition-all`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            {section.icon}
                            <h3 className="text-xl font-black text-ds-text">
                                {section.name}
                            </h3>
                        </div>
                        <p className="text-sm text-ds-soft mb-4">
                            {section.description}
                        </p>
                        <div className="flex items-center justify-end pt-4 border-t border-ds-border">
                            {section.ready ? (
                                <button
                                    onClick={() => navigate(section.route)}
                                    className="ds-btn ds-btn--primary"
                                >
                                    <Settings className="w-4 h-4" />
                                    Ver
                                </button>
                            ) : (
                                <span className="px-4 py-2 bg-ds-bg text-ds-soft text-sm font-bold rounded-lg border border-ds-border">
                                    Proximamente
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
