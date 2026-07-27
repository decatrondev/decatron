import {
    Dice6, ArrowRight, Layers, ShieldCheck, Sliders, Percent, Gauge, Image,
    Users, Monitor, Volume2, Link2, Terminal, Trophy, Clock, Coins, Star,
    Gift, CreditCard, Sparkles, Music, Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function GachaDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center">
                        <Dice6 className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Sistema Gacha
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Configura tu sistema de cartas coleccionables
                        </p>
                    </div>
                </div>
                <Link
                    to="/features/gacha"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Descripcion general */}
            <DocSection title="Descripcion general">
                <p className="mb-4">
                    El sistema Gacha de Decatron es un juego de cartas coleccionables para tu comunidad.
                    Los viewers obtienen pulls (tiradas) al donar, dar bits, suscribirse, regalar subs o
                    gastar DecaCoins, y reciben cartas con diferentes niveles de rareza.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FeatureCard
                        icon={<Layers className="w-5 h-5" />}
                        title="11 Tabs de configuracion"
                        description="Control total sobre items, restricciones, probabilidades, sonidos y mas"
                    />
                    <FeatureCard
                        icon={<Monitor className="w-5 h-5" />}
                        title="Overlay para OBS"
                        description="Animacion de apertura de cartas en tu stream"
                    />
                    <FeatureCard
                        icon={<Link2 className="w-5 h-5" />}
                        title="Multiples fuentes de pulls"
                        description="Tips, Bits, Subs, Gift Subs y DecaCoins"
                    />
                </div>
            </DocSection>

            {/* Tabs del Dashboard */}
            <DocSection title="Tabs del Dashboard">
                <p className="mb-4">
                    El panel de configuracion del Gacha tiene 11 pestanas. Aqui un resumen de cada una:
                </p>
                <div className="space-y-3">
                    <TabCard
                        icon={<Star className="w-4 h-4" />}
                        name="Items"
                        description="Crea y edita cartas con nombre, imagen y nivel de rareza. Cada carta pertenece a una rareza que define su probabilidad de salir."
                    />
                    <TabCard
                        icon={<ShieldCheck className="w-4 h-4" />}
                        name="Restricciones"
                        description="Donacion minima requerida, cartas unicas (no repetidas), cooldown entre pulls, milestones (pity system) y tipos de pull habilitados."
                    />
                    <TabCard
                        icon={<Sliders className="w-4 h-4" />}
                        name="Preferencias"
                        description="Sobreescribe probabilidades de rareza por usuario especifico o de forma global. Util para eventos especiales."
                    />
                    <TabCard
                        icon={<Percent className="w-4 h-4" />}
                        name="Probabilidades"
                        description="Porcentaje base por rareza (deben sumar 100%). Tambien configura porcentajes separados para pulls con DecaCoins."
                    />
                    <TabCard
                        icon={<Gauge className="w-4 h-4" />}
                        name="Limites Rareza"
                        description="Intervalo de pulls e intervalo de tiempo entre apariciones de cada rareza. Controla la frecuencia de cartas raras."
                    />
                    <TabCard
                        icon={<Image className="w-4 h-4" />}
                        name="Banners"
                        description="Sube imagenes para el header de la pagina de coleccion publica de tu canal."
                    />
                    <TabCard
                        icon={<Users className="w-4 h-4" />}
                        name="Participantes"
                        description="Visualiza donantes, su inventario de cartas, progreso de milestones y cartas mas deseadas por la comunidad."
                    />
                    <TabCard
                        icon={<Monitor className="w-4 h-4" />}
                        name="Overlay"
                        description="Presets de tamano, velocidad de animacion y URL del overlay para agregar como browser source en OBS."
                    />
                    <TabCard
                        icon={<Volume2 className="w-4 h-4" />}
                        name="Sonidos"
                        description="9 eventos de sonido (drum roll, flash, 5 reveals por rareza, win, ambient). Volumen individual y subida de archivos personalizados."
                    />
                    <TabCard
                        icon={<Link2 className="w-4 h-4" />}
                        name="Integraciones"
                        description="Tips ($), Bits, Subs (por tier), Gift Subs y DecaCoins (precio por pull + limite diario)."
                    />
                    <TabCard
                        icon={<Terminal className="w-4 h-4" />}
                        name="Comandos"
                        description="Permisos por comando, cooldowns, aliases personalizados y configuracion de multi-pull."
                    />
                </div>
            </DocSection>

            {/* Sistema de Milestones */}
            <DocSection title="Sistema de Milestones">
                <p className="mb-4">
                    Los milestones son restricciones que controlan cuando un viewer puede recibir cartas.
                    Se configuran en la pestana <strong>Restricciones</strong> y se pueden reordenar con drag & drop.
                </p>
                <div className="space-y-4">
                    <Step number={1} title="Gate (MinDonationRequired)">
                        <p>
                            Umbral permanente de donacion. El viewer debe haber donado al menos esta cantidad
                            en total para poder participar. El total donado nunca se pierde ni se descuenta.
                        </p>
                    </Step>
                    <Step number={2} title="Gate Coins (CoinMinSpent)">
                        <p>
                            Igual que el Gate pero para DecaCoins. El viewer debe haber gastado al menos X coins
                            en total para desbloquear el gacha.
                        </p>
                    </Step>
                    <Step number={3} title="Milestone Donation (Pity System)">
                        <p>
                            Sistema de acumulacion por donaciones. Cada donacion suma al contador del viewer.
                            Cuando alcanza el umbral, se dispara un pull garantizado y se <strong>descuenta</strong> el
                            valor del umbral del contador (el excedente se conserva para el siguiente ciclo).
                        </p>
                    </Step>
                    <Step number={4} title="Milestone Coins">
                        <p>
                            Independiente del milestone de donacion. Misma logica de acumulacion y descuento,
                            pero usando DecaCoins.
                        </p>
                    </Step>
                    <Step number={5} title="Cycle (Ciclo de coleccion)">
                        <p>
                            Prioriza la carta mas barata disponible. Lleva registro de las cartas ganadas por el
                            viewer y se reinicia automaticamente cuando ha ganado todas.
                        </p>
                    </Step>
                    <Step number={6} title="Prioridad y orden">
                        <p>
                            Las restricciones se evaluan en orden. Usa drag & drop en la pestana de Restricciones
                            para reordenar la prioridad de evaluacion.
                        </p>
                    </Step>
                </div>
                <DocAlert type="tip" title="Milestone oculto">
                    El milestone es oculto para los viewers. Solo tu lo ves en el dashboard.
                    Los viewers no saben cuanto les falta para el pity.
                </DocAlert>
            </DocSection>

            {/* Overlay y Sonidos */}
            <DocSection title="Overlay y Sonidos">
                <p className="mb-4">
                    Configura la experiencia visual y auditiva de las aperturas de cartas en tu stream.
                </p>
                <div className="space-y-4">
                    <Step number={1} title="Configurar el Overlay">
                        <p>
                            Ve a la pestana <strong>Overlay</strong>, selecciona un preset de tamano o configura
                            las dimensiones manualmente. Copia la URL del overlay.
                        </p>
                    </Step>
                    <Step number={2} title="Agregar a OBS">
                        <p>
                            En OBS, agrega una nueva fuente de tipo <strong>Browser Source</strong>.
                            Pega la URL copiada y usa las dimensiones recomendadas del preset seleccionado.
                        </p>
                    </Step>
                    <Step number={3} title="Habilitar sonidos">
                        <p>
                            Los sonidos vienen <strong>deshabilitados por defecto</strong>. Ve a la pestana
                            <strong> Sonidos</strong> para activarlos. Hay 9 eventos de sonido disponibles.
                        </p>
                    </Step>
                    <Step number={4} title="Personalizar sonidos">
                        <p>
                            Cada evento tiene volumen individual y un volumen maestro general.
                            Sube tus propios archivos MP3 desde la media library para reemplazar los sonidos por defecto.
                        </p>
                    </Step>
                </div>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-3">Eventos de sonido</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                            'drum_roll', 'flash', 'reveal_1', 'reveal_2', 'reveal_3',
                            'reveal_4', 'reveal_5', 'win', 'ambient'
                        ].map((name) => (
                            <div key={name} className="flex items-center gap-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
                                <Music className="w-3 h-3 text-orange-500" />
                                <code className="text-xs bg-[#f8fafc] dark:bg-[#374151] px-1.5 py-0.5 rounded">{name}</code>
                            </div>
                        ))}
                    </div>
                </div>
                <DocAlert type="info" title="Sonidos personalizados">
                    Los sonidos placeholder se pueden reemplazar con tus propios archivos MP3
                    desde la media library. Cada evento se puede personalizar independientemente.
                </DocAlert>
            </DocSection>

            {/* Integraciones */}
            <DocSection title="Integraciones">
                <p className="mb-4">
                    Configura como los viewers obtienen pulls a traves de diferentes acciones:
                </p>
                <div className="space-y-3">
                    <IntegrationCard
                        icon={<CreditCard className="w-5 h-5" />}
                        name="Tips (Donaciones)"
                        description="Cada $X donados otorga un pull. Configura el monto por pull."
                        example="Ej: $5 = 1 pull"
                    />
                    <IntegrationCard
                        icon={<Sparkles className="w-5 h-5" />}
                        name="Bits"
                        description="X bits cheereados otorgan un pull. Configura la cantidad de bits por pull."
                        example="Ej: 500 bits = 1 pull"
                    />
                    <IntegrationCard
                        icon={<Gift className="w-5 h-5" />}
                        name="Suscripciones"
                        description="Pulls al suscribirse, configurable por tier: Prime, Tier 1, Tier 2 y Tier 3."
                        example="Ej: T1=1, T2=2, T3=5"
                    />
                    <IntegrationCard
                        icon={<Users className="w-5 h-5" />}
                        name="Gift Subs"
                        description="Los pulls se otorgan al gifter (quien regala), no al receptor. Configurable por cantidad."
                        example="Pulls para el gifter"
                    />
                    <IntegrationCard
                        icon={<Coins className="w-5 h-5" />}
                        name="DecaCoins"
                        description="Los viewers gastan coins para hacer pulls. Configura el precio por pull y un limite diario maximo."
                        example="Ej: 100 coins, max 5/dia"
                    />
                </div>
            </DocSection>

            {/* Comandos */}
            <DocSection title="Comandos">
                <p className="mb-4">
                    Comandos disponibles del bot para el sistema Gacha. Los permisos, cooldowns y aliases
                    se configuran en la pestana <strong>Comandos</strong>.
                </p>
                <div className="space-y-3">
                    <CommandCard
                        command="!gcpull"
                        description="Abre una carta aleatoria (si el viewer tiene pulls disponibles)"
                        permission="Todos"
                    />
                    <CommandCard
                        command="!gcbuy"
                        description="Compra un pull con DecaCoins"
                        permission="Todos"
                    />
                    <CommandCard
                        command="!gcinventory"
                        description="Muestra el inventario de cartas del viewer"
                        permission="Todos"
                    />
                    <CommandCard
                        command="!gcwish"
                        description="Agrega una carta a la lista de deseados"
                        permission="Todos"
                    />
                    <CommandCard
                        command="!gcstats"
                        description="Muestra estadisticas del viewer (pulls totales, rarezas, etc.)"
                        permission="Todos"
                    />
                    <CommandCard
                        command="!gcgive"
                        description="Otorga pulls a un viewer manualmente"
                        permission="Streamer / Mods"
                    />
                    <CommandCard
                        command="!gcreset"
                        description="Reinicia el progreso de un viewer"
                        permission="Streamer"
                    />
                </div>
                <DocAlert type="info" title="Aliases">
                    Cada comando puede tener aliases personalizados. Por ejemplo, puedes crear
                    <code className="mx-1 px-1 bg-blue-100 dark:bg-blue-900/30 rounded text-xs">!pull</code>
                    como alias de
                    <code className="mx-1 px-1 bg-blue-100 dark:bg-blue-900/30 rounded text-xs">!gcpull</code>.
                    Configuralos en la pestana Comandos.
                </DocAlert>
            </DocSection>

            {/* Advertencia final */}
            <DocSection title="Consideraciones importantes">
                <DocAlert type="warning" title="Cambios en restricciones">
                    Los cambios en restricciones y milestones afectan a todos los viewers.
                    Planifica antes de modificar thresholds activos. Por ejemplo, si reduces un
                    milestone de $50 a $20, los viewers que ya tenian acumulado mas de $20 podrian
                    recibir pulls inmediatamente.
                </DocAlert>
                <DocAlert type="tip" title="Recomendacion">
                    Antes de ir live con el gacha, configura todas las pestanas y haz pruebas
                    con la cuenta de un moderador. Revisa que el overlay funcione y los sonidos
                    se escuchen correctamente.
                </DocAlert>
            </DocSection>
        </div>
    );
}

// --- Local helper components ---

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
            <div className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{children}</div>
            </div>
        </div>
    );
}

interface TabCardProps {
    icon: React.ReactNode;
    name: string;
    description: string;
}

function TabCard({ icon, name, description }: TabCardProps) {
    return (
        <div className="flex items-start gap-3 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-0.5">{name}</h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
        </div>
    );
}

interface IntegrationCardProps {
    icon: React.ReactNode;
    name: string;
    description: string;
    example: string;
}

function IntegrationCard({ icon, name, description, example }: IntegrationCardProps) {
    return (
        <div className="flex items-center justify-between bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400">
                    {icon}
                </div>
                <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{name}</h4>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
                </div>
            </div>
            <code className="flex-shrink-0 text-xs bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] px-2 py-1 rounded ml-4">
                {example}
            </code>
        </div>
    );
}

interface CommandCardProps {
    command: string;
    description: string;
    permission: string;
}

function CommandCard({ command, description, permission }: CommandCardProps) {
    return (
        <div className="flex items-center justify-between bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center gap-3">
                <code className="text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
                    {command}
                </code>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
            <span className="flex-shrink-0 text-xs bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] px-2 py-1 rounded ml-4">
                {permission}
            </span>
        </div>
    );
}
