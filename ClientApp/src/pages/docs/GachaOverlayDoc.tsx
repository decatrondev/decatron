import { Dice6, Gift, Layers, Monitor, ArrowRight, Terminal, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../components/docs/DocAlert';
import DocSection from '../../components/docs/DocSection';

export default function GachaOverlayDoc() {
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
                            Juego de coleccion de cartas para tu stream de Twitch
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

            {/* Que es el Gacha? */}
            <DocSection title="Que es el Gacha?">
                <p className="mb-4">
                    El sistema Gacha de Decatron es un juego de coleccion de cartas integrado en tu stream.
                    Como streamer, creas cartas con diferentes raridades y tus viewers las coleccionan
                    al donar, suscribirse, usar bits o gastar DecaCoins.
                </p>
                <p>
                    Cada accion otorga "pulls" (tiradas) que revelan cartas aleatorias con una animacion
                    en tu overlay. Los viewers pueden ver su coleccion, intercambiar estrategias y
                    competir por completar todas las cartas.
                </p>
            </DocSection>

            {/* Como funciona */}
            <DocSection title="Como funciona">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FeatureCard
                        icon={<Gift className="w-5 h-5" />}
                        title="Donaciones"
                        description="Tips, bits, suscripciones y gift subs otorgan pulls automaticamente"
                    />
                    <FeatureCard
                        icon={<Layers className="w-5 h-5" />}
                        title="Coleccion"
                        description="5 niveles de rareza: Comun, Poco Comun, Raro, Epico y Legendario"
                    />
                    <FeatureCard
                        icon={<Monitor className="w-5 h-5" />}
                        title="Overlay"
                        description="Animacion de revelacion de cartas directamente en tu stream"
                    />
                </div>
            </DocSection>

            {/* Para Streamers - Configuracion */}
            <DocSection title="Para Streamers - Configuracion">
                <div className="space-y-4">
                    <Step number={1} title="Crear cartas">
                        <p>
                            En el tab <strong>Items</strong>, sube imagenes para cada carta y asignales una rareza.
                            Puedes crear tantas cartas como quieras en cada nivel de rareza.
                        </p>
                    </Step>
                    <Step number={2} title="Configurar probabilidades">
                        <p>
                            En el tab <strong>Rareza</strong>, ajusta los porcentajes de probabilidad para cada nivel.
                            Por ejemplo: Comun 50%, Poco Comun 25%, Raro 15%, Epico 8%, Legendario 2%.
                        </p>
                    </Step>
                    <Step number={3} title="Agregar integraciones">
                        <p>
                            En el tab <strong>Preferencias</strong>, configura cuantos pulls otorga cada tipo de accion:
                            Tips (por monto), Bits (por cantidad), Suscripciones, Gift Subs y DecaCoins (precio por pull).
                        </p>
                    </Step>
                    <Step number={4} title="Configurar overlay">
                        <p>
                            En el tab <strong>Sonidos</strong>, personaliza los sonidos de revelacion por rareza.
                            Ajusta el tamano, animacion y duracion del overlay desde las preferencias.
                        </p>
                    </Step>
                    <Step number={5} title="Agregar a OBS">
                        <p>
                            Copia la URL del overlay desde el dashboard y agregala como <strong>Browser Source</strong> en OBS.
                            Usa fondo transparente y las dimensiones recomendadas.
                        </p>
                    </Step>
                </div>
            </DocSection>

            {/* Para Viewers - Como jugar */}
            <DocSection title="Para Viewers - Como jugar">
                <p className="mb-4">
                    Como viewer, hay varias formas de obtener pulls (tiradas) para coleccionar cartas:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-orange-600">•</span>
                        <strong>Donar:</strong> Cada donacion otorga pulls segun el monto configurado por el streamer
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-orange-600">•</span>
                        <strong>Bits:</strong> Usa bits en el canal para recibir pulls automaticamente
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-orange-600">•</span>
                        <strong>Suscribirse:</strong> Suscripciones y gift subs otorgan pulls
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-orange-600">•</span>
                        <strong>DecaCoins:</strong> Compra pulls con tus DecaCoins usando <code className="bg-[#f8fafc] dark:bg-[#374151] px-1.5 py-0.5 rounded text-xs">!gcbuy</code>
                    </li>
                </ul>
                <p className="mb-4">
                    Usa los comandos de chat para tirar cartas, ver tu coleccion y mas.
                    Tambien puedes ver tu coleccion completa en la web:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2">Pagina de coleccion:</p>
                    <code className="text-orange-600 font-mono text-sm">https://twitch.decatron.net/gacha/collection?channel=CANAL&user=USUARIO</code>
                </div>
                <div className="mt-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2">Configuracion de privacidad:</p>
                    <code className="text-orange-600 font-mono text-sm">https://twitch.decatron.net/me/gacha</code>
                </div>
            </DocSection>

            {/* Raridades */}
            <DocSection title="Raridades">
                <p className="mb-4">
                    Las cartas tienen 5 niveles de rareza. El streamer configura las probabilidades de cada una.
                </p>
                <div className="space-y-2">
                    <RarityRow
                        name="Comun"
                        color="bg-gray-100 dark:bg-gray-800"
                        textColor="text-gray-600 dark:text-gray-400"
                        borderColor="border-gray-300 dark:border-gray-600"
                        stars={1}
                        starColor="text-gray-400"
                    />
                    <RarityRow
                        name="Poco Comun"
                        color="bg-green-50 dark:bg-green-900/20"
                        textColor="text-green-700 dark:text-green-400"
                        borderColor="border-green-300 dark:border-green-700"
                        stars={2}
                        starColor="text-green-500"
                    />
                    <RarityRow
                        name="Raro"
                        color="bg-blue-50 dark:bg-blue-900/20"
                        textColor="text-blue-700 dark:text-blue-400"
                        borderColor="border-blue-300 dark:border-blue-700"
                        stars={3}
                        starColor="text-blue-500"
                    />
                    <RarityRow
                        name="Epico"
                        color="bg-purple-50 dark:bg-purple-900/20"
                        textColor="text-purple-700 dark:text-purple-400"
                        borderColor="border-purple-300 dark:border-purple-700"
                        stars={4}
                        starColor="text-purple-500"
                    />
                    <RarityRow
                        name="Legendario"
                        color="bg-amber-50 dark:bg-amber-900/20"
                        textColor="text-amber-700 dark:text-amber-400"
                        borderColor="border-amber-300 dark:border-amber-700"
                        stars={5}
                        starColor="text-amber-500"
                    />
                </div>
            </DocSection>

            {/* Comandos de Chat */}
            <DocSection title="Comandos de Chat">
                <div className="space-y-2">
                    <CommandRow
                        command="!gacha pull [n] / !gcpull"
                        description="Tira cartas. Opcionalmente indica cuantas (ej: !gcpull 5)"
                    />
                    <CommandRow
                        command="!gacha col / !gccol"
                        description="Muestra un resumen de tu coleccion en el chat"
                    />
                    <CommandRow
                        command="!gacha pulls / !gcpulls"
                        description="Consulta cuantos pulls tienes disponibles"
                    />
                    <CommandRow
                        command="!gacha buy [n] / !gcbuy"
                        description="Compra pulls con tus DecaCoins"
                    />
                    <CommandRow
                        command="!gacha price / !gcprice"
                        description="Muestra todas las formas de obtener pulls y sus precios"
                    />
                    <CommandRow
                        command="!gacha donate user $ / !gcdonar"
                        description="Dona pulls manualmente a un usuario (solo moderadores)"
                        badge="MOD"
                    />
                    <CommandRow
                        command="!gacha pause / !gacha resume"
                        description="Pausa o reanuda una tirada multiple en progreso"
                    />
                </div>
            </DocSection>

            {/* Overlay en OBS */}
            <DocSection title="Overlay en OBS">
                <p className="mb-4">
                    Para mostrar las animaciones de revelacion de cartas en tu stream:
                </p>
                <div className="space-y-4">
                    <Step number={1} title="Copia la URL del overlay">
                        <p>Desde el dashboard de Gacha, copia la URL del overlay que se genera automaticamente para tu canal.</p>
                    </Step>
                    <Step number={2} title="Agrega un Browser Source en OBS">
                        <p>En OBS, agrega una nueva fuente de tipo <strong>Browser Source</strong> y pega la URL copiada.</p>
                    </Step>
                    <Step number={3} title="Configura las dimensiones">
                        <p>Usa las dimensiones recomendadas del dashboard. Asegurate de que el tamaño cubra el area donde quieres que aparezcan las cartas.</p>
                    </Step>
                    <Step number={4} title="Fondo transparente">
                        <p>Asegurate de que <strong>"Custom CSS"</strong> no interfiera y que el fondo sea transparente para que se integre bien con tu stream.</p>
                    </Step>
                </div>
            </DocSection>

            {/* Alerts */}
            <DocAlert type="tip" title="Sonidos personalizados">
                Los sonidos del overlay se pueden personalizar por rareza desde el tab Sonidos en la configuracion del Gacha.
            </DocAlert>

            <DocAlert type="info" title="Privacidad de colecciones">
                Las colecciones son privadas por defecto. Los viewers pueden hacerlas publicas desde <code className="font-mono">/me/gacha</code>.
            </DocAlert>
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

interface CommandRowProps {
    command: string;
    description: string;
    badge?: string;
}

function CommandRow({ command, description, badge }: CommandRowProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <code className="text-sm font-mono text-orange-600 dark:text-orange-400 font-bold">{command}</code>
                {badge && (
                    <span className="text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] sm:text-right">{description}</p>
        </div>
    );
}

interface RarityRowProps {
    name: string;
    color: string;
    textColor: string;
    borderColor: string;
    stars: number;
    starColor: string;
}

function RarityRow({ name, color, textColor, borderColor, stars, starColor }: RarityRowProps) {
    return (
        <div className={`flex items-center justify-between ${color} rounded-xl p-4 border ${borderColor}`}>
            <div className="flex items-center gap-3">
                <span className={`font-bold ${textColor}`}>{name}</span>
            </div>
            <div className="flex items-center gap-1">
                {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${starColor} fill-current`} />
                ))}
                {Array.from({ length: 5 - stars }).map((_, i) => (
                    <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                ))}
            </div>
        </div>
    );
}
