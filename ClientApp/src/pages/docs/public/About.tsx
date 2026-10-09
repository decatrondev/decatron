import { Bot, Zap, Clock, Gift, Target, Bell, MessageSquare, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="bg-ds-surface border border-ds-border rounded-lg p-10 text-ds-text">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-ds-bg border border-ds-border text-ds-accent-text rounded-lg flex items-center justify-center">
                        <Bot className="w-12 h-12" />
                    </div>
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black mb-2">Decatron</h1>
                        <p className="text-xl text-ds-soft">
                            El bot de Twitch mas completo para streamers
                        </p>
                    </div>
                </div>
                <p className="text-lg text-ds-soft max-w-3xl">
                    Decatron es una plataforma todo-en-uno que te permite gestionar comandos, overlays,
                    alertas, sorteos, metas y mucho mas. Diseñado por streamers, para streamers.
                </p>
                <div className="flex flex-wrap gap-4 mt-8">
                    <Link
                        to="/docs/getting-started"
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        Comenzar ahora
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link
                        to="/docs/features"
                        className="ds-btn ds-btn--secondary ds-btn--lg"
                    >
                        Ver todas las features
                    </Link>
                </div>
            </div>

            {/* Para quien es */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <h2 className="text-2xl font-black text-ds-text mb-4">
                    Para quien es Decatron?
                </h2>
                <p className="text-ds-soft mb-6">
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
                <h2 className="text-2xl font-black text-ds-text mb-6">
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
            <div className="bg-ds-bg rounded-lg p-8 border border-ds-border text-center">
                <h2 className="text-2xl font-black text-ds-text mb-4">
                    Listo para empezar?
                </h2>
                <p className="text-ds-soft mb-6 max-w-xl mx-auto">
                    Conecta tu cuenta de Twitch y comienza a usar Decatron en minutos.
                    Es gratis y no requiere tarjeta de credito.
                </p>
                <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
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
        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
            <div className="w-12 h-12 bg-ds-raised rounded-lg flex items-center justify-center text-ds-accent-text mb-4">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-ds-text mb-2">{title}</h3>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}

interface TargetAudienceProps {
    title: string;
    description: string;
}

function TargetAudience({ title, description }: TargetAudienceProps) {
    return (
        <div className="flex items-start gap-3 p-4 bg-ds-bg rounded-lg border border-ds-border">
            <div className="w-2 h-2 bg-ds-accent rounded-full mt-2 flex-shrink-0" />
            <div>
                <h4 className="font-bold text-ds-text">{title}</h4>
                <p className="text-sm text-ds-soft">{description}</p>
            </div>
        </div>
    );
}
