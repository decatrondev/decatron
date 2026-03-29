import { Bot, Zap, Clock, Gift, Target, Bell, MessageSquare, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-[#2563eb] to-blue-700 rounded-2xl p-10 text-white">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Bot className="w-12 h-12" />
                    </div>
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black mb-2">Decatron</h1>
                        <p className="text-xl text-blue-100">
                            El bot de Twitch mas completo para streamers
                        </p>
                    </div>
                </div>
                <p className="text-lg text-blue-100 max-w-3xl">
                    Decatron es una plataforma todo-en-uno que te permite gestionar comandos, overlays,
                    alertas, sorteos, metas y mucho mas. Diseñado por streamers, para streamers.
                </p>
                <div className="flex flex-wrap gap-4 mt-8">
                    <Link
                        to="/docs/getting-started"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#2563eb] font-bold rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        Comenzar ahora
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link
                        to="/docs/features"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30 transition-colors"
                    >
                        Ver todas las features
                    </Link>
                </div>
            </div>

            {/* Para quien es */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                    Para quien es Decatron?
                </h2>
                <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                    Decatron esta diseñado para streamers de Twitch que buscan:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TargetAudience
                        title="Streamers principiantes"
                        description="Interfaz intuitiva y comandos listos para usar desde el primer dia"
                    />
                    <TargetAudience
                        title="Streamers avanzados"
                        description="Sistema de scripting potente para crear comandos complejos"
                    />
                    <TargetAudience
                        title="Creadores de contenido"
                        description="Overlays personalizables y alertas profesionales"
                    />
                    <TargetAudience
                        title="Comunidades activas"
                        description="Sorteos, metas y herramientas de engagement"
                    />
                </div>
            </div>

            {/* Principales caracteristicas */}
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">
                    Principales caracteristicas
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={<Zap className="w-6 h-6" />}
                        title="Comandos inteligentes"
                        description="Variables dinamicas, scripting avanzado y micro comandos para automatizar tu chat"
                    />
                    <FeatureCard
                        icon={<Clock className="w-6 h-6" />}
                        title="Timer profesional"
                        description="Temporizadores con overlay, alertas, barras de progreso y eventos automaticos"
                    />
                    <FeatureCard
                        icon={<Gift className="w-6 h-6" />}
                        title="Sorteos y Giveaways"
                        description="Sistema completo de sorteos con requisitos, pesos y historial"
                    />
                    <FeatureCard
                        icon={<Target className="w-6 h-6" />}
                        title="Metas interactivas"
                        description="Crea metas de subs, bits o donaciones con overlay en tiempo real"
                    />
                    <FeatureCard
                        icon={<Bell className="w-6 h-6" />}
                        title="Alertas de eventos"
                        description="Notificaciones personalizadas para follows, subs, raids, bits y mas"
                    />
                    <FeatureCard
                        icon={<MessageSquare className="w-6 h-6" />}
                        title="Shoutouts automaticos"
                        description="Muestra informacion de canales con clip preview y estadisticas"
                    />
                    <FeatureCard
                        icon={<Shield className="w-6 h-6" />}
                        title="Moderacion inteligente"
                        description="Filtros de palabras, sistema de strikes y acciones automaticas"
                    />
                    <FeatureCard
                        icon={<Sparkles className="w-6 h-6" />}
                        title="Decatron AI"
                        description="Inteligencia artificial para respuestas contextuales y moderacion"
                    />
                </div>
            </div>

            {/* CTA Final */}
            <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] text-center">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                    Listo para empezar?
                </h2>
                <p className="text-[#64748b] dark:text-[#94a3b8] mb-6 max-w-xl mx-auto">
                    Conecta tu cuenta de Twitch y comienza a usar Decatron en minutos.
                    Es gratis y no requiere tarjeta de credito.
                </p>
                <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Conectar con Twitch
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
    );
}

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-[#2563eb] mb-4">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

interface TargetAudienceProps {
    title: string;
    description: string;
}

function TargetAudience({ title, description }: TargetAudienceProps) {
    return (
        <div className="flex items-start gap-3 p-4 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-2 h-2 bg-[#2563eb] rounded-full mt-2 flex-shrink-0" />
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
        </div>
    );
}
