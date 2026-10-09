import { Gift, Users, Trophy, Settings, Clock, Shield, ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function GiveawayDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <Gift className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Sorteos / Giveaways
                        </h1>
                        <p className="text-ds-soft">
                            Sistema completo de sorteos con requisitos y pesos
                        </p>
                    </div>
                </div>
                <Link
                    to="/features/giveaways"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Crear un sorteo */}
            <DocSection title="Crear un sorteo">
                <div className="space-y-4">
                    <Step number={1} title="Ve a la seccion de sorteos">
                        <p>Navega a <strong>Features → Sorteos</strong> en el menu lateral.</p>
                    </Step>
                    <Step number={2} title="Configura el premio">
                        <p>Describe el premio que vas a sortear. Este texto se mostrara en el overlay y en el chat.</p>
                    </Step>
                    <Step number={3} title="Establece los requisitos">
                        <p>Configura quien puede participar: todos, solo followers, solo subs, etc.</p>
                    </Step>
                    <Step number={4} title="Inicia el sorteo">
                        <p>Usa el comando <code className="text-ds-accent-text">!raffle</code> o el boton en el dashboard para iniciar.</p>
                    </Step>
                </div>
            </DocSection>

            {/* Requisitos de participacion */}
            <DocSection title="Requisitos de participacion">
                <p className="mb-4">
                    Configura quien puede participar en tus sorteos:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RequirementCard
                        icon={<Users className="w-5 h-5" />}
                        title="Todos"
                        description="Cualquier persona puede participar"
                    />
                    <RequirementCard
                        icon={<Users className="w-5 h-5" />}
                        title="Solo Followers"
                        description="Deben seguir el canal"
                    />
                    <RequirementCard
                        icon={<Star className="w-5 h-5" />}
                        title="Solo Subs"
                        description="Deben estar suscritos"
                    />
                    <RequirementCard
                        icon={<Clock className="w-5 h-5" />}
                        title="Tiempo minimo"
                        description="Deben seguir por X dias/meses"
                    />
                </div>
                <DocAlert type="tip" title="Combinar requisitos">
                    Puedes combinar requisitos. Por ejemplo: followers con al menos 7 dias de antiguedad.
                </DocAlert>
            </DocSection>

            {/* Sistema de peso */}
            <DocSection title="Sistema de peso">
                <p className="mb-4">
                    Asigna diferentes probabilidades de ganar segun el tipo de usuario:
                </p>
                <div className="space-y-3">
                    <WeightExample
                        tier="Viewers"
                        weight="1x"
                        description="Probabilidad base"
                    />
                    <WeightExample
                        tier="Followers"
                        weight="2x"
                        description="Doble probabilidad"
                    />
                    <WeightExample
                        tier="Subs Tier 1"
                        weight="3x"
                        description="Triple probabilidad"
                    />
                    <WeightExample
                        tier="Subs Tier 2"
                        weight="5x"
                        description="5 veces mas probabilidad"
                    />
                    <WeightExample
                        tier="Subs Tier 3"
                        weight="10x"
                        description="10 veces mas probabilidad"
                    />
                </div>
                <DocAlert type="info">
                    Los pesos se configuran en la seccion de sorteos del dashboard.
                </DocAlert>
            </DocSection>

            {/* Comandos */}
            <DocSection title="Comandos de sorteo">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CommandCard
                        command="!raffle"
                        description="Inicia el sorteo (mod/broadcaster)"
                    />
                    <CommandCard
                        command="!join"
                        description="Participar en el sorteo activo"
                    />
                    <CommandCard
                        command="!draw"
                        description="Selecciona un ganador aleatorio"
                    />
                    <CommandCard
                        command="!winner"
                        description="Muestra el ultimo ganador"
                    />
                    <CommandCard
                        command="!cancel"
                        description="Cancela el sorteo activo"
                    />
                    <CommandCard
                        command="!participants"
                        description="Muestra el numero de participantes"
                    />
                </div>
            </DocSection>

            {/* Overlay */}
            <DocSection title="Overlay de sorteo">
                <p className="mb-4">
                    El overlay muestra informacion del sorteo en tiempo real:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Nombre del premio
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Numero de participantes
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Tiempo restante (si tiene limite)
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Animacion al seleccionar ganador
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

            {/* Historial */}
            <DocSection title="Historial de sorteos">
                <p className="mb-4">
                    Decatron guarda un registro de todos los sorteos realizados:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Fecha y hora del sorteo
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Premio sorteado
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Ganador
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Numero total de participantes
                    </li>
                </ul>
            </DocSection>

            {/* Tips */}
            <DocSection title="Tips y trucos">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Cooldown de ganadores">
                        Activa el cooldown de ganadores para evitar que la misma persona gane
                        multiples sorteos seguidos.
                    </DocAlert>
                    <DocAlert type="tip" title="Anunciar ganador">
                        Configura un mensaje automatico en el chat cuando se selecciona un ganador
                        para aumentar la emocion.
                    </DocAlert>
                    <DocAlert type="warning" title="Blacklist">
                        Puedes agregar usuarios a una blacklist para que no puedan participar
                        en sorteos (bots, cuentas sospechosas, etc.).
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

interface RequirementCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function RequirementCard({ icon, title, description }: RequirementCardProps) {
    return (
        <div className="flex items-start gap-3 bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="w-10 h-10 bg-ds-raised rounded-lg flex items-center justify-center text-ds-accent-text flex-shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-ds-text">{title}</h4>
                <p className="text-sm text-ds-soft">{description}</p>
            </div>
        </div>
    );
}

interface WeightExampleProps {
    tier: string;
    weight: string;
    description: string;
}

function WeightExample({ tier, weight, description }: WeightExampleProps) {
    return (
        <div className="flex items-center gap-4 bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="w-12 h-12 bg-ds-accent text-white rounded-lg flex items-center justify-center font-bold">
                {weight}
            </div>
            <div className="flex-1">
                <div className="font-bold text-ds-text">{tier}</div>
                <div className="text-sm text-ds-soft">{description}</div>
            </div>
        </div>
    );
}

interface CommandCardProps {
    command: string;
    description: string;
}

function CommandCard({ command, description }: CommandCardProps) {
    return (
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <code className="text-ds-accent-text font-mono font-bold">{command}</code>
            <p className="text-sm text-ds-soft mt-1">{description}</p>
        </div>
    );
}
