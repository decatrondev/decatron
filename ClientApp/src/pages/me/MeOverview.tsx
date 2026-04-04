import { useNavigate } from 'react-router-dom';
import { Trophy, Server, TrendingUp, Coins, Palette, ShoppingBag, BarChart3, Settings } from 'lucide-react';

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
    { id: 'servers', name: 'Mis Servidores', description: 'Tus servidores de Discord, nivel, ranking y roles', icon: <Server className="w-6 h-6 text-[#2563eb]" />, route: '/me/servers', ready: false },
    { id: 'achievements', name: 'Achievements', description: 'Badges desbloqueados, progreso y logros', icon: <Trophy className="w-6 h-6 text-[#f59e0b]" />, route: '/me/achievements', ready: false },
    { id: 'card', name: 'Mi Rank Card', description: 'Personaliza tu card con fondos, marcos y mas', icon: <Palette className="w-6 h-6 text-[#a855f7]" />, route: '/me/card', ready: false },
    { id: 'marketplace', name: 'Marketplace', description: 'Compra fondos, marcos y items cosmeticos con DecaCoins', icon: <ShoppingBag className="w-6 h-6 text-[#ec4899]" />, route: '/me/marketplace', ready: false },
    { id: 'coins', name: 'DecaCoins', description: 'Tu balance, compra paquetes y historial de transacciones', icon: <Coins className="w-6 h-6 text-[#eab308]" />, route: '/me/coins', ready: true },
    { id: 'progression', name: 'Progresion', description: 'Graficos de XP, actividad y estadisticas detalladas', icon: <BarChart3 className="w-6 h-6 text-[#22c55e]" />, route: '/me/progression', ready: false },
];

export default function MeOverview() {
    const navigate = useNavigate();
    const user = MOCK_USER;
    const progress = Math.round((user.globalXp / user.globalXpRequired) * 100);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Mi Perfil</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">Tu progreso en la plataforma Decatron</p>
            </div>

            {/* Rank Card Preview */}
            <div className="bg-gradient-to-r from-[#1a1b1e] to-[#2d2f36] rounded-2xl p-6 border border-[#374151] shadow-lg">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-[#374151] flex items-center justify-center text-2xl font-black text-white overflow-hidden flex-shrink-0">
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                            user.username[0]
                        )}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-white">{user.displayName}</h2>
                        <p className="text-[#94a3b8] text-sm mb-2">Nivel {user.globalLevel} Global</p>
                        <div className="w-full bg-[#374151] rounded-full h-2.5">
                            <div
                                className="bg-gradient-to-r from-[#2563eb] to-[#3b82f6] h-2.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-[#94a3b8] mt-1">
                            {formatNumber(user.globalXp)} / {formatNumber(user.globalXpRequired)} XP — {progress}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Nivel Global', value: user.globalLevel.toString(), icon: TrendingUp, color: 'text-[#2563eb]' },
                    { label: 'Servidores', value: user.totalServers.toString(), icon: Server, color: 'text-[#22c55e]' },
                    { label: 'Badges', value: user.totalBadges.toString(), icon: Trophy, color: 'text-[#f59e0b]' },
                    { label: 'DecaCoins', value: formatNumber(user.coins), icon: Coins, color: 'text-[#eab308]' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151] text-center">
                        <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                        <p className="text-xl font-black text-gray-900 dark:text-white">{stat.value}</p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Section Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SECTIONS.map((section) => (
                    <div
                        key={section.id}
                        className={`bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] ${section.ready ? 'hover:shadow-lg' : 'opacity-70'} transition-all`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            {section.icon}
                            <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                {section.name}
                            </h3>
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                            {section.description}
                        </p>
                        <div className="flex items-center justify-end pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                            {section.ready ? (
                                <button
                                    onClick={() => navigate(section.route)}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm"
                                >
                                    <Settings className="w-4 h-4" />
                                    Ver
                                </button>
                            ) : (
                                <span className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] text-sm font-bold rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
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
