import { Users, Search, Clock, ArrowRight, Bell, UserPlus, UserMinus } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function FollowersDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <Users className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Seguidores
                        </h1>
                        <p className="text-ds-soft">
                            Gestion de seguidores de tu canal
                        </p>
                    </div>
                </div>
                <Link
                    to="/followers"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
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
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Nombre de usuario y avatar
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Fecha en que empezo a seguirte
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Tiempo como seguidor
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Estado de suscripcion (si aplica)
                    </li>
                </ul>
            </DocSection>

            {/* Busqueda */}
            <DocSection title="Buscar seguidores">
                <p className="mb-4">
                    Usa la barra de busqueda para encontrar seguidores especificos:
                </p>
                <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
                    <div className="flex items-center gap-3 bg-ds-bg rounded-lg px-4 py-3">
                        <Search className="w-5 h-5 text-ds-soft" />
                        <span className="text-ds-soft">Buscar por nombre de usuario...</span>
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
                <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
                    <div className="mb-3">
                        <span className="text-sm text-ds-soft">Ejemplo:</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-ds-accent-text">Usuario:</span>
                            <code className="text-ds-accent-text">!followage</code>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-ds-accent-text">Bot:</span>
                            <span className="text-ds-soft">@Usuario, llevas siguiendo a Canal por 2 años, 3 meses y 15 dias</span>
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
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Exportar a CSV
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Filtrar por fecha
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
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
        <div className="flex items-center gap-4 bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="w-10 h-10 bg-ds-accent rounded-full flex items-center justify-center text-white font-bold">
                {name[0]}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-ds-text">{name}</span>
                    {isNew && (
                        <span className="px-2 py-0.5 bg-ds-raised text-ds-accent-text text-xs rounded-full">
                            Nuevo
                        </span>
                    )}
                </div>
                <span className="text-sm text-ds-soft">{time}</span>
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
