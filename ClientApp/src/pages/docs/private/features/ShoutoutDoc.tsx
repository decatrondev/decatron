import { MessageSquare, Users, Video, Settings, ArrowRight, Monitor, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function ShoutoutDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Shoutouts
                        </h1>
                        <p className="text-ds-soft">
                            Promociona otros canales con estilo
                        </p>
                    </div>
                </div>
                <Link
                    to="/overlays/shoutout"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Como funciona */}
            <DocSection title="Como funciona">
                <p className="mb-4">
                    El sistema de shoutouts te permite promocionar otros canales de Twitch con
                    un overlay profesional que muestra informacion del canal y su ultimo clip.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FeatureCard
                        icon={<Users className="w-5 h-5" />}
                        title="Info del canal"
                        description="Nombre, avatar, categoria actual"
                    />
                    <FeatureCard
                        icon={<Video className="w-5 h-5" />}
                        title="Ultimo clip"
                        description="Preview automatico del clip"
                    />
                    <FeatureCard
                        icon={<Zap className="w-5 h-5" />}
                        title="Automatico"
                        description="Se activa con !so o raids"
                    />
                </div>
            </DocSection>

            {/* Comando !so */}
            <DocSection title="Comando !so">
                <p className="mb-4">
                    Usa el comando <code className="text-ds-accent-text">!so</code> para hacer shoutout a otro canal:
                </p>
                <div className="bg-ds-surface rounded-lg p-4 border border-ds-border mb-4">
                    <div className="mb-2">
                        <span className="text-sm text-ds-soft">Uso:</span>
                    </div>
                    <code className="text-ds-accent-text font-mono">!so @NombreDelCanal</code>
                    <p className="text-sm text-ds-soft mt-2">
                        Tambien funciona sin @: <code className="text-ds-accent-text">!so NombreDelCanal</code>
                    </p>
                </div>
                <DocAlert type="info" title="Permisos">
                    Por defecto solo moderadores y el broadcaster pueden usar !so.
                </DocAlert>
            </DocSection>

            {/* Overlay */}
            <DocSection title="Overlay de Shoutout">
                <p className="mb-4">
                    El overlay muestra:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Avatar del canal
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Nombre del canal
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Categoria/juego actual
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Preview del ultimo clip (opcional)
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Numero de seguidores
                    </li>
                </ul>
                <Link
                    to="/dashboard/docs/overlays"
                    className="inline-flex items-center gap-2 text-ds-accent-text font-medium hover:underline"
                >
                    Como agregar el overlay a OBS
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </DocSection>

            {/* Shoutout automatico */}
            <DocSection title="Shoutout automatico">
                <p className="mb-4">
                    Configura shoutouts automaticos para ciertos eventos:
                </p>
                <div className="space-y-3">
                    <AutoOption
                        title="Al recibir raid"
                        description="Hacer shoutout automatico cuando alguien te hace raid"
                    />
                    <AutoOption
                        title="Usuarios VIP"
                        description="Shoutout automatico cuando un VIP entra al chat"
                    />
                    <AutoOption
                        title="Lista personalizada"
                        description="Shoutout automatico a canales especificos"
                    />
                </div>
            </DocSection>

            {/* Personalizacion */}
            <DocSection title="Personalizacion">
                <p className="mb-4">
                    Personaliza el overlay de shoutout:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CustomOption title="Duracion" description="Cuanto tiempo se muestra el overlay" />
                    <CustomOption title="Animacion" description="Entrada y salida del overlay" />
                    <CustomOption title="Posicion" description="Donde aparece en pantalla" />
                    <CustomOption title="Tamaño" description="Dimensiones del overlay" />
                    <CustomOption title="Colores" description="Esquema de colores personalizado" />
                    <CustomOption title="Sonido" description="Audio al mostrar el shoutout" />
                </div>
            </DocSection>

            {/* Mensaje en chat */}
            <DocSection title="Mensaje en chat">
                <p className="mb-4">
                    Ademas del overlay, el bot envia un mensaje al chat:
                </p>
                <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
                    <p className="text-sm text-ds-soft mb-2">Mensaje por defecto:</p>
                    <code className="text-ds-accent-text font-mono text-sm">
                        Ve a ver a @{'{channel}'} en https://twitch.tv/{'{channel}'} - Estaba jugando {'{game}'}
                    </code>
                </div>
                <DocAlert type="tip" title="Personalizacion">
                    Puedes personalizar el mensaje usando variables como {'{channel}'}, {'{game}'}, {'{followers}'}.
                </DocAlert>
            </DocSection>

            {/* Tips */}
            <DocSection title="Tips y trucos">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Clips">
                        Los clips se muestran automaticamente si el canal tiene clips publicos.
                        El overlay elige el clip mas reciente.
                    </DocAlert>
                    <DocAlert type="tip" title="Cooldown">
                        Configura un cooldown para evitar spam de shoutouts al mismo canal.
                    </DocAlert>
                </div>
            </DocSection>
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
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="w-10 h-10 bg-ds-raised rounded-lg flex items-center justify-center text-ds-accent-text mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-ds-text mb-1">{title}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}

interface AutoOptionProps {
    title: string;
    description: string;
}

function AutoOption({ title, description }: AutoOptionProps) {
    return (
        <div className="flex items-center justify-between bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div>
                <h4 className="font-bold text-ds-text">{title}</h4>
                <p className="text-sm text-ds-soft">{description}</p>
            </div>
            <div className="w-12 h-6 bg-ds-accent rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-ds-surface rounded-full" />
            </div>
        </div>
    );
}

interface CustomOptionProps {
    title: string;
    description: string;
}

function CustomOption({ title, description }: CustomOptionProps) {
    return (
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <h4 className="font-bold text-ds-text">{title}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}
