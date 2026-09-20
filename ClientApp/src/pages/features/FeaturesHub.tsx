import { useMemo } from 'react';
import { Clock, Gift, Volume2, Bell, MessageSquare, DollarSign, Cpu, Settings, Dices, Mic, Zap, Trophy, Languages, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';

function parseJwtClaims(token: string | null): Record<string, string> {
    if (!token) return {};
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch { return {}; }
}

interface FeatureCard {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    route: string;
    requiresControlTotal?: boolean;
    buttonLabel?: string;
    // Ya verificado que funciona con una sesion de Kick (resuelve canal/API de
    // forma agnostica de plataforma) — si es false, se marca "Proximamente en
    // Kick" para esa sesion. Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md
    // seccion 8, item 3.
    kickVerified?: boolean;
}

export default function FeaturesHub() {
    const navigate = useNavigate();
    const { hasMinimumLevel } = usePermissions();

    const isKickSession = useMemo(() => {
        const claims = parseJwtClaims(localStorage.getItem('token'));
        return (claims.AuthProvider || 'twitch') === 'kick';
    }, []);

    const cards: FeatureCard[] = [
        {
            id: 'timers',
            name: 'Timers',
            description: 'Mensajes automaticos que se envian en intervalos regulares',
            icon: <Clock className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/timers'
        },
        {
            id: 'giveaways',
            name: 'Giveaways',
            description: 'Crea y gestiona sorteos para tu comunidad',
            icon: <Gift className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/giveaways'
        },
        {
            id: 'sound-alerts',
            name: 'Sound Alerts',
            description: 'Alertas de sonido que los viewers pueden activar con puntos',
            icon: <Volume2 className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/sound-alerts',
            kickVerified: true
        },
        {
            id: 'decatron-chat',
            name: 'Decatron Chat',
            description: 'Chat integrado con funciones avanzadas de moderacion',
            icon: <MessageSquare className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/decatron-chat'
        },
        {
            id: 'tips',
            name: 'Tips',
            description: 'Recibe donaciones de tu comunidad via PayPal',
            icon: <DollarSign className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/tips'
        },
        {
            id: 'speak-chat',
            name: 'Speak Chat',
            description: 'Lee los mensajes del chat en voz alta con TTS (Polly o navegador)',
            icon: <Mic className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/speak-chat'
        },
        {
            id: 'gacha',
            name: 'Gacha System',
            description: 'Sistema de cartas coleccionables con donaciones y probabilidades',
            icon: <Dices className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/gacha'
        },
        {
            id: 'torneos',
            name: 'Torneos',
            description: 'Torneo de LoL estilo SoloQ Climb con ranking en vivo (Milestone 0, en desarrollo)',
            icon: <Trophy className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/torneos'
        },
        {
            id: 'spirits',
            name: 'Fortnite Spirit Tracker',
            description: 'Colección visual de Fortnite Spirits. Tus viewers trackean cuáles tienen con comandos de Twitch y Discord',
            icon: <Zap className="w-6 h-6 text-[#7B61FF]" />,
            route: '/me/spirits',
            buttonLabel: 'Ver colección',
            kickVerified: true // Es por cuenta, no por canal — ver plan seccion 8.10.
        },
        {
            id: 'live-translation',
            name: 'Traducción en vivo',
            description: 'Tus viewers te escuchan doblado a su idioma desde la extensión; cada uno elige el suyo y nadie más lo nota',
            icon: <Languages className="w-6 h-6 text-[#9146FF]" />,
            route: '/features/live-translation'
        },
        {
            id: 'lol-coach',
            name: 'Decatron Coach · LoL',
            description: 'Un coach con IA que comenta tu selección de campeón, te da runas y build al lockear y opina al terminar. Con Decatron Desktop',
            icon: <Gamepad2 className="w-6 h-6 text-[#c8aa6e]" />,
            route: '/features/lol-coach'
        },
        {
            id: 'decatron-ai',
            name: 'Decatron AI',
            description: 'Inteligencia artificial para tu bot con respuestas contextuales',
            icon: <Cpu className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/decatron-ai',
            requiresControlTotal: true
        }
    ];

    const visibleCards = cards.filter(card =>
        !card.requiresControlTotal || hasMinimumLevel('control_total')
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Funciones</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        Configura las funciones de tu bot
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl">
                {visibleCards.map((card) => {
                    const kickUnverified = isKickSession && !card.kickVerified;

                    return (
                        <div
                            key={card.id}
                            className={`bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] hover:shadow-lg transition-all ${kickUnverified ? 'opacity-60' : ''}`}
                            title={kickUnverified ? 'Todavía no verificado para Kick — se habilita de a uno, card por card.' : undefined}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        {card.icon}
                                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            {card.name}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        {card.description}
                                    </p>
                                </div>
                                {kickUnverified && (
                                    <div className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                        Próximamente en Kick
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                {kickUnverified ? (
                                    <button
                                        disabled
                                        className="flex items-center gap-2 px-4 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] dark:text-[#94a3b8] font-semibold text-sm opacity-50 cursor-not-allowed"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Próximamente
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate(card.route)}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm"
                                    >
                                        <Settings className="w-4 h-4" />
                                        {card.buttonLabel ?? 'Configurar'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
