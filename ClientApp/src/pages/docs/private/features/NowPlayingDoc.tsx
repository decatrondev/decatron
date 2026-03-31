import { Music, Settings, Layout, Palette, Type, BarChart3, Sparkles, Monitor, ArrowRight, Headphones, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function NowPlayingDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center">
                        <Music className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Now Playing
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Muestra la cancion que esta sonando en tu stream
                        </p>
                    </div>
                </div>
                <Link
                    to="/overlays/now-playing"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
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
                    <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                                <Headphones className="w-5 h-5 text-green-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Spotify</h4>
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Conexion directa con la API de Spotify. Detecta la cancion actual,
                            artwork del album y progreso en tiempo real.
                        </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                                <Music className="w-5 h-5 text-red-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Last.fm</h4>
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
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
            <DocSection title="Tabs de configuracion">
                <p className="mb-4">
                    Now Playing tiene 8 tabs de configuracion para personalizar cada aspecto del overlay:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TabItem icon={<Settings className="w-4 h-4" />} title="General" description="Fuente de musica (Spotify/Last.fm), conexion y activacion" />
                    <TabItem icon={<Layout className="w-4 h-4" />} title="Layout" description="Disposicion del artwork, texto y barra de progreso" />
                    <TabItem icon={<Palette className="w-4 h-4" />} title="Estilo" description="Colores de fondo, texto, acentos y bordes" />
                    <TabItem icon={<Type className="w-4 h-4" />} title="Tipografia" description="Fuente, tamano y peso del texto" />
                    <TabItem icon={<BarChart3 className="w-4 h-4" />} title="Progreso" description="Barra de progreso de la cancion" />
                    <TabItem icon={<Sparkles className="w-4 h-4" />} title="Animaciones" description="Efectos de entrada, salida y transicion" />
                    <TabItem icon={<Monitor className="w-4 h-4" />} title="Posicion" description="Ubicacion del overlay en pantalla" />
                </div>
            </DocSection>

            {/* Overlay en OBS */}
            <DocSection title="Agregar a OBS">
                <div className="space-y-3">
                    <StepItem number={1} text="Ve a la pagina de configuracion de Now Playing en el dashboard" />
                    <StepItem number={2} text="Conecta tu cuenta de Spotify o configura Last.fm" />
                    <StepItem number={3} text="Personaliza el estilo del overlay a tu gusto" />
                    <StepItem number={4} text="Copia la URL del overlay desde la pagina de configuracion" />
                    <StepItem number={5} text="En OBS, agrega una fuente de Navegador con esa URL" />
                    <StepItem number={6} text="Dimensiones recomendadas: 800x200" />
                </div>
                <DocAlert type="info" title="Auto-hide">
                    El overlay se oculta automaticamente cuando no hay musica sonando
                    y reaparece cuando detecta una nueva cancion.
                </DocAlert>
            </DocSection>

            {/* Tips */}
            <DocSection title="Consejos">
                <div className="space-y-3">
                    <DocAlert type="tip" title="Rendimiento">
                        El sistema solo hace polling cuando el overlay tiene viewers activos.
                        No consume recursos de la API cuando nadie esta viendo.
                    </DocAlert>
                    <DocAlert type="tip" title="Posicion">
                        El overlay funciona mejor en una esquina inferior de tu stream.
                        Usa la tab de Posicion para ajustar la ubicacion exacta.
                    </DocAlert>
                </div>
            </DocSection>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400 mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

function TabItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 p-3 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-lg">
            <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h4>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
        </div>
    );
}

function StepItem({ number, text }: { number: number; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-xs">
                {number}
            </div>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{text}</p>
        </div>
    );
}
