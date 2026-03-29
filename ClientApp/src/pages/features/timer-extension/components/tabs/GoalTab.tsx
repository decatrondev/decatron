/**
 * Timer Extension - GoalTab Component (Concept / Feedback)
 *
 * Pestaña de Objetivos 2.0: Sistema de Metas Dinámicas y Gamificación.
 * Actualmente en fase de diseño, solicitando feedback de usuarios.
 */

import { Target, Lightbulb, MessageSquarePlus, Zap, Gift } from 'lucide-react';

interface GoalTabProps {
    // Props no utilizadas por ahora en esta versión conceptual
    goalConfig: any;
    onGoalConfigChange: (updates: any) => void;
}

export const GoalTab: React.FC<GoalTabProps> = () => {
    const plannedFeatures = [
        {
            icon: <Zap className="w-5 h-5 text-yellow-500" />,
            title: "Disparadores de Eventos",
            desc: "Ej: 'Si llegamos a 50 subs, activar Happy Hour automáticamente por 1 hora'."
        },
        {
            icon: <Gift className="w-5 h-5 text-pink-500" />,
            title: "Desbloqueo de Recompensas",
            desc: "Ej: 'Al llegar a 10,000 bits, liberar un código de juego en el chat'."
        },
        {
            icon: <Target className="w-5 h-5 text-blue-500" />,
            title: "Metas Comunitarias",
            desc: "Barra de progreso visual para metas conjuntas (Subathon, Donathon) integrada en el timer."
        }
    ];

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl p-8 text-center border border-[#334155] shadow-xl relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50">
                        <Target className="w-8 h-8 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Sistema de Objetivos 2.0 en Construcción
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Estamos reimaginando esta sección para convertir tu Timer en una herramienta de 
                        <span className="text-blue-400 font-bold"> Gamificación Avanzada</span>. 
                        Queremos que las metas no sean solo texto, sino acciones que transformen tu stream.
                    </p>
                </div>
            </div>

            {/* What's Coming */}
            <div>
                <h3 className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-4 pl-2">
                    Lo que estamos planeando
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {plannedFeatures.map((feature, idx) => (
                        <div key={idx} className="bg-white dark:bg-[#1B1C1D] p-5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
                            <div className="mb-3 p-2 bg-gray-50 dark:bg-[#262626] rounded-lg w-fit group-hover:scale-110 transition-transform">
                                {feature.icon}
                            </div>
                            <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                {feature.title}
                            </h4>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feedback Call to Action */}
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30 p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-full shadow-sm">
                    <Lightbulb className="w-8 h-8 text-yellow-500" />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">
                        ¡Tu opinión moldea el futuro de Decatron!
                    </h3>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        ¿Qué tipo de metas o automatizaciones te gustaría ver aquí? ¿Happy Hours automáticos? ¿Sorteos al cumplir metas? Cuéntanos tu idea.
                    </p>
                </div>
                <a 
                    href="https://discord.gg/HTpbDcgG7x"
                    target="_blank" 
                    rel="noreferrer"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-2 whitespace-nowrap"
                >
                    <MessageSquarePlus className="w-5 h-5" />
                    Enviar Sugerencia
                </a>
            </div>
        </div>
    );
};

export default GoalTab;