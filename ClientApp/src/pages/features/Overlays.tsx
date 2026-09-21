import { useState, useMemo } from 'react';
import { Lock, Users, Settings, Sparkles, Clock, Gift, Volume2, Bell, Music, ChevronDown, Disc3, Gamepad2, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';

function parseJwtClaims(token: string | null): Record<string, string> {
    if (!token) return {};
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch { return {}; }
}

interface Overlay {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'coming-soon';
    icon: React.ReactNode;
    features: string[];
    usage?: string;
    /** true = funciona en Kick desde el día uno (no aplica el gate "Próximamente en Kick"). */
    kickReady?: boolean;
}

export default function Overlays() {
    const { t } = useTranslation(['overlays', 'common']);
    const { hasMinimumLevel, loading } = usePermissions();
    const navigate = useNavigate();

    // Ninguno de estos overlays fue verificado todavia contra una sesion de
    // Kick (URLs de OBS, resolucion de canal, etc.) — se marcan todos como
    // "Proximamente en Kick" y se habilitan de a uno, mismo criterio que
    // Default Commands (plan seccion 8.17).
    const isKickSession = useMemo(() => {
        const claims = parseJwtClaims(localStorage.getItem('token'));
        return (claims.AuthProvider || 'twitch') === 'kick';
    }, []);

    if (loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('overlays:loading')}</div>;
    }

    if (!hasMinimumLevel('moderation')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">{t('overlays:accessDenied.title')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        {t('overlays:accessDenied.message')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        {t('overlays:accessDenied.backButton')}
                    </button>
                </div>
            </div>
        );
    }

    const overlays: Overlay[] = [
        {
            id: 'shoutout',
            name: t('overlays:overlays.shoutout.name'),
            description: t('overlays:overlays.shoutout.description'),
            status: 'active',
            icon: <Users className="w-6 h-6 text-[#2563eb]" />,
            features: t('overlays:overlays.shoutout.features', { returnObjects: true } as any),
            usage: t('overlays:overlays.shoutout.usage'),
        },
        {
            id: 'timer',
            name: t('overlays:overlays.timer.name'),
            description: t('overlays:overlays.timer.description'),
            status: 'active',
            icon: <Clock className="w-6 h-6 text-[#2563eb]" />,
            features: t('overlays:overlays.timer.features', { returnObjects: true } as any),
            usage: t('overlays:overlays.timer.usage'),
        },
        {
            id: 'giveaways',
            name: t('overlays:overlays.giveaway.name'),
            description: t('overlays:overlays.giveaway.description'),
            status: 'active',
            icon: <Gift className="w-6 h-6 text-[#2563eb]" />,
            features: t('overlays:overlays.giveaway.features', { returnObjects: true } as any),
            usage: t('overlays:overlays.giveaway.usage'),
        },
        {
            id: 'sound-alerts',
            name: t('overlays:overlays.soundAlerts.name'),
            description: t('overlays:overlays.soundAlerts.description'),
            status: 'active',
            icon: <Volume2 className="w-6 h-6 text-[#2563eb]" />,
            features: t('overlays:overlays.soundAlerts.features', { returnObjects: true } as any),
            usage: t('overlays:overlays.soundAlerts.usage'),
        },
        {
            id: 'event-alerts',
            name: 'Event Alerts',
            description: 'Alertas personalizables para follows, bits, subs, raids y más eventos de Twitch',
            status: 'active',
            icon: <Bell className="w-6 h-6 text-[#2563eb]" />,
            features: [
                'Alertas para follows, bits, subs, raids',
                'Sistema de tiers por monto/cantidad',
                'Media personalizable (video, audio, imagen)',
                'Animaciones y efectos visuales',
            ],
            usage: '/overlay/event-alerts',
        },
        {
            id: 'now-playing',
            name: 'Now Playing',
            description: 'Muestra la canción que estás escuchando en tu stream. Conecta Last.fm o Spotify',
            status: 'active',
            icon: <Music className="w-6 h-6 text-[#2563eb]" />,
            features: [
                'Muestra canción, artista, álbum y miniatura',
                'Barra de progreso en tiempo real',
                'Conecta Last.fm (cualquier reproductor)',
                'Totalmente personalizable (fuentes, colores, posición)',
            ],
            usage: '/overlay/now-playing?channel=tu_canal',
        },
        {
            id: 'games',
            name: 'Game Overlays',
            description: 'Tu rango, W-L de la sesión y últimas partidas en pantalla, del juego que estás jugando. LoL con datos automáticos; TFT, Valorant, Marvel Rivals, CS2, Fortnite, Rocket League y Warzone con rango manual por ahora.',
            status: 'active',
            icon: <Gamepad2 className="w-6 h-6 text-[#2563eb]" />,
            features: [
                'Cambia solo según la categoría del stream',
                'Varias cuentas por juego con rotación',
                'Editor visual: layout, fuentes, colores, posición',
                'Comandos !rango, !lp, !sesion en el chat',
            ],
            usage: '/overlay/games?channel=tu_canal',
            kickReady: true,
        },
        {
            id: 'live',
            name: 'Partida en vivo',
            description: 'Lo que pasa en tu partida ahora, leído del cliente de LoL por Decatron Desktop: lobby con tus amigos, selección de campeón con el coach, tiempo de partida con la predicción del chat y resumen al terminar. Una pantalla por fase, en una caja que no cambia de tamaño.',
            status: 'active',
            icon: <Radio className="w-6 h-6 text-[#2563eb]" />,
            features: [
                'Lobby, selección, en partida y fin en una sola fuente de OBS',
                'Coach de LoL y predicción del chat integrados',
                'Transparente cuando no estás jugando',
                'Editor visual: layout, pantallas, elementos, fuentes',
            ],
            usage: '/overlay/live?channel=tu_canal',
            kickReady: true,
        },
        {
            id: 'wheel',
            name: t('overlays:overlays.wheel.name'),
            description: t('overlays:overlays.wheel.description'),
            status: 'active',
            icon: <Disc3 className="w-6 h-6 text-[#2563eb]" />,
            features: t('overlays:overlays.wheel.features', { returnObjects: true } as any),
            usage: t('overlays:overlays.wheel.usage'),
        },
        {
            id: 'gacha',
            name: t('overlays:overlays.gacha.name'),
            description: t('overlays:overlays.gacha.description'),
            status: 'coming-soon',
            icon: <Sparkles className="w-6 h-6 text-[#2563eb]" />,
            features: t('overlays:overlays.gacha.features', { returnObjects: true } as any),
        }
    ];

    const handleConfigure = (overlayId: string) => {
        const routes: Record<string, string> = {
            'games': '/overlays/games',
            'live': '/overlays/live',
            'shoutout': '/overlays/shoutout',
            'timer': '/overlays/timer',
            'giveaways': '/features/giveaways',
            'sound-alerts': '/features/sound-alerts',
            'event-alerts': '/overlays/event-alerts',
            'now-playing': '/overlays/now-playing',
            'wheel': '/overlays/rueda',
            'gacha': '/overlays/gacha'
        };
        navigate(routes[overlayId] || `/overlays/${overlayId}`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('overlays:header.title')}</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        {t('overlays:header.subtitle')}
                    </p>
                </div>
            </div>

            {/* Grid de overlays */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl">
                {overlays.map((overlay) => (
                    <OverlayCard
                        key={overlay.id}
                        overlay={overlay}
                        kickUnverified={isKickSession && overlay.status === 'active' && !overlay.kickReady}
                        onConfigure={() => handleConfigure(overlay.id)}
                    />
                ))}
            </div>
        </div>
    );
}

