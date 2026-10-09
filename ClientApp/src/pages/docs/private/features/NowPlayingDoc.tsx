import { Music, Settings, Layout, Palette, Type, Sparkles, Monitor, ArrowRight, Headphones, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function NowPlayingDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Music className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Now Playing
                        </h1>
                        <p className="text-ds-soft">
                            Muestra la cancion que esta sonando en tu stream
                        </p>
                    </div>
                </div>
                <Link
                    to="/overlays/now-playing"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Que es */}
            <DocSection title="Que es Now Playing?">
                <p>
                    Now Playing es un overlay que muestra en tu stream la cancion que estas escuchando
                    en tiempo real. Se conecta con Spotify o Last.fm para detectar automaticamente
                    la musica y mostrar un widget personalizable.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FeatureCard
                        icon={<Radio className="w-5 h-5" />}
                        title="Deteccion automatica"
                        description="Se conecta con Spotify o Last.fm"
                    />
                    <FeatureCard
                        icon={<Palette className="w-5 h-5" />}
                        title="Personalizable"
                        description="Colores, fuentes, layout y animaciones"
                    />
                    <FeatureCard
                        icon={<Monitor className="w-5 h-5" />}
                        title="Overlay para OBS"
                        description="Se oculta automaticamente cuando no hay musica"
                    />
                </div>
            </DocSection>

            {/* Fuentes de musica */}
            <DocSection title="Fuentes de musica">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                                <Headphones className="w-5 h-5 text-ds-accent-text" />
                            </div>
                            <h4 className="font-bold text-ds-text">Spotify</h4>
                        </div>
                        <p className="text-sm text-ds-soft">
                            Conexion directa con la API de Spotify. Detecta la cancion actual,
                            artwork del album y progreso en tiempo real.
                        </p>
                    </div>
                    <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                                <Music className="w-5 h-5 text-ds-accent-text" />
                            </div>
                            <h4 className="font-bold text-ds-text">Last.fm</h4>
                        </div>
                        <p className="text-sm text-ds-soft">
                            Se conecta a Last.fm para detectar lo que estas scrobbleando.
                            Compatible con cualquier reproductor que use Last.fm.
                        </p>
                    </div>
                </div>
                <DocAlert type="tip" title="Consejo">
                    Spotify es la opcion recomendada ya que proporciona artwork del album
                    y barra de progreso en tiempo real. Last.fm es ideal si usas otros reproductores.
                </DocAlert>
            </DocSection>

            {/* Configuracion */}
            <DocSection title="Pestañas de configuración">
                <p className="mb-4">
                    La vista previa en vivo queda siempre a la derecha, con una canción de ejemplo o la que está sonando.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TabItem icon={<Settings className="w-4 h-4" />} title="Guía" description="Los pasos para empezar y el link para OBS" />
                    <TabItem icon={<Radio className="w-4 h-4" />} title="Conexión" description="Activar y conectar Last.fm o Spotify (con su cupo). La canción se consulta cada 3 segundos" />
                    <TabItem icon={<Palette className="w-4 h-4" />} title="Tema" description="Temas prearmados, fondo, borde, acento y plantillas guardadas" />
                    <TabItem icon={<Layout className="w-4 h-4" />} title="Elementos" description="Portada, título, artista, álbum, barra, tiempos, icono y ecualizador" />
                    <TabItem icon={<Type className="w-4 h-4" />} title="Tipografía" description="Fuente, tamaño, color y sombra de cada texto" />
                    <TabItem icon={<Sparkles className="w-4 h-4" />} title="Animaciones" description="Entrada, salida y cambio de canción" />
                    <TabItem icon={<Monitor className="w-4 h-4" />} title="Editor" description="Diseños prearmados y lienzo para arrastrar cada elemento" />
                </div>
            </DocSection>

            {/* Overlay en OBS */}
            <DocSection title="Agregar a OBS">
                <div className="space-y-3">
                    <StepItem number={1} text="Conecta Last.fm o Spotify en la pestaña Conexión" />
                    <StepItem number={2} text="Copia el link del overlay desde la pestaña Guía" />
                    <StepItem number={3} text="En OBS, agrega una fuente de Navegador con ese link" />
                    <StepItem number={4} text="Ancho y alto: el tamaño del lienzo (1920×1080 salvo que lo cambies en el Editor)" />
                </div>
                <DocAlert type="info" title="Se oculta solo">
                    El overlay desaparece con la animación de salida cuando no suena nada y vuelve con la próxima canción.
                    Si prefieres que quede a la vista, apaga «Ocultar cuando no suena nada» en Animaciones.
                </DocAlert>
            </DocSection>

            {/* Tips */}
            <DocSection title="Consejos">
                <div className="space-y-3">
                    <DocAlert type="tip" title="Posición">
                        Elige un diseño en el Editor y después arrastra cada elemento donde quieras: lo que ves es lo que sale en OBS.
                    </DocAlert>
                </div>
            </DocSection>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
            <div className="w-10 h-10 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center text-ds-accent-text mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-ds-text mb-1">{title}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}

function TabItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 p-3 bg-ds-bg rounded-lg">
            <div className="w-8 h-8 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center text-ds-accent-text flex-shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-ds-text text-sm">{title}</h4>
                <p className="text-xs text-ds-soft">{description}</p>
            </div>
        </div>
    );
}

function StepItem({ number, text }: { number: number; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 bg-ds-accent text-white rounded-full flex items-center justify-center font-bold text-xs">
                {number}
            </div>
            <p className="text-sm text-ds-soft">{text}</p>
        </div>
    );
}
