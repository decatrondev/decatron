import {
    Zap, Clock, Gift, Bell, MessageSquare, Shield, Sparkles,
    Volume2, DollarSign, BarChart3, Users, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Features() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <h1 className="text-4xl font-black text-ds-text mb-4">
                    Todas las Features de Decatron
                </h1>
                <p className="text-xl text-ds-soft">
                    Explora todas las herramientas disponibles para potenciar tu stream.
                </p>
            </div>

            {/* Comandos */}
            <FeatureSection title="Sistema de Comandos">
                <FeatureCard
                    icon={<Zap className="w-6 h-6" />}
                    title="Comandos por Defecto"
                    description="Comandos listos para usar: !game, !title, !so, !followage y muchos mas. Configurables y con permisos personalizados."
                    link="/docs/commands/default"
                    color="blue"
                />
                <FeatureCard
                    icon={<MessageSquare className="w-6 h-6" />}
                    title="Comandos Personalizados"
                    description="Crea tus propios comandos con variables dinamicas. Usa {user}, {game}, {uptime} y mas para respuestas inteligentes."
                    link="/docs/commands/custom"
                    color="green"
                />
                <FeatureCard
                    icon={<Zap className="w-6 h-6" />}
                    title="Micro Comandos"
                    description="Atajos de chat para cambiar la categoría del stream. Escribes !apex y el stream pasa a Apex Legends."
                    link="/docs/commands/microcommands"
                    color="yellow"
                />
                <FeatureCard
                    icon={<Sparkles className="w-6 h-6" />}
                    title="Scripts Avanzados"
                    description="Crea comandos con logica condicional, bucles y variables. El sistema de scripting mas potente para bots de Twitch."
                    link="/docs/commands/scripting"
                    color="purple"
                />
            </FeatureSection>

            {/* Features principales */}
            <FeatureSection title="Features Principales">
                <FeatureCard
                    icon={<Clock className="w-6 h-6" />}
                    title="Timer / Countdown"
                    description="Temporizadores profesionales con overlay, barras de progreso, alertas de finalizacion y eventos automaticos."
                    link="/dashboard/docs/features/timer"
                    color="blue"
                    requiresAuth
                />
                <FeatureCard
                    icon={<Bell className="w-6 h-6" />}
                    title="Alertas de Eventos"
                    description="Notificaciones visuales y de audio para follows, subs, bits, raids y mas. Sistema de tiers y variantes."
                    link="/dashboard/docs/features/event-alerts"
                    color="red"
                    requiresAuth
                />
                <FeatureCard
                    icon={<Gift className="w-6 h-6" />}
                    title="Sorteos / Giveaways"
                    description="Sistema completo de sorteos con requisitos de participacion, sistema de peso para subs y historial."
                    link="/dashboard/docs/features/giveaway"
                    color="pink"
                    requiresAuth
                />
                <FeatureCard
                    icon={<Volume2 className="w-6 h-6" />}
                    title="Sound Alerts"
                    description="Conecta Channel Points de Twitch para reproducir alertas de sonido y video en tu stream."
                    link="/dashboard/docs/features/sound-alerts"
                    color="orange"
                    requiresAuth
                />
                <FeatureCard
                    icon={<DollarSign className="w-6 h-6" />}
                    title="Donaciones / Tips"
                    description="Recibe donaciones con PayPal. Pagina personalizable, alertas y integracion con el timer."
                    link="/dashboard/docs/features/tips"
                    color="green"
                    requiresAuth
                />
            </FeatureSection>

            {/* Herramientas */}
            <FeatureSection title="Herramientas">
                <FeatureCard
                    icon={<MessageSquare className="w-6 h-6" />}
                    title="Shoutouts"
                    description="Muestra informacion de otros canales con preview de su ultimo clip y estadisticas."
                    link="/docs/overlays/shoutout"
                    color="purple"
                />
                <FeatureCard
                    icon={<Shield className="w-6 h-6" />}
                    title="Moderacion"
                    description="Palabras prohibidas, enlaces, spam, modo panico y strikes en Twitch y Kick, con comandos para tus mods e historial con deshacer."
                    link="/docs/moderation"
                    color="red"
                />
                <FeatureCard
                    icon={<Sparkles className="w-6 h-6" />}
                    title="Decatron AI"
                    description="Inteligencia artificial para respuestas contextuales, moderacion inteligente y asistencia en vivo."
                    link="/dashboard/docs/features/ai"
                    color="purple"
                    requiresAuth
                />
                <FeatureCard
                    icon={<BarChart3 className="w-6 h-6" />}
                    title="Analiticas"
                    description="Dashboard de estadisticas, eventos del timer, historial de moderacion y datos de streams."
                    link="/dashboard/docs/features/analytics"
                    color="blue"
                    requiresAuth
                />
                <FeatureCard
                    icon={<Users className="w-6 h-6" />}
                    title="Seguidores"
                    description="Lista de seguidores recientes, busqueda y gestion de la comunidad."
                    link="/dashboard/docs/features/followers"
                    color="cyan"
                    requiresAuth
                />
            </FeatureSection>

            {/* CTA */}
            <div className="bg-ds-surface border border-ds-border rounded-lg p-8 text-ds-text text-center">
                <h2 className="text-2xl font-black mb-4">Listo para probar Decatron?</h2>
                <p className="text-ds-soft mb-6 max-w-xl mx-auto">
                    Conecta tu cuenta de Twitch y empieza a usar todas estas features en minutos.
                </p>
                <Link
                    to="/login"
                    className="ds-btn ds-btn--primary ds-btn--lg"
                >
                    Comenzar gratis
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
    );
}

interface FeatureSectionProps {
    title: string;
    children: React.ReactNode;
}

function FeatureSection({ title, children }: FeatureSectionProps) {
    return (
        <div>
            <h2 className="text-2xl font-black text-ds-text mb-6">{title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {children}
            </div>
        </div>
    );
}

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    link: string;
    color: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'pink' | 'orange' | 'cyan';
    requiresAuth?: boolean;
}

const colorClasses = {
    blue: 'bg-ds-raised text-ds-accent-text ',
    green: 'bg-ds-raised text-ds-accent-text',
    yellow: 'bg-ds-raised text-ds-accent-text ',
    purple: 'bg-ds-raised text-ds-accent-text ',
    red: 'bg-ds-raised text-ds-accent-text',
    pink: 'bg-ds-raised text-ds-accent-text ',
    orange: 'bg-ds-raised text-ds-accent-text ',
    cyan: 'bg-ds-raised text-ds-accent-text ',
};

function FeatureCard({ icon, title, description, link, color, requiresAuth }: FeatureCardProps) {
    return (
        <Link
            to={link}
            className="group block p-6 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-accent transition-all"
        >
            <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 ${colorClasses[color]} rounded-lg flex items-center justify-center`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-ds-text group-hover:text-ds-accent-text transition-colors">
                            {title}
                        </h3>
                        {requiresAuth && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-ds-bg text-ds-soft rounded">
                                Dashboard
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-ds-soft">{description}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 mt-4 text-ds-accent-text text-sm font-bold group-hover:gap-3 transition-all">
                Ver documentacion
                <ArrowRight className="w-4 h-4" />
            </div>
        </Link>
    );
}
