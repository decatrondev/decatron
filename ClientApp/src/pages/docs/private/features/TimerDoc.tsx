import { Clock, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function TimerDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Clock className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Guía del Timer</h1>
                        <p className="text-ds-soft">Un temporizador para el stream que el chat puede alargar con subs, bits, raids y más</p>
                    </div>
                </div>
                <Link
                    to="/overlays/timer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuración
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Qué es */}
            <DocSection title="¿Qué es el Timer?">
                <p className="mb-4">
                    Es un temporizador que se muestra en tu stream con un overlay de OBS. Sirve para maratones tipo «subathon»:
                    empieza con una duración y cada evento del canal (subs, bits, raids, follows, hype train, donaciones) le suma tiempo según las reglas que definas.
                    También puedes controlarlo desde el chat.
                </p>
                <ul className="space-y-2">
                    <DocItem label="Tiempo que se suma">Reglas por tipo de evento, con tiempo base y reglas avanzadas por cantidad.</DocItem>
                    <DocItem label="Control desde el chat">Comandos para iniciar, pausar, reanudar, detener, reiniciar y sumar o restar tiempo.</DocItem>
                    <DocItem label="Overlay personalizable">Tema, barra de progreso, tipografía, alertas, animaciones y widgets.</DocItem>
                    <DocItem label="Automatizaciones">Auto-pausa por horario, Happy Hour que multiplica el tiempo, y arranque y pausa según el stream.</DocItem>
                </ul>
            </DocSection>

            {/* Primeros pasos */}
            <DocSection title="Primeros pasos">
                <ol className="space-y-2 list-decimal pl-5 text-ds-soft">
                    <li>
                        <strong>Entra a Overlays → Timer.</strong> La pestaña <strong>Guía</strong> resume los pasos y tiene el link del overlay.
                    </li>
                    <li>
                        <strong>Define el tiempo inicial</strong> en la pestaña <strong>Básico</strong> (por ejemplo, «24h» o «4d 2h»).
                    </li>
                    <li>
                        <strong>Define cuánto suma cada evento</strong> en la pestaña <strong>Eventos</strong>.
                    </li>
                    <li>
                        <strong>Agrega el overlay a OBS.</strong> Copia el link del overlay y agrégalo como fuente de navegador de 1920×1080.
                        <Link
                            to="/dashboard/docs/overlays"
                            className="inline-flex items-center gap-1 text-ds-accent-text font-medium hover:underline ml-2"
                        >
                            Ver guía de overlays
                            <ExternalLink className="w-3 h-3" />
                        </Link>
                    </li>
                    <li>
                        <strong>Inicia el timer</strong> desde el panel (pestaña Básico) o con <code>!dstart</code> en el chat.
                    </li>
                </ol>
            </DocSection>

            {/* Pestañas */}
            <DocSection title="Pestañas del panel">
                <ul className="space-y-2">
                    <DocItem label="Básico">Tiempo inicial, controles (pausar, reanudar, reiniciar, parada de emergencia), arranque automático al cargar el overlay, reacción al inicio y fin del stream, respaldo de la sesión y las reglas de Game Over.</DocItem>
                    <DocItem label="Eventos">Cuánto tiempo suma cada tipo de evento.</DocItem>
                    <DocItem label="Tema, Barra, Pantalla, Tipografía y Animaciones">El aspecto del timer: colores y fondo, barra de progreso, qué elementos y formato de tiempo se muestran, fuentes y efectos de entrada, salida y cuenta final.</DocItem>
                    <DocItem label="Alertas">Lo que se muestra en pantalla cuando llega un evento que suma tiempo, con un botón de prueba rápida.</DocItem>
                    <DocItem label="Comandos e Info Cmds">Permisos de los comandos de control y mensajes de los comandos informativos.</DocItem>
                    <DocItem label="Sorteos">Sorteos con quienes participaron en una sesión del timer.</DocItem>
                    <DocItem label="Avanzado">Zona horaria, plantillas, auto-pausa por horario y Happy Hour.</DocItem>
                    <DocItem label="Historial">Sesiones anteriores, con el total agregado por tipo de evento, los registros de la sesión y la opción de restaurar.</DocItem>
                    <DocItem label="Media">Tu galería de audio, video e imágenes para las alertas.</DocItem>
                    <DocItem label="Widgets">Elementos de texto sueltos para el overlay: estadísticas en vivo, uptime e indicador de Happy Hour.</DocItem>
                    <DocItem label="Overlay">El link y los datos de conexión con OBS.</DocItem>
                </ul>
            </DocSection>

            {/* Eventos */}
            <DocSection title="Cuánto tiempo suma cada evento">
                <p className="mb-4">
                    En la pestaña <strong>Eventos</strong> eliges un tipo y defines su tiempo. Los tipos son bits, follow, suscripciones
                    (Prime, Tier 1, Tier 2 y Tier 3 por separado), subs regaladas, raids, hype train y donaciones.
                </p>
                <ul className="space-y-2 mb-4">
                    <DocItem label="Tiempo base">Lo que suma el evento. En eventos con cantidad (bits, donaciones, raids, subs regaladas) se define por unidad: por ejemplo, un tiempo por cada cierta cantidad de bits, o por cada viewer de un raid, con un mínimo por raid.</DocItem>
                    <DocItem label="Reglas avanzadas">Un tiempo fijo cuando la cantidad cumple un rango. Por ejemplo, «mínimo 10 subs: 1 hora» suma exactamente 1 hora al recibir 10 subs, en lugar del cálculo base. Si ninguna regla coincide, se usa el cálculo base.</DocItem>
                </ul>
                <DocAlert type="tip" title="Seguimiento del tiempo">
                    En Básico puedes ver el tiempo restante, el transcurrido y lo que se ha agregado. Se puede copiar el valor en segundos.
                </DocAlert>
            </DocSection>

            {/* Comandos */}
            <DocSection title="Comandos de control">
                <p className="mb-4">El tiempo se escribe como «5m», «1h30m», «1d12h» o solo segundos («300»). El máximo al iniciar es de 7 días.</p>
                <ul className="space-y-2 mb-4">
                    <DocItem label="!dstart [tiempo]">Inicia el timer con esa duración (por ejemplo, <code>!dstart 5m</code>).</DocItem>
                    <DocItem label="!dtimer [tiempo]">También inicia el timer con esa duración.</DocItem>
                    <DocItem label="!dtimer add [tiempo]">Suma tiempo al timer activo (por ejemplo, <code>!dtimer add 1h</code>).</DocItem>
                    <DocItem label="!dtimer remove [tiempo]">Resta tiempo (por ejemplo, <code>!dtimer remove 30s</code>). También funciona <code>!dtimer -30s</code>.</DocItem>
                    <DocItem label="!dplay">Reanuda el timer pausado o lo inicia.</DocItem>
                    <DocItem label="!dpause">Pausa el timer.</DocItem>
                    <DocItem label="!dreset">Lo deja detenido en el tiempo total configurado.</DocItem>
                    <DocItem label="!dstop">Detiene el timer completamente y lo oculta del overlay.</DocItem>
                </ul>
                <DocAlert type="info" title="Permisos">
                    Por defecto los usan el streamer y los moderadores. En la pestaña <strong>Comandos</strong> puedes activar o desactivar cada uno,
                    bloquear usuarios, y activar la lista blanca para dar acceso a personas de confianza (por ejemplo, VIPs).
                </DocAlert>
            </DocSection>

            {/* Info */}
            <DocSection title="Comandos informativos">
                <p className="mb-4">Para el chat. Su mensaje se edita en la pestaña <strong>Info Cmds</strong>, con variables y un tiempo mínimo entre usos:</p>
                <ul className="space-y-2">
                    <DocItem label="!dtiempo">El tiempo restante.</DocItem>
                    <DocItem label="!dcuando">Fecha y hora en que terminará.</DocItem>
                    <DocItem label="!dstats">Estadísticas de la sesión activa.</DocItem>
                    <DocItem label="!drecord">El récord histórico del canal.</DocItem>
                    <DocItem label="!dtop">Quienes más aportaron en la sesión.</DocItem>
                </ul>
            </DocSection>

            {/* Game over */}
            <DocSection title="Cuando el tiempo llega a cero">
                <p className="mb-4">En Básico, <strong>Reglas de Game Over</strong> define qué pasa al agotarse el tiempo:</p>
                <ul className="space-y-2">
                    <DocItem label="Muerte súbita">El timer termina.</DocItem>
                    <DocItem label="Resurrección">Tienes de 1 a 99 vidas extra: si el tiempo se agota, una donación o un comando puede revivir el timer gastando una vida. Los mensajes de resurrección y de «sin vidas» son editables y usan <code>{'{lives}'}</code> (usadas) y <code>{'{max}'}</code> (totales).</DocItem>
                </ul>
            </DocSection>

            {/* Automatización */}
            <DocSection title="Automatización">
                <ul className="space-y-2">
                    <DocItem label="Arranque automático">El timer comienza al cargarse el overlay (útil para eventos programados).</DocItem>
                    <DocItem label="Según el stream">Si lo activas, el timer se reanuda al empezar a transmitir y se pausa al terminar, conservando el tiempo.</DocItem>
                    <DocItem label="Auto-pausa por horario">En Avanzado programas momentos en que el timer se detiene solo (dormir, comer…), con nombre, motivo, horas y días.</DocItem>
                    <DocItem label="Happy Hour">En Avanzado multiplicas el tiempo que suman ciertos eventos: ahora mismo por un rato, o programado en días y horas con la zona horaria del canal.</DocItem>
                    <DocItem label="Plantillas">Predefinidas (Subathon, Gaming Marathon, Speedrun) o propias, para aplicar toda la configuración, o solo algunas partes, de una vez.</DocItem>
                </ul>
                <DocAlert type="warning" title="Zona de peligro">
                    En Avanzado existe un restablecimiento de fábrica que borra la configuración visual, las plantillas, los horarios, los Happy Hour y el historial. No se puede deshacer.
                </DocAlert>
            </DocSection>

            {/* Respaldo */}
            <DocSection title="Respaldo y restauración">
                <p className="mb-4">
                    Si se va la luz o se cierra algo por error, en Básico puedes guardar una copia del estado del timer y restaurar una sesión
                    anterior: el timer vuelve en pausa con el tiempo guardado (o con el tiempo que escribas). El Historial lista las sesiones, con el
                    motivo de cierre (parada manual, auto-guardado, respaldo manual o parada de emergencia).
                </p>
            </DocSection>

            {/* Sorteos y widgets */}
            <DocSection title="Sorteos y widgets">
                <ul className="space-y-2">
                    <DocItem label="Sorteos">Crea sorteos con nombre y ganadores. Se puede entrar por bits, por suscripción (eligiendo los tiers), por regalar subs (con un mínimo) o por un follow nuevo, o importar a los participantes de una sesión. Puedes excluir moderadores, VIPs y al streamer, y volver a sortear un puesto.</DocItem>
                    <DocItem label="Widgets">Estadísticas en vivo (subs y bits de hoy, totales, recaudado, eventos), uptime del timer e indicador de Happy Hour. El indicador de Happy Hour solo aparece mientras hay uno activo; usa «Simular Happy Hour» para acomodarlo.</DocItem>
                </ul>
            </DocSection>

            <DocSection title="Consejos">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Prueba rápida">
                        En Alertas, «Prueba rápida» simula un evento en el overlay. Ten cuidado con la opción que suma tiempo real al timer aunque no estés en directo.
                    </DocAlert>
                </div>
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
