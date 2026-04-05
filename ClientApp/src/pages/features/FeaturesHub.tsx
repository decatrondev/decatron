import { Clock, Gift, Volume2, Bell, MessageSquare, DollarSign, Cpu, Settings, Dices } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';

interface FeatureCard {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    route: string;
    requiresControlTotal?: boolean;
}

export default function FeaturesHub() {
    const navigate = useNavigate();
    const { hasMinimumLevel } = usePermissions();

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
            route: '/features/sound-alerts'
        },
        {
            id: 'follow-alerts',
            name: 'Follow Alerts',
            description: 'Notificaciones personalizadas cuando alguien te sigue',
            icon: <Bell className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/follow-alerts'
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
            id: 'gacha',
            name: 'Gacha System',
            description: 'Sistema de cartas coleccionables con donaciones y probabilidades',
            icon: <Dices className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/gacha'
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visibleCards.map((card) => (
                    <div
                        key={card.id}
                        className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] hover:shadow-lg transition-all"
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
                        </div>

                        <div className="flex items-center justify-end pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                            <button
                                onClick={() => navigate(card.route)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm"
                            >
                                <Settings className="w-4 h-4" />
                                Configurar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
