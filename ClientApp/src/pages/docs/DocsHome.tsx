import { Book, ArrowRight, Variable, Zap, Code, Plug } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DocsHome() {
    return (
        <div className="space-y-8">
            {/* Header con estilo del sistema */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-10 border border-[#e2e8f0] dark:border-[#374151] shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl flex items-center justify-center border border-[#e2e8f0] dark:border-[#374151]">
                        <Book className="w-10 h-10 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black mb-2 text-gray-900 dark:text-white">Documentación de Decatron</h1>
                        <p className="text-xl text-[#64748b] dark:text-[#94a3b8]">
                            Tu guía completa para dominar el bot más potente de Twitch
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    <QuickStat icon={<Variable />} label="Variables" count="17+" />
                    <QuickStat icon={<Zap />} label="Comandos" count="50+" />
                    <QuickStat icon={<Code />} label="Scripts" count="∞" />
                    <QuickStat icon={<Plug />} label="APIs" count="10+" />
                </div>
            </div>

            {/* Main Sections */}
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Explora la Documentación</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DocSection
                    to="/docs/variables"
                    icon={<Variable className="w-8 h-8" />}
                    title="Variables del Sistema"
                    description="Variables dinámicas para crear comandos interactivos con información en tiempo real"
                    color="blue"
                />
                <DocSection
                    to="/docs/commands"
                    icon={<Zap className="w-8 h-8" />}
                    title="Comandos"
                    description="Guía completa sobre comandos por defecto, personalizados, y micro comandos"
                    color="yellow"
                    comingSoon
                />
                <DocSection
                    to="/docs/scripting"
                    icon={<Code className="w-8 h-8" />}
                    title="Scripting"
                    description="Crea comandos avanzados con lógica condicional usando nuestro lenguaje de scripting"
                    color="purple"
                    comingSoon
                />
                <DocSection
                    to="/docs/api"
                    icon={<Plug className="w-8 h-8" />}
                    title="API Reference"
                    description="Documentación completa de la API REST para integrar Decatron con tus aplicaciones"
                    color="green"
                    comingSoon
                />
                </div>
            </div>

            {/* Getting Started */}
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">🚀 Guía de Inicio Rápido</h2>
                <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Step
                        number={1}
                        title="Conecta tu cuenta"
                        description="Inicia sesión con Twitch"
                    />
                    <Step
                        number={2}
                        title="Explora las variables"
                        description="Crea comandos dinámicos"
                    />
                    <Step
                        number={3}
                        title="Primer comando"
                        description="Usa !crear para empezar"
                    />
                    <Step
                        number={4}
                        title="Experimenta"
                        description="Lleva tus comandos al siguiente nivel"
                    />
                </div>
                </div>
            </div>
        </div>
    );
}

interface DocSectionProps {
    to: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: 'blue' | 'yellow' | 'purple' | 'green';
    comingSoon?: boolean;
}

function DocSection({ to, icon, title, description, color, comingSoon }: DocSectionProps) {
    const colorClasses = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-[#2563eb] group-hover:bg-[#2563eb]',
        yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 group-hover:bg-yellow-600',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 group-hover:bg-green-600',
    };

    if (comingSoon) {
        return (
            <div className="relative p-8 bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] opacity-60 cursor-not-allowed">
                <div className={`inline-flex items-center justify-center w-16 h-16 ${colorClasses[color]} rounded-xl mb-4`}>
                    {icon}
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                    {title}
                </h3>
                <p className="text-[#64748b] dark:text-[#94a3b8]">{description}</p>
                <span className="absolute top-4 right-4 px-3 py-1 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                    Próximamente
                </span>
            </div>
        );
    }

    return (
        <Link
            to={to}
            className="group block p-8 bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] dark:hover:border-[#2563eb] transition-all hover:shadow-lg"
        >
            <div className={`inline-flex items-center justify-center w-16 h-16 ${colorClasses[color]} rounded-xl mb-4 transition-colors group-hover:text-white`}>
                {icon}
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 group-hover:text-[#2563eb] transition-colors">
                {title}
            </h3>
            <p className="text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            <div className="flex items-center gap-2 mt-4 text-[#2563eb] font-bold group-hover:gap-3 transition-all">
                Ver documentación
                <ArrowRight className="w-4 h-4" />
            </div>
        </Link>
    );
}

interface StepProps {
    number: number;
    title: string;
    description: string;
}

function Step({ number, title, description }: StepProps) {
    return (
        <div className="flex flex-col items-center text-center p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-lg mb-3">
                {number}
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">{description}</p>
        </div>
    );
}

// Componente para estadísticas rápidas en el header
interface QuickStatProps {
    icon: React.ReactNode;
    label: string;
    count: string;
}

function QuickStat({ icon, label, count }: QuickStatProps) {
    return (
        <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-xl p-4 text-center border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-all">
            <div className="flex items-center justify-center mb-2 text-[#2563eb]">
                {icon}
            </div>
            <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{count}</div>
            <div className="text-sm text-[#64748b] dark:text-[#94a3b8] font-semibold">{label}</div>
        </div>
    );
}