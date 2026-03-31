import {
    Book, ArrowRight, Variable, Zap, Code, Plug, HelpCircle,
    Rocket, Grid, MessageSquare, Monitor, Clock, Gift, Target,
    Bell, Shield, Sparkles, Volume2, DollarSign
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DocsHome() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <Book className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Documentacion de Decatron
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Tu guia completa para dominar el bot mas potente de Twitch
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <QuickStat icon={<Variable />} label="Variables" count="17+" />
                    <QuickStat icon={<Zap />} label="Comandos" count="50+" />
                    <QuickStat icon={<Code />} label="Scripts" count="∞" />
                    <QuickStat icon={<Plug />} label="APIs" count="10+" />
                </div>
            </div>

            {/* Para empezar */}
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Para empezar</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DocCard to="/docs/about" icon={<HelpCircle />} title="Que es Decatron?" description="Conoce todas las capacidades del bot" color="blue" />
                    <DocCard to="/docs/getting-started" icon={<Rocket />} title="Como Empezar" description="Guia paso a paso para configurar tu bot" color="green" />
                    <DocCard to="/docs/faq" icon={<MessageSquare />} title="FAQ" description="Preguntas frecuentes y soluciones" color="purple" />
                </div>
            </div>

            {/* Comandos */}
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Comandos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DocCard to="/docs/commands/default" icon={<Zap />} title="Comandos por Defecto" description="!game, !title, !so, !followage y mas" color="blue" />
                    <DocCard to="/docs/commands/custom" icon={<MessageSquare />} title="Comandos Personalizados" description="Crea tus propios comandos con variables" color="green" />
                    <DocCard to="/docs/commands/microcommands" icon={<Zap />} title="Micro Comandos" description="Contadores y comandos rapidos" color="yellow" />
                    <DocCard to="/docs/commands/scripting" icon={<Code />} title="Scripts Avanzados" description="Logica condicional y variables" color="purple" />
                </div>
            </div>

            {/* Features */}
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Features</h2>
                <p className="text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Guias detalladas de cada feature disponibles en el dashboard.
                </p>
                <Link
                    to="/docs/features"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Grid className="w-4 h-4" />
                    Ver todas las features
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Referencia */}
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Referencia</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DocCard to="/docs/variables" icon={<Variable />} title="Variables" description="17+ variables dinamicas para comandos" color="blue" />
                    <DocCard to="/docs/overlays/shoutout" icon={<Monitor />} title="Shoutout Overlay" description="Overlay de promocion de canales" color="purple" />
                    <DocCard to="/docs/api" icon={<Plug />} title="API Reference" description="REST API con OAuth2 para integraciones" color="green" />
                </div>
            </div>

            {/* Guia rapida */}
            <div className="bg-[#f8fafc] dark:bg-[#374151]/30 rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Inicio Rapido</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Step number={1} title="Conecta tu cuenta" description="Inicia sesion con Twitch" />
                    <Step number={2} title="Configura el bot" description="Prefijo, idioma, permisos" />
                    <Step number={3} title="Prueba un comando" description="Escribe !hola en el chat" />
                    <Step number={4} title="Agrega overlays" description="Timer, alertas y mas" />
                </div>
            </div>
        </div>
    );
}

function DocCard({ to, icon, title, description, color }: { to: string; icon: React.ReactNode; title: string; description: string; color: string }) {
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
        yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    };

    return (
        <Link
            to={to}
            className="group block p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-all"
        >
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${colorMap[color]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {icon}
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors">
                        {title}
                    </h3>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
                </div>
            </div>
        </Link>
    );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
    return (
        <div className="flex flex-col items-center text-center p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-8 h-8 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-sm mb-2">
                {number}
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{title}</h4>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

function QuickStat({ icon, label, count }: { icon: React.ReactNode; label: string; count: string }) {
    return (
        <div className="bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl p-4 text-center border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center justify-center mb-2 text-[#2563eb]">{icon}</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{count}</div>
            <div className="text-xs text-[#64748b] dark:text-[#94a3b8] font-semibold">{label}</div>
        </div>
    );
}
