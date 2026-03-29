// GuideTab - Tutorial and introduction for Goals system

import React from 'react';
import { BookOpen, Target, Zap, BarChart3, Bell, Timer, MessageSquare } from 'lucide-react';

interface GuideTabProps {
    onNavigateToTab: (tab: string) => void;
}

export const GuideTab: React.FC<GuideTabProps> = ({ onNavigateToTab }) => {
    const features = [
        {
            icon: <Target className="w-6 h-6" />,
            title: 'Metas Flexibles',
            description: 'Crea metas de subs, bits, follows o combina múltiples fuentes en una sola meta.',
            tab: 'basic'
        },
        {
            icon: <Zap className="w-6 h-6" />,
            title: 'Fuentes Configurables',
            description: 'Define cuántos puntos vale cada sub, cada 100 bits, cada follow, etc.',
            tab: 'sources'
        },
        {
            icon: <BarChart3 className="w-6 h-6" />,
            title: 'Milestones',
            description: 'Agrega hitos dentro de cada meta con notificaciones y bonus especiales.',
            tab: 'milestones'
        },
        {
            icon: <Bell className="w-6 h-6" />,
            title: 'Notificaciones',
            description: 'Alertas visuales y sonoras cuando se alcanza un milestone o se completa una meta.',
            tab: 'notifications'
        },
        {
            icon: <Timer className="w-6 h-6" />,
            title: 'Integración con Timer',
            description: 'Conecta las metas con el Timer Extensible para agregar tiempo automáticamente.',
            tab: 'timer-integration'
        },
        {
            icon: <MessageSquare className="w-6 h-6" />,
            title: 'Comandos de Chat',
            description: 'Tus viewers pueden usar !meta para ver el progreso actual.',
            tab: 'commands'
        }
    ];

    const steps = [
        {
            number: 1,
            title: 'Crear una Meta',
            description: 'Ve a la pestaña "Básico" y crea tu primera meta. Elige el tipo (subs, bits, combinada) y el objetivo.',
            action: () => onNavigateToTab('basic')
        },
        {
            number: 2,
            title: 'Configurar Fuentes',
            description: 'Si usas metas combinadas, configura cuántos puntos vale cada tipo de evento.',
            action: () => onNavigateToTab('sources')
        },
        {
            number: 3,
            title: 'Personalizar Diseño',
            description: 'Ajusta colores, tamaños y animaciones para que el overlay combine con tu stream.',
            action: () => onNavigateToTab('design')
        },
        {
            number: 4,
            title: 'Agregar al OBS',
            description: 'Copia la URL del overlay y agrégala como fuente de navegador en OBS.',
            action: null
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                    <BookOpen className="w-8 h-8" />
                    <h2 className="text-2xl font-bold">Sistema de Metas</h2>
                </div>
                <p className="text-white/90">
                    Crea metas interactivas para tu stream. Muestra el progreso hacia objetivos de subs, bits,
                    follows o combínalos todos. Tus viewers verán en tiempo real cómo contribuyen a la meta.
                </p>
            </div>

            {/* Features Grid */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    ✨ Características
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {features.map((feature, index) => (
                        <button
                            key={index}
                            onClick={() => onNavigateToTab(feature.tab)}
                            className="flex items-start gap-4 p-4 rounded-xl bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-all text-left group"
                        >
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#667eea]/10 dark:bg-[#667eea]/20 flex items-center justify-center text-[#667eea] group-hover:scale-110 transition-transform">
                                {feature.icon}
                            </div>
                            <div>
                                <h4 className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                    {feature.title}
                                </h4>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    {feature.description}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Start Steps */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    🚀 Inicio Rápido
                </h3>
                <div className="space-y-4">
                    {steps.map((step) => (
                        <div
                            key={step.number}
                            className="flex items-start gap-4 p-4 rounded-xl bg-[#f8fafc] dark:bg-[#262626]"
                        >
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#667eea] text-white flex items-center justify-center font-bold text-lg">
                                {step.number}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                    {step.title}
                                </h4>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {step.description}
                                </p>
                            </div>
                            {step.action && (
                                <button
                                    onClick={step.action}
                                    className="flex-shrink-0 px-4 py-2 bg-[#667eea] hover:bg-[#5a6fd6] text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Ir →
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Differences from Twitch */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-6">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    🆚 ¿Por qué usar esto en lugar de Twitch Goals?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-red-500 mb-2">❌ Twitch Goals</h4>
                        <ul className="space-y-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
                            <li>• Solo UNA meta activa a la vez</li>
                            <li>• Solo un tipo por meta (subs O bits)</li>
                            <li>• Sin milestones intermedios</li>
                            <li>• Diseño fijo, no personalizable</li>
                            <li>• Sin integración con otros sistemas</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-green-500 mb-2">✅ Sistema de Metas</h4>
                        <ul className="space-y-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
                            <li>• Múltiples metas simultáneas</li>
                            <li>• Metas combinadas (subs + bits + más)</li>
                            <li>• Milestones con bonus y notificaciones</li>
                            <li>• 100% personalizable (colores, tamaños, animaciones)</li>
                            <li>• Integración con Timer Extensible</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 mb-3">
                    💡 Tips
                </h3>
                <ul className="space-y-2 text-sm text-blue-600 dark:text-blue-300">
                    <li>• Las metas se reinician automáticamente cuando termina el stream (configurable)</li>
                    <li>• Puedes tener varias metas activas, pero recomendamos máximo 3 para no saturar el overlay</li>
                    <li>• Los milestones son perfectos para dar recompensas intermedias y mantener la emoción</li>
                    <li>• Si activas la integración con el Timer, cada meta completada puede agregar tiempo automáticamente</li>
                </ul>
            </div>
        </div>
    );
};

export default GuideTab;
