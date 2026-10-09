import { Volume2, Coins, Play, ArrowRight, Music, Video, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function SoundAlertsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <Volume2 className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Sound Alerts
                        </h1>
                        <p className="text-ds-soft">
                            Sonidos, videos e imágenes con los puntos del canal
                        </p>
                    </div>
                </div>
                <Link
                    to="/overlays/sound-alerts"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Como funciona */}
            <DocSection title="Como funciona">
                <p className="mb-4">
                    Sound Alerts reproduce un sonido, un video o una imagen en tu stream cuando alguien canjea
                    una recompensa de puntos del canal. Cada recompensa tiene su propio archivo. Funciona en Twitch y en Kick.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FeatureCard icon={<Coins className="w-5 h-5" />} title="Puntos del canal" description="Cada recompensa dispara su propia alerta" />
                    <FeatureCard icon={<Music className="w-5 h-5" />} title="Sonido, video o imagen" description="A los sonidos se les puede poner una imagen" />
                    <FeatureCard icon={<Play className="w-5 h-5" />} title="Overlay en OBS" description="Lo que ves en el editor es lo que sale en OBS" />
                </div>
            </DocSection>

            {/* Primeros pasos */}
            <DocSection title="Primeros pasos">
                <div className="space-y-3">
                    <Step number={1} title="Crea las recompensas">
                        <p>En tu panel de creador de Twitch (o en Kick): Puntos de canal, Agregar recompensa. Aparecen solas en Sound Alerts.</p>
                    </Step>
                    <Step number={2} title="Asigna un archivo a cada una">
                        <p>En la pestaña <strong>Recompensas</strong>, haz clic en una recompensa o arrastra un archivo encima. Puedes subir uno nuevo o elegirlo de la <strong>Biblioteca</strong>.</p>
                    </Step>
                    <Step number={3} title="Agrega el overlay a OBS">
                        <p>Copia el link de la pestaña <strong>Guía</strong> y agrégalo como fuente de navegador de 1920×1080. Haz clic una vez en la fuente (Interactuar) para desbloquear el audio.</p>
                    </Step>
                    <Step number={4} title="Pruébalo">
                        <p>Elige una recompensa en la vista previa y usa <strong>Probar en OBS</strong>. La prueba usa lo último que guardaste.</p>
                    </Step>
                </div>
            </DocSection>

            {/* Archivos */}
            <DocSection title="Archivos">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <FormatCard icon={<Music className="w-5 h-5" />} title="Sonido" formats={['MP3', 'WAV', 'OGG']} maxSize="10 MB" />
                    <FormatCard icon={<Video className="w-5 h-5" />} title="Video" formats={['MP4', 'WebM']} maxSize="50 MB" />
                    <FormatCard icon={<ImageIcon className="w-5 h-5" />} title="Imagen" formats={['PNG', 'JPG']} maxSize="5 MB" />
                </div>
                <DocAlert type="info" title="Imagen para los sonidos">
                    A un sonido le puedes poner una imagen (subida o por link, PNG/JPG/GIF de hasta 10 MB) con el lápiz de la
                    recompensa. Si apagas "Mostrar imagen", solo se escucha el sonido.
                </DocAlert>
            </DocSection>

            {/* Diseño */}
            <DocSection title="Diseño de la alerta">
                <ul className="space-y-2 mb-4">
                    <DocItem label="Textos">Líneas con @redeemer (quien canjeó) y @reward (la recompensa), con su tamaño, grosor y alineación. Fuente, color, sombra y borde para todas.</DocItem>
                    <DocItem label="Fondo">Transparente, de un color o degradado, con opacidad.</DocItem>
                    <DocItem label="Animación">Fundido, deslizar, rebote, zoom o sin animación, en tres velocidades.</DocItem>
                    <DocItem label="Editor">Arrastra la imagen, cada línea de texto y el fondo, y cambia su tamaño desde las esquinas.</DocItem>
                    <DocItem label="Duración">Los sonidos y videos duran lo que dura el archivo; las imágenes, lo que elijas en Básico (3 a 30 s).</DocItem>
                </ul>
                <DocAlert type="info" title="Cola de alertas">
                    Si llega un canje mientras otra alerta se está mostrando, espera su turno y suena después, en el orden
                    en que llegaron. La <strong>pausa entre alertas</strong> (en Básico) es el tiempo mínimo entre el final de
                    una y el comienzo de la siguiente. La cola vive en el overlay: si recargas la fuente en OBS, se vacía.
                </DocAlert>
            </DocSection>

            {/* Tips */}
            <DocSection title="Tips">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Costos diferentes">
                        Crea recompensas con distintos costos para alertas más largas o más llamativas.
                    </DocAlert>
                    <DocAlert type="warning" title="Derechos de autor">
                        Usa contenido libre de derechos o con licencia para evitar problemas de copyright.
                    </DocAlert>
                </div>
            </DocSection>
        </div>
    );
}

function DocItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2 text-ds-soft">
            <span className="text-ds-accent-text">•</span>
            <span><strong className="text-ds-text">{label}:</strong> {children}</span>
        </li>
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

interface StepProps {
    number: number;
    title: string;
    children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
    return (
        <div className="flex gap-4 bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="flex-shrink-0 w-8 h-8 bg-ds-accent text-white rounded-full flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div>
                <h4 className="font-bold text-ds-text mb-1">{title}</h4>
                <div className="text-sm text-ds-soft">{children}</div>
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
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-ds-bg rounded-lg flex items-center justify-center text-ds-accent-text">
                    {icon}
                </div>
                <h4 className="font-bold text-ds-text">{title}</h4>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
                {formats.map((format, index) => (
                    <span key={index} className="px-2 py-1 bg-ds-bg text-xs text-ds-soft rounded">
                        {format}
                    </span>
                ))}
            </div>
            <p className="text-sm text-ds-soft">
                Tamaño maximo: {maxSize}
            </p>
        </div>
    );
}