interface OverlayCardProps {
    overlay: Overlay;
    kickUnverified: boolean;
    onConfigure: () => void;
}

function OverlayCard({ overlay, kickUnverified, onConfigure }: OverlayCardProps) {
    const { t } = useTranslation(['overlays']);
    const [expanded, setExpanded] = useState(false);
    const isActive = overlay.status === 'active' && !kickUnverified;

    return (
        <div
            className={`bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151] hover:shadow-lg transition-all flex flex-col ${kickUnverified ? 'opacity-60' : ''}`}
            title={kickUnverified ? 'Todavía no verificado para Kick — se habilita de a uno, card por card.' : undefined}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    {overlay.icon}
                    <h3 className="text-base font-black text-[#1e293b] dark:text-[#f8fafc] truncate">
                        {overlay.name}
                    </h3>
                </div>
                <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                    isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                }`}>
                    {isActive ? t('overlays:status.available') : kickUnverified ? 'Próximamente en Kick' : t('overlays:status.comingSoon')}
                </div>
            </div>

            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-3">
                {overlay.description}
            </p>

            <button
                onClick={() => setExpanded(prev => !prev)}
                className="flex items-center gap-1 text-xs font-semibold text-[#2563eb] hover:text-blue-700 mb-1 self-start"
            >
                {expanded ? t('overlays:hideDetails') : t('overlays:showDetails')}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <div className="mb-3 pt-2 border-t border-[#e2e8f0] dark:border-[#374151] space-y-3">
                    <div>
                        <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1.5">{t('overlays:features')}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {overlay.features.map((feature, i) => (
                                <span
                                    key={i}
                                    className="text-[11px] px-2 py-0.5 rounded-full bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]"
                                >
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </div>

                    {overlay.usage && (
                        <div>
                            <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1.5">{t('overlays:usage')}</p>
                            <code className="block text-xs font-mono bg-[#f8fafc] dark:bg-[#262626] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc]">
                                {overlay.usage}
                            </code>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end pt-3 mt-auto border-t border-[#e2e8f0] dark:border-[#374151]">
                {isActive ? (
                    <button
                        onClick={onConfigure}
                        className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm"
                    >
                        <Settings className="w-4 h-4" />
                        {t('overlays:configureButton')}
                    </button>
                ) : (
                    <button
                        disabled
                        className="flex items-center gap-2 px-4 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] dark:text-[#94a3b8] font-semibold text-sm opacity-50 cursor-not-allowed"
                    >
                        <Settings className="w-4 h-4" />
                        {t('overlays:comingSoonButton')}
                    </button>
                )}
            </div>
        </div>
    );
}
