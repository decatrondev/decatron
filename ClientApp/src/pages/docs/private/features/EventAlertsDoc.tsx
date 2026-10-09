import { Bell, Zap, Users, Gift, Star, Volume2, Layers, Settings, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function EventAlertsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Bell className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Alertas de Eventos
                        </h1>
                        <p className="text-ds-soft">
                            Notificaciones visuales y de audio para eventos de Twitch
                        </p>
                    </div>
                </div>
                <Link
                    to="/overlays/event-alerts"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Eventos soportados */}
            <DocSection title="Eventos soportados">
                <p className="mb-4">
                    Decatron puede mostrar alertas para los siguientes eventos de Twitch:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <EventCard
                        icon={<Users className="w-5 h-5" />}
                        title="Follows"
                        description="Cuando alguien sigue tu canal"
                        color="blue"
                    />
                    <EventCard
                        icon={<Star className="w-5 h-5" />}
                        title="Subscripciones"
                        description="Nuevos subs, resubs, gift subs"
                        color="purple"
                    />
                    <EventCard
                        icon={<Zap className="w-5 h-5" />}
                        title="Bits / Cheers"
                        description="Cuando alguien usa bits"
                        color="yellow"
                    />
                    <EventCard
                        icon={<Users className="w-5 h-5" />}
                        title="Raids"
                        description="Cuando otro canal te hace raid"
                        color="red"
                    />
                    <EventCard
                        icon={<Gift className="w-5 h-5" />}
                        title="Gift Subs"
                        description="Subs regalados a la comunidad"
                        color="pink"
                    />
                    <EventCard
                        icon={<Star className="w-5 h-5" />}
                        title="Hype Train"
                        description="Progreso del hype train"
                        color="orange"
                    />
                </div>
            </DocSection>

            {/* Configurar alertas */}
            <DocSection title="Configurar alertas">
                <p className="mb-4">
                    Para cada tipo de evento puedes configurar:
                </p>
                <ul className="space-y-3 mb-4">
                    <li className="flex items-start gap-3 text-ds-soft">
                        <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                        <span><strong>Mensaje:</strong> El texto que se mostrara en la alerta. Usa variables como {'{user}'} y {'{amount}'}.</span>
                    </li>
                    <li className="flex items-start gap-3 text-ds-soft">
                        <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                        <span><strong>Duracion:</strong> Cuanto tiempo se mostrara la alerta (2-30 segundos).</span>
                    </li>
                    <li className="flex items-start gap-3 text-ds-soft">
                        <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                        <span><strong>Sonido:</strong> Audio que se reproducira cuando llegue la alerta.</span>
                    </li>
                    <li className="flex items-start gap-3 text-ds-soft">
                        <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                        <span><strong>Imagen/Video:</strong> Media visual para acompañar la alerta.</span>
                    </li>
                    <li className="flex items-start gap-3 text-ds-soft">
                        <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                        <span><strong>Animacion:</strong> Como entra y sale la alerta de pantalla.</span>
                    </li>
                </ul>
            </DocSection>

            {/* Sistema de tiers */}
            <DocSection title="Sistema de tiers">
                <p className="mb-4">
                    Para eventos con montos (bits, subs, donaciones), puedes crear diferentes alertas
                    segun la cantidad:
                </p>
                <div className="space-y-3">
                    <TierExample
                        tier="Tier 1"
                        range="1 - 99 bits"
                        description="Alerta basica con sonido simple"
                    />
                    <TierExample
                        tier="Tier 2"
                        range="100 - 499 bits"
                        description="Alerta con animacion especial"
                    />
                    <TierExample
                        tier="Tier 3"
                        range="500 - 999 bits"
                        description="Alerta con video personalizado"
                    />
                    <TierExample
                        tier="Tier 4"
                        range="1000+ bits"
                        description="Alerta premium con efectos especiales"
                    />
                </div>
                <DocAlert type="tip" title="Consejo">
                    Crea alertas mas elaboradas para donaciones mas grandes. Esto incentiva
                    a la comunidad a contribuir mas.
                </DocAlert>
            </DocSection>

            {/* Sistema de variantes */}
            <DocSection title="Sistema de variantes">
                <p className="mb-4">
                    Las variantes te permiten tener multiples versiones de una alerta que se
                    reproducen de forma aleatoria o secuencial:
                </p>
                <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
                    <h4 className="font-bold text-ds-text mb-3">Ejemplo: Alertas de follow</h4>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2 bg-ds-bg rounded-lg">
                            <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            <span className="text-sm text-ds-soft">Bienvenido {'{user}'}!</span>
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-ds-bg rounded-lg">
                            <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            <span className="text-sm text-ds-soft">{'{user}'} se unio a la familia!</span>
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-ds-bg rounded-lg">
                            <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                            <span className="text-sm text-ds-soft">Gracias por el follow, {'{user}'}!</span>
                        </div>
                    </div>
                </div>
            </DocSection>

            {/* Variables disponibles */}
            <DocSection title="Variables disponibles">
                <p className="mb-4">
                    Usa estas variables en tus mensajes de alerta:
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-ds-bg border-b border-ds-border">
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Variable</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Descripcion</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Ejemplo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ds-border">
                            <tr>
                                <td className="px-4 py-3"><code className="text-ds-accent-text">{'{user}'}</code></td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Nombre del usuario</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">StreamerPro</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3"><code className="text-ds-accent-text">{'{amount}'}</code></td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Cantidad (bits, meses, etc.)</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">500</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3"><code className="text-ds-accent-text">{'{message}'}</code></td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Mensaje del usuario</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Gran stream!</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3"><code className="text-ds-accent-text">{'{tier}'}</code></td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Tier de la sub (1, 2, 3)</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">1</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3"><code className="text-ds-accent-text">{'{months}'}</code></td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Meses de sub consecutivos</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">12</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Cola de alertas */}
            <DocSection title="Cola de alertas">
                <p className="mb-4">
                    Cuando llegan multiples alertas al mismo tiempo, se agregan a una cola y se
                    reproducen una por una. Puedes configurar:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Delay entre alertas:</strong> Tiempo de espera entre una alerta y la siguiente
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Prioridad:</strong> Algunos eventos pueden saltar la cola
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Limite de cola:</strong> Maximo de alertas pendientes
                    </li>
                </ul>
                <DocAlert type="info">
                    Las alertas de bits grandes y raids suelen tener prioridad alta por defecto.
                </DocAlert>
            </DocSection>

            {/* TTS */}
            <DocSection title="Text-to-Speech (TTS)">
                <p className="mb-4">
                    Activa TTS para que las alertas lean el mensaje en voz alta:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Multiples voces disponibles (masculina, femenina, neutral)
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Control de velocidad y volumen
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Filtro de palabras prohibidas
                    </li>
                </ul>
                <DocAlert type="warning" title="Moderacion">
                    Asegurate de tener configurado el filtro de palabras para evitar que TTS
                    lea contenido inapropiado.
                </DocAlert>
            </DocSection>
        </div>
    );
}

interface EventCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
}

const colorMap: Record<string, string> = {
    blue: 'bg-ds-raised text-ds-accent-text ',
    purple: 'bg-ds-raised text-ds-accent-text ',
    yellow: 'bg-ds-raised text-ds-accent-text ',
    red: 'bg-ds-raised text-ds-accent-text',
    pink: 'bg-ds-raised text-ds-accent-text ',
    orange: 'bg-ds-raised text-ds-accent-text ',
};

function EventCard({ icon, title, description, color }: EventCardProps) {
    return (
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className={`w-10 h-10 ${colorMap[color]} rounded-lg flex items-center justify-center mb-3`}>
                {icon}
            </div>
            <h4 className="font-bold text-ds-text mb-1">{title}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}

interface TierExampleProps {
    tier: string;
    range: string;
    description: string;
}

function TierExample({ tier, range, description }: TierExampleProps) {
    return (
        <div className="flex items-center gap-4 bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="w-12 h-12 bg-ds-accent text-white rounded-lg flex items-center justify-center font-bold text-sm">
                {tier}
            </div>
            <div className="flex-1">
                <div className="font-bold text-ds-text">{range}</div>
                <div className="text-sm text-ds-soft">{description}</div>
            </div>
        </div>
    );
}
