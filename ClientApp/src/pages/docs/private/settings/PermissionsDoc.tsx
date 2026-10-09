import { Shield, Users, Crown, Star, User, ArrowRight, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function PermissionsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <Shield className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Sistema de Permisos
                        </h1>
                        <p className="text-ds-soft">
                            Controla quien puede usar que funciones
                        </p>
                    </div>
                </div>
            </div>

            {/* Niveles de permiso */}
            <DocSection title="Niveles de permiso">
                <p className="mb-4">
                    Decatron tiene diferentes niveles de permiso para controlar el acceso:
                </p>
                <div className="space-y-3">
                    <PermissionLevel
                        icon={<Crown className="w-5 h-5" />}
                        level="Broadcaster"
                        description="El dueño del canal - acceso total"
                        color="gold"
                    />
                    <PermissionLevel
                        icon={<Shield className="w-5 h-5" />}
                        level="Moderador"
                        description="Moderadores del canal de Twitch"
                        color="green"
                    />
                    <PermissionLevel
                        icon={<Star className="w-5 h-5" />}
                        level="VIP"
                        description="Usuarios con insignia VIP"
                        color="pink"
                    />
                    <PermissionLevel
                        icon={<Star className="w-5 h-5" />}
                        level="Subscriber"
                        description="Suscriptores del canal"
                        color="purple"
                    />
                    <PermissionLevel
                        icon={<Users className="w-5 h-5" />}
                        level="Follower"
                        description="Seguidores del canal"
                        color="blue"
                    />
                    <PermissionLevel
                        icon={<User className="w-5 h-5" />}
                        level="Everyone"
                        description="Cualquier usuario"
                        color="gray"
                    />
                </div>
            </DocSection>

            {/* Que puede hacer cada nivel */}
            <DocSection title="Que puede hacer cada nivel">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-ds-bg border-b border-ds-border">
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Funcion</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-ds-text">Everyone</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-ds-text">Follower</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-ds-text">Sub</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-ds-text">Mod</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-ds-text">Broadcaster</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ds-border">
                            <PermissionRow
                                feature="Usar comandos basicos"
                                permissions={[true, true, true, true, true]}
                            />
                            <PermissionRow
                                feature="Participar en sorteos"
                                permissions={[false, true, true, true, true]}
                            />
                            <PermissionRow
                                feature="Usar sound alerts"
                                permissions={[false, false, true, true, true]}
                            />
                            <PermissionRow
                                feature="Controlar timer"
                                permissions={[false, false, false, true, true]}
                            />
                            <PermissionRow
                                feature="Hacer shoutouts"
                                permissions={[false, false, false, true, true]}
                            />
                            <PermissionRow
                                feature="Configurar bot"
                                permissions={[false, false, false, false, true]}
                            />
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Permisos por comando */}
            <DocSection title="Permisos por comando">
                <p className="mb-4">
                    Cada comando puede tener un nivel de permiso diferente:
                </p>
                <div className="space-y-3">
                    <CommandPermission
                        command="!hola"
                        level="Everyone"
                        description="Comando de saludo basico"
                    />
                    <CommandPermission
                        command="!so"
                        level="Moderador"
                        description="Hacer shoutout a otro canal"
                    />
                    <CommandPermission
                        command="!dstart"
                        level="Moderador"
                        description="Iniciar el timer"
                    />
                    <CommandPermission
                        command="!raffle"
                        level="Moderador"
                        description="Iniciar un sorteo"
                    />
                </div>
                <DocAlert type="tip" title="Personalizar">
                    Puedes cambiar el nivel de permiso de cualquier comando en su configuracion.
                </DocAlert>
            </DocSection>

            {/* Permisos del dashboard */}
            <DocSection title="Permisos del Dashboard">
                <p className="mb-4">
                    Los moderadores pueden tener acceso limitado al dashboard:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DashboardAccess
                        section="Ver estadisticas"
                        modAccess={true}
                    />
                    <DashboardAccess
                        section="Gestionar comandos"
                        modAccess={true}
                    />
                    <DashboardAccess
                        section="Moderar chat"
                        modAccess={true}
                    />
                    <DashboardAccess
                        section="Configurar alertas"
                        modAccess={false}
                    />
                    <DashboardAccess
                        section="Cambiar configuracion"
                        modAccess={false}
                    />
                    <DashboardAccess
                        section="Gestionar permisos"
                        modAccess={false}
                    />
                </div>
            </DocSection>

            {/* Como asignar permisos */}
            <DocSection title="Como asignar permisos">
                <div className="space-y-4">
                    <Step number={1} title="Ve a la configuracion del comando">
                        <p>Encuentra el comando que quieres modificar en Comandos → Por Defecto o Personalizados.</p>
                    </Step>
                    <Step number={2} title="Encuentra la opcion de permisos">
                        <p>Busca el selector de "Nivel de permiso" o "Quien puede usar".</p>
                    </Step>
                    <Step number={3} title="Selecciona el nivel">
                        <p>Elige el nivel minimo requerido para usar el comando.</p>
                    </Step>
                    <Step number={4} title="Guarda los cambios">
                        <p>Haz clic en Guardar para aplicar los cambios.</p>
                    </Step>
                </div>
            </DocSection>

            {/* Casos especiales */}
            <DocSection title="Casos especiales">
                <div className="space-y-4">
                    <DocAlert type="info" title="Cooldown por nivel">
                        Puedes configurar diferentes cooldowns segun el nivel del usuario.
                        Por ejemplo, subs pueden tener cooldown de 5 segundos mientras viewers tienen 30.
                    </DocAlert>
                    <DocAlert type="info" title="Usuarios especificos">
                        Puedes dar o quitar acceso a usuarios especificos sin cambiar su rol general.
                    </DocAlert>
                    <DocAlert type="warning" title="Broadcaster siempre">
                        El broadcaster siempre tiene acceso a todo, independientemente de la configuracion.
                    </DocAlert>
                </div>
            </DocSection>
        </div>
    );
}

