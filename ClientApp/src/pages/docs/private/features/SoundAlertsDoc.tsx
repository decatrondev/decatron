import { Volume2, Coins, Upload, Settings, Play, ArrowRight, Music, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function SoundAlertsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center">
                        <Volume2 className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Sound Alerts
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Alertas de sonido y video con Channel Points
                        </p>
                    </div>
                </div>
                <Link
                    to="/features/sound-alerts"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Como funciona */}
            <DocSection title="Como funciona">
                <p className="mb-4">
                    Sound Alerts permite a tu audiencia reproducir sonidos y videos en tu stream
                    usando Channel Points de Twitch. Es una forma divertida de interactuar con tu comunidad.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FeatureCard
                        icon={<Coins className="w-5 h-5" />}
                        title="Channel Points"
                        description="Los viewers gastan puntos para reproducir alertas"
                    />
                    <FeatureCard
                        icon={<Music className="w-5 h-5" />}
                        title="Audio y Video"
                        description="Soporta MP3, WAV, MP4 y WebM"
                    />
                    <FeatureCard
                        icon={<Play className="w-5 h-5" />}
                        title="Overlay"
                        description="Muestra el contenido en tu stream"
                    />
                </div>
            </DocSection>

            {/* Configurar Channel Points */}
            <DocSection title="Configurar Channel Points">
                <div className="space-y-4">
                    <Step number={1} title="Crea una recompensa en Twitch">
                        <p>Ve a tu panel de creador en Twitch → Puntos de canal → Agregar nueva recompensa.</p>
                    </Step>
                    <Step number={2} title="Nombra la recompensa">
                        <p>Dale un nombre descriptivo como "Sound Alert" o el nombre del sonido especifico.</p>
                    </Step>
                    <Step number={3} title="Conecta con Decatron">
                        <p>En Decatron, ve a Sound Alerts y selecciona la recompensa que creaste.</p>
                    </Step>
                    <Step number={4} title="Sube el archivo">
                        <p>Sube el archivo de audio o video que quieres reproducir.</p>
                    </Step>
                </div>
                <DocAlert type="info" title="Permisos">
                    Decatron necesita permisos de Channel Points para detectar cuando se canjea una recompensa.
                </DocAlert>
            </DocSection>

            {/* Subir archivos */}
            <DocSection title="Subir archivos">
                <p className="mb-4">
                    Formatos soportados:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormatCard
                        icon={<Music className="w-5 h-5" />}
                        title="Audio"
                        formats={["MP3", "WAV", "OGG"]}
                        maxSize="5 MB"
                    />
                    <FormatCard
                        icon={<Video className="w-5 h-5" />}
                        title="Video"
                        formats={["MP4", "WebM", "GIF"]}
                        maxSize="25 MB"
                    />
                </div>
                <DocAlert type="tip" title="Optimizacion">
                    Para mejor rendimiento, usa archivos de audio en MP3 y videos en WebM.
                    Mantén los videos cortos (menos de 10 segundos).
                </DocAlert>
            </DocSection>

            {/* Configurar overlay */}
            <DocSection title="Configurar overlay">
                <p className="mb-4">
                    El overlay de Sound Alerts muestra los videos cuando se reproducen:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Posicion:</strong> Centro, esquina, personalizada
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Tamaño:</strong> Pequeño, mediano, grande, pantalla completa
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Volumen:</strong> Control de volumen global
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Nombre del usuario:</strong> Mostrar quien activo la alerta
                    </li>
                </ul>
                <Link
                    to="/dashboard/docs/overlays"
                    className="inline-flex items-center gap-2 text-[#2563eb] font-medium hover:underline"
                >
                    Como agregar el overlay a OBS
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </DocSection>

            {/* Cola de alertas */}
            <DocSection title="Cola de alertas">
                <p className="mb-4">
                    Cuando multiples alertas se activan al mismo tiempo, se agregan a una cola:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Las alertas se reproducen una por una
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Puedes saltar alertas desde el dashboard
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Limite configurable de cola
                    </li>
                </ul>
            </DocSection>

            {/* Moderacion */}
            <DocSection title="Moderacion">
                <p className="mb-4">
                    Controla quien puede usar Sound Alerts:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Cooldown</h4>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Tiempo minimo entre alertas del mismo usuario
                        </p>
                    </div>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Blacklist</h4>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Bloquea usuarios especificos
                        </p>
                    </div>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Solo Followers/Subs</h4>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Limita quien puede usar alertas
                        </p>
                    </div>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Pausar alertas</h4>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Pausa temporalmente todas las alertas
                        </p>
                    </div>
                </div>
            </DocSection>

            {/* Tips */}
            <DocSection title="Tips y trucos">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Costos diferentes">
                        Puedes crear multiples recompensas con diferentes costos para alertas
                        de diferente "calidad" o duracion.
                    </DocAlert>
                    <DocAlert type="tip" title="Alertas tematicas">
                        Crea alertas tematicas para eventos especiales: Halloween, Navidad, etc.
                    </DocAlert>
                    <DocAlert type="warning" title="Derechos de autor">
                        Asegurate de usar contenido libre de derechos o con licencia para evitar
                        problemas de copyright.
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
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

interface StepProps {
    number: number;
    title: string;
    children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
    return (
        <div className="flex gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex-shrink-0 w-8 h-8 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{children}</div>
            </div>
        </div>
    );
}

interface FormatCardProps {
    icon: React.ReactNode;
    title: string;
    formats: string[];
    maxSize: string;
}

function FormatCard({ icon, title, formats, maxSize }: FormatCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#f8fafc] dark:bg-[#374151] rounded-lg flex items-center justify-center text-[#2563eb]">
                    {icon}
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
                {formats.map((format, index) => (
                    <span key={index} className="px-2 py-1 bg-[#f8fafc] dark:bg-[#374151] text-xs text-[#64748b] dark:text-[#94a3b8] rounded">
                        {format}
                    </span>
                ))}
            </div>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                Tamaño maximo: {maxSize}
            </p>
        </div>
    );
}
