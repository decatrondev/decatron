import { Users, Search, Clock, ArrowRight, Bell, UserPlus, UserMinus } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function FollowersDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl flex items-center justify-center">
                        <Users className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Seguidores
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Gestion de seguidores de tu canal
                        </p>
                    </div>
                </div>
                <Link
                    to="/followers"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ver seguidores
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Lista de seguidores */}
            <DocSection title="Lista de seguidores">
                <p className="mb-4">
                    Ve la lista completa de seguidores de tu canal con informacion detallada:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Nombre de usuario y avatar
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Fecha en que empezo a seguirte
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Tiempo como seguidor
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Estado de suscripcion (si aplica)
                    </li>
                </ul>
            </DocSection>

            {/* Busqueda */}
            <DocSection title="Buscar seguidores">
                <p className="mb-4">
                    Usa la barra de busqueda para encontrar seguidores especificos:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center gap-3 bg-[#f8fafc] dark:bg-[#374151] rounded-lg px-4 py-3">
                        <Search className="w-5 h-5 text-[#64748b]" />
                        <span className="text-[#64748b] dark:text-[#94a3b8]">Buscar por nombre de usuario...</span>
                    </div>
                </div>
            </DocSection>

            {/* Seguidores recientes */}
            <DocSection title="Seguidores recientes">
                <p className="mb-4">
                    Ve los ultimos seguidores de tu canal ordenados por fecha:
                </p>
                <div className="space-y-3">
                    <FollowerExample name="StreamerPro" time="Hace 5 minutos" isNew />
                    <FollowerExample name="ViewerFan" time="Hace 1 hora" isNew />
                    <FollowerExample name="TwitchUser" time="Hace 3 horas" />
                    <FollowerExample name="CoolViewer" time="Hace 1 dia" />
                </div>
            </DocSection>

            {/* Comando followage */}
            <DocSection title="Comando !followage">
                <p className="mb-4">
                    Los usuarios pueden ver cuanto tiempo llevan siguiendote:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="mb-3">
                        <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">Ejemplo:</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-purple-500">Usuario:</span>
                            <code className="text-[#2563eb]">!followage</code>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-[#2563eb]">Bot:</span>
                            <span className="text-[#64748b] dark:text-[#94a3b8]">@Usuario, llevas siguiendo a Canal por 2 años, 3 meses y 15 dias</span>
                        </div>
                    </div>
                </div>
            </DocSection>

            {/* Notificaciones */}
            <DocSection title="Notificaciones de follows">
                <p className="mb-4">
                    Configura alertas cuando alguien nuevo te sigue:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NotificationOption
                        icon={<Bell className="w-5 h-5" />}
                        title="Alerta en overlay"
                        description="Muestra una notificacion visual"
                    />
                    <NotificationOption
                        icon={<UserPlus className="w-5 h-5" />}
                        title="Mensaje en chat"
                        description="Envia un mensaje de bienvenida"
                    />
                </div>
                <DocAlert type="tip" title="Personaliza">
                    Configura alertas de follow en la seccion de Alertas de Eventos.
                </DocAlert>
            </DocSection>

            {/* Exportar */}
            <DocSection title="Exportar lista">
                <p className="mb-4">
                    Puedes exportar tu lista de seguidores:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Exportar a CSV
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Filtrar por fecha
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Incluir datos adicionales
                    </li>
                </ul>
            </DocSection>
        </div>
    );
}

interface FollowerExampleProps {
    name: string;
    time: string;
    isNew?: boolean;
}

function FollowerExample({ name, time, isNew }: FollowerExampleProps) {
    return (
        <div className="flex items-center gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-[#2563eb] rounded-full flex items-center justify-center text-white font-bold">
                {name[0]}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white">{name}</span>
                    {isNew && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-full">
                            Nuevo
                        </span>
                    )}
                </div>
                <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{time}</span>
            </div>
        </div>
    );
}

interface NotificationOptionProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function NotificationOption({ icon, title, description }: NotificationOptionProps) {
    return (
        <div className="flex items-start gap-3 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg flex items-center justify-center text-cyan-600 dark:text-cyan-400 flex-shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
        </div>
    );
}
