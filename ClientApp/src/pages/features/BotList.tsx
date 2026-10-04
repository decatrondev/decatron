import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BotListManager from '../../components/bot-list/BotListManager';

export default function BotList() {
    const navigate = useNavigate();

    return (
        <div className="panel-scale bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <button
                        onClick={() => navigate('/moderation')}
                        className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#3b82f6] mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver a Moderación
                    </button>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Lista de bots</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                        Los bots de otros servicios (Nightbot, StreamElements…) escriben en tu chat como si fueran personas.
                        Aquí decides qué hace Decatron con sus mensajes.
                    </p>
                </div>
                <BotListManager />
            </div>
        </div>
    );
}
