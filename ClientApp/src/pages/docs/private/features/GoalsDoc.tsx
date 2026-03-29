import { Target, TrendingUp, Bell, Clock, Settings, ArrowRight, Zap, Star, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function GoalsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center">
                        <Target className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Metas / Goals
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Crea metas interactivas con overlay en tiempo real
                        </p>
                    </div>
                </div>
                <Link
                    to="/overlays/goals"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Crear una meta */}
            <DocSection title="Crear una meta">
                <div className="space-y-4">
                    <Step number={1} title="Define el objetivo">
                        <p>Establece que quieres lograr: X subs, X bits, X donaciones, etc.</p>
                    </Step>
                    <Step number={2} title="Configura la meta">
                        <p>Establece el valor objetivo (ej: 100 subs) y el valor inicial (ej: 50).</p>
                    </Step>
                    <Step number={3} title="Personaliza el overlay">
                        <p>Configura colores, animaciones y mensajes de la barra de progreso.</p>
                    </Step>
                    <Step number={4} title="Agrega a OBS">
                        <p>Copia la URL del overlay y agregala como fuente de navegador.</p>
                    </Step>
                </div>
            </DocSection>

            {/* Fuentes de progreso */}
            <DocSection title="Fuentes de progreso">
                <p className="mb-4">
                    Las metas pueden avanzar automaticamente con diferentes fuentes:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SourceCard
                        icon={<Star className="w-5 h-5" />}
                        title="Subscripciones"
                        description="Nuevos subs, resubs, gift subs"
                        color="purple"
                    />
                    <SourceCard
                        icon={<Zap className="w-5 h-5" />}
                        title="Bits"
                        description="Cheers de la audiencia"
                        color="yellow"
                    />
                    <SourceCard
                        icon={<DollarSign className="w-5 h-5" />}
                        title="Donaciones"
                        description="Tips a traves de Decatron"
                        color="green"
                    />
                    <SourceCard
                        icon={<Target className="w-5 h-5" />}
                        title="Manual"
                        description="Avance manual desde el dashboard"
                        color="blue"
                    />
                </div>
            </DocSection>

            {/* Integracion con timer */}
            <DocSection title="Integracion con el Timer">
                <p className="mb-4">
                    Las metas pueden integrarse con el timer de Decatron:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-3">Ejemplo: Meta de tiempo</h4>
                    <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                            <span className="text-green-500">•</span>
                            Cada nuevo sub agrega 5 minutos al timer
                        </li>
                        <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                            <span className="text-green-500">•</span>
                            100 bits agregan 1 minuto
                        </li>
                        <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                            <span className="text-green-500">•</span>
                            Cada $5 de donacion agregan 10 minutos
                        </li>
                    </ul>
                </div>
                <DocAlert type="tip" title="Subathon">
                    Esta integracion es perfecta para hacer subathons donde el stream
                    se extiende con cada contribucion.
                </DocAlert>
            </DocSection>

            {/* Milestones */}
            <DocSection title="Milestones (Hitos)">
                <p className="mb-4">
                    Configura hitos intermedios para celebrar el progreso:
                </p>
                <div className="space-y-3">
                    <MilestoneExample
                        percentage="25%"
                        action="Reproducir sonido de celebracion"
                    />
                    <MilestoneExample
                        percentage="50%"
                        action="Mostrar animacion especial"
                    />
                    <MilestoneExample
                        percentage="75%"
                        action="Enviar mensaje al chat"
                    />
                    <MilestoneExample
                        percentage="100%"
                        action="Meta completada + alerta especial"
                    />
                </div>
            </DocSection>

            {/* Overlay */}
            <DocSection title="Overlay de metas">
                <p className="mb-4">
                    El overlay muestra el progreso de la meta en tiempo real:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-[#64748b] dark:text-[#94a3b8]">Meta de Subs</span>
                            <span className="font-bold text-gray-900 dark:text-white">75 / 100</span>
                        </div>
                        <div className="h-4 bg-[#f8fafc] dark:bg-[#374151] rounded-full overflow-hidden">
                            <div className="h-full w-3/4 bg-gradient-to-r from-green-500 to-green-600 rounded-full" />
                        </div>
                    </div>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] text-center">
                        Ejemplo de barra de progreso
                    </p>
                </div>
                <div className="mt-4 space-y-2">
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        Personaliza el overlay con:
                    </p>
                    <ul className="space-y-1">
                        <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                            <span className="text-[#2563eb]">•</span>
                            Colores personalizados
                        </li>
                        <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                            <span className="text-[#2563eb]">•</span>
                            Animaciones al avanzar
                        </li>
                        <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                            <span className="text-[#2563eb]">•</span>
                            Texto personalizado
                        </li>
                        <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                            <span className="text-[#2563eb]">•</span>
                            Mostrar/ocultar porcentaje
                        </li>
                    </ul>
                </div>
            </DocSection>

            {/* Comandos */}
            <DocSection title="Comandos de metas">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CommandCard
                        command="!goal"
                        description="Muestra el progreso actual de la meta"
                    />
                    <CommandCard
                        command="!goal add [cantidad]"
                        description="Agrega progreso manualmente (mod)"
                    />
                    <CommandCard
                        command="!goal reset"
                        description="Reinicia la meta a cero (mod)"
                    />
                    <CommandCard
                        command="!goal set [cantidad]"
                        description="Establece un valor especifico (mod)"
                    />
                </div>
            </DocSection>

            {/* Tips */}
            <DocSection title="Tips y trucos">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Multiples metas">
                        Puedes tener varias metas activas al mismo tiempo, cada una con su propio overlay.
                    </DocAlert>
                    <DocAlert type="tip" title="Persistencia">
                        Las metas se guardan automaticamente. Si tu stream se corta, el progreso no se pierde.
                    </DocAlert>
                    <DocAlert type="info" title="Historial">
                        Puedes ver el historial de metas completadas en la seccion de Analytics.
                    </DocAlert>
                </div>
            </DocSection>
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

interface SourceCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
}

const colorMap: Record<string, string> = {
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
};

function SourceCard({ icon, title, description, color }: SourceCardProps) {
    return (
        <div className="flex items-start gap-3 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className={`w-10 h-10 ${colorMap[color]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
        </div>
    );
}

interface MilestoneExampleProps {
    percentage: string;
    action: string;
}

function MilestoneExample({ percentage, action }: MilestoneExampleProps) {
    return (
        <div className="flex items-center gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-12 h-12 bg-green-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                {percentage}
            </div>
            <div className="text-[#64748b] dark:text-[#94a3b8]">{action}</div>
        </div>
    );
}

interface CommandCardProps {
    command: string;
    description: string;
}

function CommandCard({ command, description }: CommandCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <code className="text-[#2563eb] font-mono font-bold">{command}</code>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">{description}</p>
        </div>
    );
}
