import { Settings, User, Globe, Shield, ArrowRight, Power, Users, Info, Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function SettingsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                        <Settings className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Configuracion del Bot
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Gestiona tu bot y permisos de acceso
                        </p>
                    </div>
                </div>
                <Link
                    to="/settings"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Estado del Bot */}
            <DocSection title="Estado del Bot">
                <p className="mb-4">
                    Controla si el bot esta activo en tu canal:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                            <Power className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white">Bot Activado/Desactivado</h4>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Activa o desactiva el bot completamente en tu canal
                            </p>
                        </div>
                        <div className="w-12 h-6 bg-green-500 rounded-full relative">
                            <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                        </div>
                    </div>
                </div>
                <DocAlert type="info" title="Cuando desactivar">
                    Puedes desactivar el bot temporalmente si necesitas hacer mantenimiento o si prefieres que no responda durante cierto tiempo.
                </DocAlert>
            </DocSection>

            {/* Idioma */}
            <DocSection title="Idioma">
                <p className="mb-4">
                    Selecciona el idioma de los mensajes del bot:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                            <Globe className="w-6 h-6 text-[#2563eb]" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white">Preferencia de idioma</h4>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                El bot respondera en el idioma seleccionado
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <LanguageOption code="es" name="Espanol" flag="🇪🇸" />
                    <LanguageOption code="en" name="English" flag="🇺🇸" />
                    <LanguageOption code="pt" name="Portugues" flag="🇧🇷" />
                    <LanguageOption code="fr" name="Francais" flag="🇫🇷" />
                </div>
            </DocSection>

            {/* Informacion del Sistema */}
            <DocSection title="Informacion del Sistema">
                <p className="mb-4">
                    Datos tecnicos sobre tu cuenta y el bot:
                </p>
                <div className="space-y-3">
                    <InfoItem
                        label="Version"
                        description="Version actual del bot"
                    />
                    <InfoItem
                        label="ID Unico"
                        description="Identificador unico de tu cuenta"
                    />
                    <InfoItem
                        label="Canal"
                        description="Tu nombre de canal de Twitch"
                    />
                </div>
                <DocAlert type="tip" title="Soporte">
                    Si necesitas soporte, proporciona tu ID unico para que podamos ayudarte mas rapido.
                </DocAlert>
            </DocSection>

            {/* Gestion de Acceso */}
            <DocSection title="Gestion de Acceso">
                <p className="mb-4">
                    Controla quien puede acceder a tu dashboard de Decatron:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Usuarios con acceso</h4>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Agrega moderadores u otros usuarios para que gestionen tu bot
                            </p>
                        </div>
                    </div>
                </div>

                <h4 className="font-bold text-gray-900 dark:text-white mt-6 mb-3">Niveles de permiso</h4>
                <div className="space-y-2">
                    <PermissionLevel
                        level="Control Total"
                        description="Acceso completo a todas las funciones"
                        color="red"
                    />
                    <PermissionLevel
                        level="Moderacion"
                        description="Puede moderar y gestionar alertas"
                        color="orange"
                    />
                    <PermissionLevel
                        level="Comandos"
                        description="Solo puede gestionar comandos"
                        color="blue"
                    />
                </div>

                <div className="mt-4">
                    <Link
                        to="/dashboard/docs/permissions"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#2563eb] font-bold rounded-lg hover:bg-blue-50 dark:hover:bg-[#374151]/80 transition-colors"
                    >
                        Ver guia completa de permisos
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </DocSection>

            {/* Como agregar usuarios */}
            <DocSection title="Como agregar usuarios">
                <div className="space-y-4">
                    <Step number={1} title="Ve a Configuracion">
                        <p>Accede a la pagina de Configuracion desde el menu lateral.</p>
                    </Step>
                    <Step number={2} title="Busca Gestion de Acceso">
                        <p>Desplazate hasta la seccion de gestion de acceso.</p>
                    </Step>
                    <Step number={3} title="Ingresa el nombre de usuario">
                        <p>Escribe el nombre de Twitch del usuario que quieres agregar.</p>
                    </Step>
                    <Step number={4} title="Selecciona el nivel de permiso">
                        <p>Elige que tanto acceso tendra el usuario.</p>
                    </Step>
                    <Step number={5} title="Guarda los cambios">
                        <p>Haz clic en Agregar para confirmar.</p>
                    </Step>
                </div>
            </DocSection>

            {/* Integraciones */}
            <DocSection title="Integraciones">
                <p className="mb-4">
                    Conecta servicios externos para mejorar tu experiencia:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <IntegrationCard
                        name="Spotify"
                        description="Muestra la cancion actual"
                        comingSoon
                    />
                    <IntegrationCard
                        name="Steam"
                        description="Muestra el juego actual"
                        comingSoon
                    />
                    <IntegrationCard
                        name="YouTube"
                        description="Alertas de videos"
                        comingSoon
                    />
                </div>
                <DocAlert type="info" title="Proximamente">
                    Estamos trabajando en mas integraciones. Mantente atento a las actualizaciones.
                </DocAlert>
            </DocSection>
        </div>
    );
}

interface LanguageOptionProps {
    code: string;
    name: string;
    flag: string;
}

function LanguageOption({ code, name, flag }: LanguageOptionProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-3 border border-[#e2e8f0] dark:border-[#374151] text-center">
            <span className="text-2xl mb-1 block">{flag}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
        </div>
    );
}

interface InfoItemProps {
    label: string;
    description: string;
}

function InfoItem({ label, description }: InfoItemProps) {
    return (
        <div className="flex items-center justify-between bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{label}</h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
            <Info className="w-5 h-5 text-[#64748b]" />
        </div>
    );
}

interface PermissionLevelProps {
    level: string;
    description: string;
    color: 'red' | 'orange' | 'blue';
}

const colorStyles = {
    red: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    orange: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
    blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
};

function PermissionLevel({ level, description, color }: PermissionLevelProps) {
    return (
        <div className="flex items-center justify-between bg-white dark:bg-[#1B1C1D] rounded-xl p-3 border border-[#e2e8f0] dark:border-[#374151]">
            <div>
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${colorStyles[color]}`}>
                    {level}
                </span>
            </div>
            <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</span>
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

interface IntegrationCardProps {
    name: string;
    description: string;
    comingSoon?: boolean;
}

function IntegrationCard({ name, description, comingSoon }: IntegrationCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151] relative">
            {comingSoon && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                    Pronto
                </span>
            )}
            <div className="w-10 h-10 bg-[#f8fafc] dark:bg-[#374151] rounded-lg flex items-center justify-center mb-3">
                <Plug className="w-5 h-5 text-[#64748b]" />
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white">{name}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}
