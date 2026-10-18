import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Trophy, Server, Coins, Palette, ShoppingBag, BarChart3, Settings, Dices, Zap, Receipt, FileText, Sparkles } from 'lucide-react';

function parseJwtClaims(token: string | null): Record<string, string> {
    if (!token) return {};
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch { return {}; }
}

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
    { id: 'tcg-cards', name: 'TCG Cards', description: 'Abre sobres, arma tu colección y sube de nivel tus cartas', icon: <Sparkles className="w-6 h-6 text-[#fb923c]" />, route: '/me/tcg', ready: true },
    { id: 'invoices', name: 'Mis comprobantes', description: 'Las boletas y facturas de tus compras de tier, para ver y descargar', icon: <Receipt className="w-6 h-6 text-[#0ea5e9]" />, route: '/me/invoices', ready: true },
    { id: 'billing', name: 'Datos de facturación', description: 'Tu documento y razón social. Se completan una sola vez y valen para toda compra', icon: <FileText className="w-6 h-6 text-ds-soft" />, route: '/me/billing', ready: true },
    { id: 'progression', name: 'Progresion', description: 'Graficos de XP, actividad y estadisticas detalladas', icon: <BarChart3 className="w-6 h-6 text-ds-accent-text" />, route: '/me/progression', ready: false },
];

export default function MeOverview() {
    const navigate = useNavigate();
    const claims = parseJwtClaims(localStorage.getItem('token'));
    const displayName = claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || '';
    const avatarUrl = claims.ProfileImage || '';
    const [coins, setCoins] = useState<number | null>(null);

    useEffect(() => {
        api.get('/coins/balance').then(r => setCoins(typeof r.data?.balance === 'number' ? r.data.balance : null)).catch(() => setCoins(null));
    }, []);

    return (
        <div className="panel-scale space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-ds-text">Mi Perfil</h1>
                <p className="text-ds-soft mt-2">Tu progreso en la plataforma Decatron</p>
            </div>

            {/* Perfil: solo datos reales de la sesión (nivel, XP, servidores e insignias vuelven cuando exista su backend) */}
            <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-ds-raised flex items-center justify-center text-2xl font-black text-ds-text overflow-hidden flex-shrink-0">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                            displayName[0]?.toUpperCase() || '?'
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-black text-ds-text truncate">{displayName || 'Mi cuenta'}</h2>
                        {coins !== null && (
                            <p className="text-ds-soft text-sm flex items-center gap-1.5 mt-1">
                                <Coins className="w-4 h-4 text-[#eab308]" />
                                {formatNumber(coins)} DecaCoins
                            </p>
                        )}
                    </div>
                </div>
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
