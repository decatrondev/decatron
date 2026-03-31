import { Heart, MessageSquare, Clock, Settings, ArrowRight, Users, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function FollowAlertsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-pink-50 dark:bg-pink-900/20 rounded-2xl flex items-center justify-center">
                        <Heart className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Alertas de Follow
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Mensajes automaticos en el chat cuando alguien te sigue
                        </p>
                    </div>
                </div>
                <Link
                    to="/features/follow-alerts"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Que es */}
            <DocSection title="Que son las alertas de follow?">
                <p>
                    Las alertas de follow envian un mensaje automatico en el chat de Twitch cada vez que
                    alguien nuevo te sigue. Es una forma de dar la bienvenida a nuevos seguidores
                    y hacer que se sientan parte de la comunidad.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FeatureCard
                        icon={<MessageSquare className="w-5 h-5" />}
                        title="Mensaje en chat"
                        description="Saludo automatico para nuevos followers"
                    />
                    <FeatureCard
                        icon={<Clock className="w-5 h-5" />}
                        title="Cooldown"
                        description="Control de frecuencia de mensajes"
                    />
                    <FeatureCard
                        icon={<Settings className="w-5 h-5" />}
                        title="Personalizable"
                        description="Mensaje y configuracion a tu gusto"
                    />
                </div>
            </DocSection>

            {/* Configuracion */}
            <DocSection title="Configuracion">
                <div className="space-y-4">
                    <ConfigItem
                        title="Activar / Desactivar"
                        description="Enciende o apaga las alertas de follow desde el switch principal."
                    />
                    <ConfigItem
                        title="Mensaje personalizado"
                        description="Escribe el mensaje que se enviara en el chat. Usa @{username} para incluir el nombre del nuevo follower."
                    />
                    <ConfigItem
                        title="Cooldown"
                        description="Tiempo minimo entre mensajes de follow (en minutos). Evita spam cuando hay muchos follows seguidos."
                    />
                </div>

                <div className="mt-4 p-4 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">Ejemplo de mensaje</h4>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-lg p-3 border border-[#e2e8f0] dark:border-[#374151]">
                        <code className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Gracias @{'{username}'} por el follow!
                        </code>
                    </div>
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                        Resultado: "Gracias @NuevoViewer por el follow!"
                    </p>
                </div>
            </DocSection>

            {/* Estadisticas */}
            <DocSection title="Estadisticas">
                <p className="mb-4">
                    La pagina de configuracion muestra estadisticas en tiempo real:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        icon={<Heart className="w-5 h-5" />}
                        title="Follows hoy"
                        description="Cantidad de nuevos seguidores del dia"
                    />
                    <StatCard
                        icon={<Users className="w-5 h-5" />}
                        title="Total follows"
                        description="Numero total de seguidores"
                    />
                    <StatCard
                        icon={<TrendingUp className="w-5 h-5" />}
                        title="Mensajes enviados"
                        description="Alertas de follow enviadas"
                    />
                </div>
            </DocSection>

            {/* Tips */}
            <DocSection title="Consejos">
                <DocAlert type="tip" title="Cooldown recomendado">
                    Un cooldown de 60 minutos es ideal para evitar spam sin perder la interaccion.
                    Si tienes muchos follows, puedes subirlo a 120 minutos.
                </DocAlert>
                <DocAlert type="info" title="Diferencia con Event Alerts">
                    Las alertas de follow envian un mensaje en el chat. Las Event Alerts muestran
                    una alerta visual en el overlay del stream. Puedes usar ambas al mismo tiempo.
                </DocAlert>
            </DocSection>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-pink-50 dark:bg-pink-900/20 rounded-lg flex items-center justify-center text-pink-600 dark:text-pink-400 mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

function ConfigItem({ title, description }: { title: string; description: string }) {
    return (
        <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

function StatCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl">
            <div className="w-8 h-8 bg-pink-50 dark:bg-pink-900/20 rounded-lg flex items-center justify-center text-pink-600 dark:text-pink-400 mb-2">
                {icon}
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h4>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}
