import { Shield, Users, Crown, Star, User, ArrowRight, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function PermissionsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <Shield className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Sistema de Permisos
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
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
                            <tr className="bg-[#f8fafc] dark:bg-[#374151] border-b border-[#e2e8f0] dark:border-[#374151]">
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Funcion</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">Everyone</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">Follower</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">Sub</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">Mod</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">Broadcaster</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
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
    gold: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400',
};

function PermissionLevel({ icon, level, description, color }: PermissionLevelProps) {
    return (
        <div className="flex items-center gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className={`w-10 h-10 ${colorMap[color]} rounded-lg flex items-center justify-center`}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="font-bold text-gray-900 dark:text-white">{level}</div>
                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</div>
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
            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{feature}</td>
            {permissions.map((allowed, index) => (
                <td key={index} className="px-4 py-3 text-center">
                    {allowed ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                        <X className="w-5 h-5 text-red-500 mx-auto" />
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
        <div className="flex items-center justify-between bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div>
                <code className="text-[#2563eb] font-mono font-bold">{command}</code>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">{description}</p>
            </div>
            <span className="px-3 py-1 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] text-sm font-medium rounded-lg">
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
        <div className="flex items-center justify-between bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <span className="font-medium text-gray-900 dark:text-white">{section}</span>
            <div className={`px-3 py-1 rounded-lg text-sm font-medium ${modAccess ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
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
