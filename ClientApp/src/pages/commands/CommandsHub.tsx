import { Zap, MessageSquare, Code, Terminal, Settings, Clock, Globe, Crosshair } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommandCard {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    route: string;
}

export default function CommandsHub() {
    const navigate = useNavigate();

    const cards: CommandCard[] = [
        {
            id: 'default',
            name: 'Default Commands',
            description: 'Comandos integrados del bot listos para usar',
            icon: <Zap className="w-6 h-6 text-ds-accent-text" />,
            route: '/commands/default'
        },
        {
            id: 'microcommands',
            name: 'Microcommands',
            description: 'Comandos rapidos y sencillos para respuestas automaticas',
            icon: <MessageSquare className="w-6 h-6 text-ds-accent-text" />,
            route: '/commands/microcommands'
        },
        {
            id: 'custom',
            name: 'Custom Commands',
            description: 'Crea comandos personalizados con variables y logica avanzada',
            icon: <Code className="w-6 h-6 text-ds-accent-text" />,
            route: '/commands/custom'
        },
        {
            id: 'scripting',
            name: 'Scripting',
            description: 'Scripts con condicionales para respuestas dinamicas',
            icon: <Terminal className="w-6 h-6 text-ds-accent-text" />,
            route: '/commands/scripting'
        },
        {
            id: 'watchtime',
            name: 'Watchtime',
            description: 'Muestra cuánto tiempo lleva un viewer viendo el stream actual',
            icon: <Clock className="w-6 h-6 text-ds-accent-text" />,
            route: '/commands/watchtime'
        },
        {
            id: 'ruleta',
            name: 'Ruleta',
            description: 'Ruleta rusa con timeout — probabilidad, duración y mensajes configurables',
            icon: <Crosshair className="w-6 h-6 text-ds-accent-text" />,
            route: '/commands/ruleta'
        },
        {
            id: 'public',
            name: 'Vista Pública',
            description: 'Elige qué comandos ve la gente en tu página pública de comandos',
            icon: <Globe className="w-6 h-6 text-ds-accent-text" />,
            route: '/commands/public'
        }
    ];

    return (
        <div className="panel-scale space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-ds-text">Comandos</h1>
                    <p className="text-ds-soft mt-2">
                        Gestiona los comandos de tu bot
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl">
                {cards.map((card) => (
                    <div
                        key={card.id}
                        className="bg-ds-surface rounded-lg p-6 border border-ds-border transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    {card.icon}
                                    <h3 className="text-xl font-black text-ds-text">
                                        {card.name}
                                    </h3>
                                </div>
                                <p className="text-sm text-ds-soft">
                                    {card.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end pt-4 border-t border-ds-border">
                            <button
                                onClick={() => navigate(card.route)}
                                className="flex items-center gap-2 px-4 py-2 bg-ds-accent hover:bg-ds-accent-hover text-white rounded-lg transition-all font-semibold text-sm"
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
