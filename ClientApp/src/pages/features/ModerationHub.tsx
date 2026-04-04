import { ShieldBan, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ModerationCard {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    route: string;
}

export default function ModerationHub() {
    const navigate = useNavigate();

    const cards: ModerationCard[] = [
        {
            id: 'banned-words',
            name: 'Banned Words',
            description: 'Gestiona las palabras y frases prohibidas en el chat',
            icon: <ShieldBan className="w-6 h-6 text-[#2563eb]" />,
            route: '/features/moderation/banned-words'
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Moderacion</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        Herramientas de moderacion del chat
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cards.map((card) => (
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