interface PermissionLevelProps {
    icon: React.ReactNode;
    level: string;
    description: string;
    color: string;
}

const colorMap: Record<string, string> = {
    gold: 'bg-ds-raised text-ds-accent-text ',
    green: 'bg-ds-raised text-ds-accent-text',
    pink: 'bg-ds-raised text-ds-accent-text ',
    purple: 'bg-ds-raised text-ds-accent-text ',
    blue: 'bg-ds-raised text-ds-accent-text ',
    gray: 'bg-ds-bg text-ds-soft ',
};

function PermissionLevel({ icon, level, description, color }: PermissionLevelProps) {
    return (
        <div className="flex items-center gap-4 bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className={`w-10 h-10 ${colorMap[color]} rounded-lg flex items-center justify-center`}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="font-bold text-ds-text">{level}</div>
                <div className="text-sm text-ds-soft">{description}</div>
            </div>
        </div>
    );
}

interface PermissionRowProps {
    feature: string;
    permissions: boolean[];
}

function PermissionRow({ feature, permissions }: PermissionRowProps) {
    return (
        <tr>
            <td className="px-4 py-3 text-sm text-ds-text">{feature}</td>
            {permissions.map((allowed, index) => (
                <td key={index} className="px-4 py-3 text-center">
                    {allowed ? (
                        <Check className="w-5 h-5 text-ds-ok mx-auto" />
                    ) : (
                        <X className="w-5 h-5 text-ds-danger mx-auto" />
                    )}
                </td>
            ))}
        </tr>
    );
}

interface CommandPermissionProps {
    command: string;
    level: string;
    description: string;
}

function CommandPermission({ command, level, description }: CommandPermissionProps) {
    return (
        <div className="flex items-center justify-between bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div>
                <code className="text-ds-accent-text font-mono font-bold">{command}</code>
                <p className="text-sm text-ds-soft mt-1">{description}</p>
            </div>
            <span className="px-3 py-1 bg-ds-bg text-ds-soft text-sm font-medium rounded-lg">
                {level}
            </span>
        </div>
    );
}

interface DashboardAccessProps {
    section: string;
    modAccess: boolean;
}

function DashboardAccess({ section, modAccess }: DashboardAccessProps) {
    return (
        <div className="flex items-center justify-between bg-ds-surface rounded-lg p-4 border border-ds-border">
            <span className="font-medium text-ds-text">{section}</span>
            <div className={`px-3 py-1 rounded-lg text-sm font-medium ${modAccess ? 'bg-ds-ok/10 text-ds-ok' : 'bg-ds-danger/10 text-ds-danger'}`}>
                {modAccess ? 'Mods pueden' : 'Solo broadcaster'}
            </div>
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
