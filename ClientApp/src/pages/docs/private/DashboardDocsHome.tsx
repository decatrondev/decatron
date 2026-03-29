import {
    HelpCircle, Clock, Bell, Gift, Target, Volume2, DollarSign,
    Zap, Shield, Sparkles, Settings, Monitor, ArrowRight, Search,
    BookOpen, Video, MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function DashboardDocsHome() {
    const [searchQuery, setSearchQuery] = useState('');

    const quickLinks = [
        { icon: <Monitor />, label: 'Como agregar overlays a OBS', path: '/dashboard/docs/overlays' },
        { icon: <Clock />, label: 'Configurar el timer', path: '/dashboard/docs/features/timer' },
        { icon: <Bell />, label: 'Alertas de eventos', path: '/dashboard/docs/features/event-alerts' },
        { icon: <Gift />, label: 'Crear un sorteo', path: '/dashboard/docs/features/giveaway' },
    ];

    const featureGuides = [
        { icon: <Clock />, title: 'Timer', description: 'Temporizadores con overlay y alertas', path: '/dashboard/docs/features/timer', color: 'blue' },
        { icon: <Bell />, title: 'Alertas de Eventos', description: 'Follows, subs, bits, raids', path: '/dashboard/docs/features/event-alerts', color: 'red' },
        { icon: <Gift />, title: 'Sorteos', description: 'Sistema de giveaways', path: '/dashboard/docs/features/giveaway', color: 'pink' },
        { icon: <Target />, title: 'Metas', description: 'Goals de subs, bits, donaciones', path: '/dashboard/docs/features/goals', color: 'green' },
        { icon: <Volume2 />, title: 'Sound Alerts', description: 'Alertas de sonido con Channel Points', path: '/dashboard/docs/features/sound-alerts', color: 'orange' },
        { icon: <DollarSign />, title: 'Donaciones', description: 'Sistema de tips con PayPal', path: '/dashboard/docs/features/tips', color: 'green' },
        { icon: <MessageSquare />, title: 'Shoutouts', description: 'Promociones de canales', path: '/dashboard/docs/features/shoutout', color: 'purple' },
        { icon: <Shield />, title: 'Moderacion', description: 'Filtros y acciones automaticas', path: '/dashboard/docs/features/moderation', color: 'red' },
        { icon: <Sparkles />, title: 'Decatron AI', description: 'Inteligencia artificial', path: '/dashboard/docs/features/ai', color: 'purple' },
    ];

    const filteredGuides = featureGuides.filter(guide =>
        guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Header con busqueda */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <HelpCircle className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Centro de Ayuda
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Guias y documentacion para sacar el maximo provecho de Decatron
                        </p>
                    </div>
                </div>

                {/* Barra de busqueda */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                    <input
                        type="text"
                        placeholder="Buscar en la documentacion..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-[#f8fafc] dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                    />
                </div>
            </div>

            {/* Links rapidos */}
            <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#2563eb]" />
                    Guias populares
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quickLinks.map((link, index) => (
                        <Link
                            key={index}
                            to={link.path}
                            className="flex items-center gap-3 p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
                        >
                            <div className="w-10 h-10 bg-[#f8fafc] dark:bg-[#374151] rounded-lg flex items-center justify-center text-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white transition-colors">
                                {link.icon}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors">
                                {link.label}
                            </span>
                            <ArrowRight className="w-4 h-4 text-[#64748b] ml-auto group-hover:text-[#2563eb] transition-colors" />
                        </Link>
                    ))}
                </div>
            </div>

            {/* Guias de features */}
            <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#2563eb]" />
                    Guias de Features
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGuides.map((guide, index) => (
                        <FeatureGuideCard key={index} {...guide} />
                    ))}
                </div>
                {filteredGuides.length === 0 && (
                    <div className="text-center py-8 text-[#64748b]">
                        No se encontraron guias para "{searchQuery}"
                    </div>
                )}
            </div>

            {/* Overlays y Configuracion */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Overlays */}
                <Link
                    to="/dashboard/docs/overlays"
                    className="block p-6 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl text-white hover:shadow-lg transition-shadow"
                >
                    <Monitor className="w-10 h-10 mb-4" />
                    <h3 className="text-xl font-bold mb-2">Configurar Overlays en OBS</h3>
                    <p className="text-purple-100 mb-4">
                        Aprende a agregar todos los overlays de Decatron a tu stream.
                    </p>
                    <div className="flex items-center gap-2 font-bold">
                        Ver guia
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </Link>

                {/* Configuracion */}
                <Link
                    to="/dashboard/docs/settings"
                    className="block p-6 bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl text-white hover:shadow-lg transition-shadow"
                >
                    <Settings className="w-10 h-10 mb-4" />
                    <h3 className="text-xl font-bold mb-2">Configuracion del Bot</h3>
                    <p className="text-gray-300 mb-4">
                        Personaliza el comportamiento del bot y configura permisos.
                    </p>
                    <div className="flex items-center gap-2 font-bold">
                        Ver configuracion
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </Link>
            </div>

            {/* Comandos */}
            <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">
                    Documentacion de Comandos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <CommandLink to="/dashboard/docs/commands/default" title="Por Defecto" description="!game, !title, !so..." />
                    <CommandLink to="/dashboard/docs/commands/custom" title="Personalizados" description="Crea tus comandos" />
                    <CommandLink to="/dashboard/docs/commands/microcommands" title="Micro Comandos" description="Comandos rapidos" />
                    <CommandLink to="/dashboard/docs/commands/scripting" title="Scripts" description="Logica avanzada" />
                </div>
            </div>

            {/* Variables */}
            <Link
                to="/dashboard/docs/variables"
                className="block p-6 bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-[#2563eb]">
                            <code className="text-lg font-bold">{'{}'}</code>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors">
                                Variables del Sistema
                            </h3>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                {'{user}'}, {'{game}'}, {'{title}'} y mas variables dinamicas
                            </p>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-[#64748b] group-hover:text-[#2563eb] transition-colors" />
                </div>
            </Link>
        </div>
    );
}

interface FeatureGuideCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    path: string;
    color: string;
}

const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
};

function FeatureGuideCard({ icon, title, description, path, color }: FeatureGuideCardProps) {
    return (
        <Link
            to={path}
            className="block p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
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

interface CommandLinkProps {
    to: string;
    title: string;
    description: string;
}

function CommandLink({ to, title, description }: CommandLinkProps) {
    return (
        <Link
            to={to}
            className="block p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
        >
            <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors mb-1">
                {title}
            </h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </Link>
    );
}
