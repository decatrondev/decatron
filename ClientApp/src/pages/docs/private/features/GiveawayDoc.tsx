import { Gift, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function GiveawayDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Gift className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Giveaways</h1>
                        <p className="text-ds-soft">Sorteos en el chat con requisitos, pesos y validaciones</p>
                    </div>
                </div>
                <Link
                    to="/features/giveaways"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuración
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Cómo funciona */}
            <DocSection title="Cómo funciona">
                <p className="mb-4">
                    Configuras el premio, los requisitos y los pesos en el panel y lo inicias desde allí. La gente entra escribiendo
                    <code className="mx-1">!join</code> en el chat. Al terminar, el bot elige a los ganadores al azar (con más
                    probabilidad para quienes tengan más peso) y los anuncia en el chat.
                </p>
                <DocAlert type="info" title="Solo desde el panel">
                    El sorteo se inicia, se termina, se cancela y se vuelve a sortear desde el panel. El único comando del chat es <code>!join</code>, para participar.
                </DocAlert>
            </DocSection>

            {/* Pestañas */}
            <DocSection title="Pestañas del panel">
                <ul className="space-y-2">
                    <DocItem label="Crear">Premio, duración, participantes, ganadores y re-sorteo automático.</DocItem>
                    <DocItem label="Requisitos">Quién puede participar.</DocItem>
                    <DocItem label="Pesos">Multiplicadores que suben la probabilidad de ganar.</DocItem>
                    <DocItem label="Activo">Control del giveaway en curso: participantes, ganadores, re-sortear y descalificar.</DocItem>
                    <DocItem label="Historial">Giveaways anteriores y estadísticas, con exportación a CSV o JSON.</DocItem>
                    <DocItem label="Configuración">Anuncios, mensajes y espera para ganadores recientes.</DocItem>
                    <DocItem label="Debug">Herramienta de pruebas que genera participantes de ejemplo (hasta 1000).</DocItem>
                </ul>
                <p className="text-ds-soft mt-3">No puedes guardar cambios mientras hay un giveaway activo.</p>
            </DocSection>

            {/* Crear */}
            <DocSection title="Crear un giveaway">
                <ul className="space-y-2">
                    <DocItem label="Premio">Nombre del giveaway, nombre del premio (obligatorio) y una descripción opcional.</DocItem>
                    <DocItem label="Duración">Con tiempo límite (de 1 a 1440 minutos, termina solo) o manual (lo terminas tú desde el panel).</DocItem>
                    <DocItem label="Participantes">Si un usuario puede entrar varias veces y un límite máximo de participantes.</DocItem>
                    <DocItem label="Ganadores">De 1 a 10 ganadores y, si quieres, de 1 a 5 ganadores de respaldo.</DocItem>
                    <DocItem label="Tiempo de respuesta">Entre 10 y 300 segundos que tiene el ganador para responder antes de ser descalificado.</DocItem>
                    <DocItem label="Re-sorteo automático">Sortear un nuevo ganador si el elegido no responde a tiempo.</DocItem>
                </ul>
            </DocSection>

            {/* Requisitos */}
            <DocSection title="Requisitos de participación">
                <p className="mb-4">Cada requisito se activa o se apaga por separado y se pueden combinar:</p>
                <ul className="space-y-2 mb-4">
                    <DocItem label="Debe seguir el canal">Solo followers.</DocItem>
                    <DocItem label="Debe estar suscrito">Solo suscriptores.</DocItem>
                    <DocItem label="Permitir VIPs y moderadores">Si ellos pueden participar.</DocItem>
                    <DocItem label="Tiempo mínimo viendo">Minutos viendo el stream actual.</DocItem>
                    <DocItem label="Edad mínima de la cuenta">Tiempo desde que se creó la cuenta de Twitch (en días, meses o años).</DocItem>
                    <DocItem label="Tiempo mínimo siguiendo">Tiempo desde que sigue el canal.</DocItem>
                    <DocItem label="Mensajes mínimos en el chat">Mensajes escritos en el stream actual.</DocItem>
                    <DocItem label="Bloquear multicuentas y verificar IP duplicada">Detectan cuentas repetidas y la misma IP.</DocItem>
                    <DocItem label="Lista negra y lista blanca">Usuarios bloqueados; o, con la lista blanca activa, solo los usuarios permitidos.</DocItem>
                </ul>
                <p className="text-ds-soft">Por defecto: debe seguir el canal, 10 minutos viendo, cuenta de al menos 7 días, y bloqueo de multicuentas e IP duplicada activado.</p>
            </DocSection>

            {/* Pesos */}
            <DocSection title="Pesos">
                <p className="mb-4">
                    Un multiplicador de 2.0× significa el doble de probabilidad de ganar. Los multiplicadores se acumulan: por ejemplo,
                    Sub Tier 3 (6.0) y VIP (1.5) dan 9.0×.
                </p>
                <ul className="space-y-2 mb-4">
                    <DocItem label="Suscripción">Un multiplicador para Sub Tier 1, Tier 2 y Tier 3 (por defecto 2, 4 y 6).</DocItem>
                    <DocItem label="VIP">Un multiplicador para VIPs (por defecto 1.5).</DocItem>
                    <DocItem label="Tiempo viendo">Un multiplicador por cada hora viendo; se aplica en cadena (con 1.1×, tres horas dan 1.331×).</DocItem>
                    <DocItem label="Antigüedad de follow">Un multiplicador por cada mes siguiendo.</DocItem>
                    <DocItem label="Bits">Un multiplicador por cada 100 bits donados durante el giveaway.</DocItem>
                    <DocItem label="Racha de suscripción">Un multiplicador por cada mes de racha.</DocItem>
                </ul>
                <p className="text-ds-soft">Por defecto solo están activos los multiplicadores de suscripción, VIP y tiempo viendo.</p>
            </DocSection>

            {/* Activo */}
            <DocSection title="Mientras está activo">
                <p className="mb-4">
                    La pestaña Activo muestra el estado (activo, esperando respuestas, completado o cancelado), los participantes
                    (con búsqueda, y ordenables por peso, nombre o hora de entrada, con sus insignias y su peso) y los ganadores.
                    Desde allí puedes volver a sortear un puesto o descalificar a un ganador.
                </p>
            </DocSection>

            {/* Configuración */}
            <DocSection title="Anuncios y mensajes">
                <ul className="space-y-2 mb-4">
                    <DocItem label="Anunciar al iniciar">Un mensaje en el chat cuando empieza.</DocItem>
                    <DocItem label="Recordatorios">Mensajes periódicos (cada 1 a 30 minutos) mientras está activo.</DocItem>
                    <DocItem label="Contador de participantes">Incluye la cantidad de participantes en los anuncios.</DocItem>
                    <DocItem label="Mensajes">Se editan los de inicio, recordatorio, ganador y sin respuesta, con las variables <code>{'{command}'}</code>, <code>{'{prize}'}</code>, <code>{'{count}'}</code>, <code>{'{winner}'}</code> y <code>{'{timeout}'}</code>.</DocItem>
                    <DocItem label="Espera para ganadores">Quien ganó no puede participar durante los días que elijas (de 1 a 365; por defecto 7).</DocItem>
                </ul>
            </DocSection>

            {/* Overlay */}
            <DocSection title="Overlay">
                <p className="mb-4">
                    El overlay de OBS muestra «Nuevos participantes»: los últimos 10 usuarios que se han unido, cada uno con una animación de entrada.
                    Los ganadores se anuncian en el chat.
                </p>
                <Link
                    to="/dashboard/docs/overlays"
                    className="inline-flex items-center gap-2 text-ds-accent-text font-medium hover:underline"
                >
                    Cómo agregar el overlay a OBS
                    <ExternalLink className="w-4 h-4" />
                </Link>
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
