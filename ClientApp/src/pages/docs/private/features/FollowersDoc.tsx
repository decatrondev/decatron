import { Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function FollowersDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Users className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Seguidores</h1>
                        <p className="text-ds-soft">Administra y analiza tu comunidad de seguidores de Twitch</p>
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

            {/* Qué es */}
            <DocSection title="Qué muestra">
                <p className="mb-4">
                    Una lista de los seguidores de tu canal que Decatron guarda y mantiene al día sincronizándola con Twitch. Además de quién te sigue ahora,
                    registra quién dejó de seguirte y quién volvió.
                </p>
                <ul className="space-y-2">
                    <DocItem label="Total">Todos los seguidores registrados.</DocItem>
                    <DocItem label="Activos">Los que te siguen actualmente.</DocItem>
                    <DocItem label="Unfollows">Los que dejaron de seguirte.</DocItem>
                    <DocItem label="Retornados">Los que dejaron de seguirte y volvieron a hacerlo.</DocItem>
                    <DocItem label="Bloqueados">Los que marcaste como bloqueados (ver más abajo).</DocItem>
                </ul>
            </DocSection>

            {/* Sincronizar */}
            <DocSection title="Sincronizar con Twitch">
                <p className="mb-4">
                    El botón <strong>Sincronizar</strong> actualiza la lista con Twitch y al terminar muestra cuántos seguidores nuevos, retornados y unfollows encontró.
                    También puedes activar la <strong>sincronización automática</strong> y elegir cada cuánto se repite: 5, 10, 15 o 30 minutos, 1 hora o 24 horas.
                    El panel indica la fecha de la última sincronización.
                </p>
            </DocSection>

            {/* Buscar */}
            <DocSection title="Buscar y filtrar">
                <ul className="space-y-2">
                    <DocItem label="Búsqueda">Por nombre o nombre de usuario; se busca sola mientras escribes.</DocItem>
                    <DocItem label="Filtros rápidos">Todos, Activos, Unfollows o Retornados.</DocItem>
                    <DocItem label="Filtros avanzados">Por rango de fecha de follow (desde y hasta).</DocItem>
                    <DocItem label="Historial">Cada seguidor tiene un historial de sus movimientos: follow, unfollow, bloqueo y desbloqueo, con fecha y hora.</DocItem>
                </ul>
                <p className="text-ds-soft mt-3">La lista se pagina, con botones para ir a la primera, anterior, siguiente y última página.</p>
            </DocSection>

            {/* Bloqueo */}
            <DocSection title="Bloquear y desbloquear">
                <p className="mb-4">
                    Con nivel de acceso <strong>Moderación</strong> o superior puedes bloquear o desbloquear a un seguidor, o seleccionar varios y hacerlo en bloque
                    (con una confirmación antes). Sin ese nivel la página funciona en modo limitado: puedes ver la lista, pero no bloquear.
                </p>
                <DocAlert type="info" title="Es una marca de Decatron">
                    El bloqueo queda registrado en la lista de seguidores de Decatron, con su historial. No bloquea a la persona en Twitch.
                </DocAlert>
            </DocSection>

            {/* Followage */}
            <DocSection title="Comando !followage">
                <p className="mb-4">
                    En el chat, <code>!followage</code> muestra cuánto tiempo lleva la persona siguiendo el canal, y <code>!followage @usuario</code> lo muestra para otro usuario.
                    Está disponible para todos y solo en Twitch.
                </p>
            </DocSection>

            {/* Alertas */}
            <DocSection title="Alertas de follow">
                <p>
                    Las alertas y el mensaje del bot cuando alguien te sigue se configuran en la
                    guía de <Link to="/dashboard/docs/features/event-alerts" className="underline">Alertas de eventos</Link>, en la pestaña Eventos → Follows.
                </p>
            </DocSection>
        </div>
    );
}

function DocItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2 text-ds-soft">
            <span className="text-ds-accent-text">•</span>
            <span><strong className="text-ds-text">{label}:</strong> {children}</span>
        </li>
    );
}
