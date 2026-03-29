import { Lock, Users, Settings, Sparkles, Clock, Gift, Volume2, Bell, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';

interface Overlay {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'coming-soon';
    icon: React.ReactNode;
}

export default function Overlays() {
    const { t } = useTranslation(['overlays', 'common']);
    const { hasMinimumLevel, loading } = usePermissions();
    const navigate = useNavigate();

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
            icon: <Users className="w-6 h-6 text-[#2563eb]" />
        },
        {
            id: 'timer',
            name: t('overlays:overlays.timer.name'),
            description: t('overlays:overlays.timer.description'),
            status: 'active',
            icon: <Clock className="w-6 h-6 text-[#2563eb]" />
        },
        {
            id: 'giveaways',
            name: t('overlays:overlays.giveaway.name'),
            description: t('overlays:overlays.giveaway.description'),
            status: 'active',
            icon: <Gift className="w-6 h-6 text-[#2563eb]" />
        },
        {
            id: 'sound-alerts',
            name: t('overlays:overlays.soundAlerts.name'),
            description: t('overlays:overlays.soundAlerts.description'),
            status: 'active',
            icon: <Volume2 className="w-6 h-6 text-[#2563eb]" />
        },
        {
            id: 'event-alerts',
            name: 'Event Alerts',
            description: 'Alertas personalizables para follows, bits, subs, raids y más eventos de Twitch',
            status: 'active',
            icon: <Bell className="w-6 h-6 text-[#2563eb]" />
        },
        {
            id: 'now-playing',
            name: 'Now Playing',
            description: 'Muestra la canción que estás escuchando en tu stream. Conecta Last.fm o Spotify',
            status: 'active',
            icon: <Music className="w-6 h-6 text-[#2563eb]" />
        },
        {
            id: 'gacha',
            name: t('overlays:overlays.gacha.name'),
            description: t('overlays:overlays.gacha.description'),
            status: 'coming-soon',
            icon: <Sparkles className="w-6 h-6 text-[#2563eb]" />
        }
    ];

    const handleConfigure = (overlayId: string) => {
        const routes: Record<string, string> = {
            'shoutout': '/overlays/shoutout',
            'timer': '/overlays/timer',
            'giveaways': '/features/giveaways',
            'sound-alerts': '/features/sound-alerts',
            'event-alerts': '/overlays/event-alerts',
            'now-playing': '/overlays/now-playing',
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {overlays.map((overlay) => (
                    <OverlayCard
                        key={overlay.id}
                        overlay={overlay}
                        onConfigure={() => handleConfigure(overlay.id)}
                    />
                ))}
            </div>
        </div>
    );
}

interface OverlayCardProps {
    overlay: Overlay;
    onConfigure: () => void;
}

function OverlayCard({ overlay, onConfigure }: OverlayCardProps) {
    const { t } = useTranslation(['overlays']);

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] hover:shadow-lg transition-all">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        {overlay.icon}
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {overlay.name}
                        </h3>
                    </div>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        {overlay.description}
                    </p>
                </div>

                {/* Status Badge */}
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    overlay.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                }`}>
                    {overlay.status === 'active' ? t('overlays:status.available') : t('overlays:status.comingSoon')}
                </div>
            </div>

            {/* Features */}
            {['shoutout', 'timer', 'giveaways', 'sound-alerts', 'event-alerts', 'now-playing', 'gacha'].includes(overlay.id) && (
                <div className="mb-4 pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('overlays:features')}</p>
                    <ul className="space-y-1">
                        {overlay.id === 'shoutout' && t('overlays:overlays.shoutout.features', { returnObjects: true } as any).map((feature: string, i: number) => (
                            <li key={i} className="text-xs text-[#64748b] dark:text-[#94a3b8]">• {feature}</li>
                        ))}
                        {overlay.id === 'timer' && t('overlays:overlays.timer.features', { returnObjects: true } as any).map((feature: string, i: number) => (
                            <li key={i} className="text-xs text-[#64748b] dark:text-[#94a3b8]">• {feature}</li>
                        ))}
                        {overlay.id === 'giveaways' && t('overlays:overlays.giveaway.features', { returnObjects: true } as any).map((feature: string, i: number) => (
                            <li key={i} className="text-xs text-[#64748b] dark:text-[#94a3b8]">• {feature}</li>
                        ))}
                        {overlay.id === 'sound-alerts' && t('overlays:overlays.soundAlerts.features', { returnObjects: true } as any).map((feature: string, i: number) => (
                            <li key={i} className="text-xs text-[#64748b] dark:text-[#94a3b8]">• {feature}</li>
                        ))}
                        {overlay.id === 'event-alerts' && (
                            <>
                                <li className="text-xs text-[#64748b] dark:text-[#94a3b8]">• Alertas para follows, bits, subs, raids</li>
                                <li className="text-xs text-[#64748b] dark:text-[#94a3b8]">• Sistema de tiers por monto/cantidad</li>
                                <li className="text-xs text-[#64748b] dark:text-[#94a3b8]">• Media personalizable (video, audio, imagen)</li>
                                <li className="text-xs text-[#64748b] dark:text-[#94a3b8]">• Animaciones y efectos visuales</li>
                            </>
                        )}
                        {overlay.id === 'now-playing' && (
                            <>
                                <li className="text-xs text-[#64748b] dark:text-[#94a3b8]">• Muestra canción, artista, álbum y miniatura</li>
                                <li className="text-xs text-[#64748b] dark:text-[#94a3b8]">• Barra de progreso en tiempo real</li>
                                <li className="text-xs text-[#64748b] dark:text-[#94a3b8]">• Conecta Last.fm (cualquier reproductor)</li>
                                <li className="text-xs text-[#64748b] dark:text-[#94a3b8]">• Totalmente personalizable (fuentes, colores, posición)</li>
                            </>
                        )}
                        {overlay.id === 'gacha' && t('overlays:overlays.gacha.features', { returnObjects: true } as any).map((feature: string, i: number) => (
                            <li key={i} className="text-xs text-[#64748b] dark:text-[#94a3b8]">• {feature}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Usage Example */}
            {['shoutout', 'timer', 'giveaways', 'sound-alerts', 'event-alerts', 'now-playing'].includes(overlay.id) && (
                <div className="mb-4">
                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('overlays:usage')}</p>
                    <code className="block text-sm font-mono bg-[#f8fafc] dark:bg-[#262626] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc]">
                        {overlay.id === 'shoutout' && t('overlays:overlays.shoutout.usage')}
                        {overlay.id === 'timer' && t('overlays:overlays.timer.usage')}
                        {overlay.id === 'giveaways' && t('overlays:overlays.giveaway.usage')}
                        {overlay.id === 'sound-alerts' && t('overlays:overlays.soundAlerts.usage')}
                        {overlay.id === 'event-alerts' && '/overlay/event-alerts'}
                        {overlay.id === 'now-playing' && '/overlay/now-playing?channel=tu_canal'}
                    </code>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                {overlay.status === 'active' ? (
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
