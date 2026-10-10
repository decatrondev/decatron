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
            icon: <Zap className="w-5 h-5 text-ds-warn" />,
            title: "Disparadores de Eventos",
            desc: "Ej: 'Si llegamos a 50 subs, activar Happy Hour automáticamente por 1 hora'."
        },
        {
            icon: <Gift className="w-5 h-5 text-ds-accent-text" />,
            title: "Desbloqueo de Recompensas",
            desc: "Ej: 'Al llegar a 10,000 bits, liberar un código de juego en el chat'."
        },
        {
            icon: <Target className="w-5 h-5 text-ds-accent-text" />,
            title: "Metas Comunitarias",
            desc: "Barra de progreso visual para metas conjuntas (Subathon, Donathon) integrada en el timer."
        }
    ];

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="bg-ds-surface rounded-lg p-8 text-center border border-ds-border relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-ds-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-ds-accent/50">
                        <Target className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <h2 className="text-2xl font-bold text-ds-text mb-2">
                        Sistema de Objetivos 2.0 en Construcción
                    </h2>
                    <p className="text-ds-soft max-w-2xl mx-auto">
                        Estamos reimaginando esta sección para convertir tu Timer en una herramienta de 
                        <span className="text-ds-accent-text font-bold"> Gamificación Avanzada</span>. 
                        Queremos que las metas no sean solo texto, sino acciones que transformen tu stream.
                    </p>
                </div>
            </div>

            {/* What's Coming */}
            <div>
                <h3 className="text-sm font-bold text-ds-soft uppercase tracking-wider mb-4 pl-2">
                    Lo que estamos planeando
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {plannedFeatures.map((feature, idx) => (
                        <div key={idx} className="bg-ds-surface p-5 rounded-lg border border-ds-border hover:border-ds-accent transition-colors group">
                            <div className="mb-3 p-2 bg-ds-surface rounded-lg w-fit group-hover:scale-110 transition-transform">
                                {feature.icon}
                            </div>
                            <h4 className="font-bold text-ds-text mb-2">
                                {feature.title}
                            </h4>
                            <p className="text-xs text-ds-soft leading-relaxed">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feedback Call to Action */}
            <div className="bg-ds-accent/10 rounded-lg border border-ds-accent p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="p-4 bg-ds-surface rounded-full">
                    <Lightbulb className="w-8 h-8 text-ds-warn" />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-lg font-bold text-ds-text mb-1">
                        ¡Tu opinión moldea el futuro de Decatron!
                    </h3>
                    <p className="text-sm text-ds-soft">
                        ¿Qué tipo de metas o automatizaciones te gustaría ver aquí? ¿Happy Hours automáticos? ¿Sorteos al cumplir metas? Cuéntanos tu idea.
                    </p>
                </div>
                <a 
                    href="https://discord.gg/HTpbDcgG7x"
                    target="_blank" 
                    rel="noreferrer"
                    className="px-6 py-3 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg font-bold transition-all hover:shadow-blue-500/25 flex items-center gap-2 whitespace-nowrap"
                >
                    <MessageSquarePlus className="w-5 h-5" />
                    Enviar Sugerencia
                </a>
            </div>
        </div>
    );
};

export default GoalTab;