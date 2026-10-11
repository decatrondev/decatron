import { Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function AIDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Decatron IA</h1>
                        <p className="text-ds-soft">Tu chat le pregunta a la IA con el comando !ia</p>
                    </div>
                </div>
                <Link
                    to="/features/decatron-ai"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuración
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Qué es */}
            <DocSection title="¿Qué es Decatron IA?">
                <p className="mb-4">
                    Es un comando del chat: quien lo use escribe <code>!ia</code> seguido de una pregunta y el bot responde con un mensaje en el chat.
                </p>
                <ul className="space-y-2">
                    <DocItem label="Ejemplos"><code>!ia dame un dato curioso</code> o <code>!ia ¿cuál es el sentido de la vida?</code></DocItem>
                    <DocItem label="Respuesta">Un solo mensaje, que empieza con un prefijo (por defecto el de la plataforma, o uno propio de tu canal) y se recorta si pasa del límite de Twitch.</DocItem>
                    <DocItem label="Idioma">Los mensajes del bot (cooldown, permisos, uso) salen en el idioma del dueño del canal.</DocItem>
                </ul>
            </DocSection>

            {/* Activación */}
            <DocSection title="Cómo activarlo">
                <ol className="space-y-2 list-decimal pl-5 text-ds-soft">
                    <li><strong>Pide el acceso.</strong> Decatron IA se habilita canal por canal desde la administración de Decatron. Mientras tu canal no tenga el permiso, el comando no responde y el panel muestra «Acceso restringido».</li>
                    <li><strong>Entra a Funciones → Decatron IA.</strong> Para configurarlo necesitas nivel de acceso <strong>Control Total</strong> en el canal.</li>
                    <li><strong>Ajusta la configuración</strong> (ver abajo) y guarda.</li>
                </ol>
                <DocAlert type="warning" title="Créditos de IA">
                    Cada respuesta se descuenta de los créditos del dueño del canal. Sin saldo, el comando no responde.
                    Consulta la guía de <Link to="/dashboard/docs/credits/balance" className="underline">Créditos</Link>.
                </DocAlert>
            </DocSection>

            {/* Configuración */}
            <DocSection title="Configuración">
                <p className="mb-4">La pestaña <strong>Configuración</strong> tiene:</p>
                <ul className="space-y-2">
                    <DocItem label="Nivel de permiso">Quién puede usar <code>!ia</code>: todos, suscriptores o más, VIPs o más, moderadores o más, o solo el streamer.</DocItem>
                    <DocItem label="Cooldown del canal">Segundos entre una respuesta y la siguiente en todo el canal. Tiene un mínimo que define la plataforma.</DocItem>
                    <DocItem label="Cooldown por usuario">Opcional: segundos que debe esperar la misma persona para volver a usarlo.</DocItem>
                    <DocItem label="Prefijo personalizado">El texto con el que empieza cada respuesta; si lo dejas vacío se usa el de la plataforma.</DocItem>
                    <DocItem label="Prompt personalizado">Instrucciones propias para la IA (por ejemplo, su personalidad); si lo dejas vacío se usa el de la plataforma.</DocItem>
                </ul>
            </DocSection>

            {/* Usuarios */}
            <DocSection title="Usuarios">
                <ul className="space-y-2">
                    <DocItem label="Whitelist">Si la activas, solo los usuarios de la lista pueden usar <code>!ia</code>, sin importar el nivel de permiso. Apagada, rige el nivel de permiso.</DocItem>
                    <DocItem label="Blacklist">Usuarios bloqueados, que no pueden usarlo.</DocItem>
                </ul>
            </DocSection>

            {/* Estadísticas */}
            <DocSection title="Estadísticas">
                <p>La pestaña <strong>Estadísticas</strong> muestra el total de usos, los de hoy y los de la semana, los usuarios que más lo usan y el uso reciente.</p>
            </DocSection>

            <DocSection title="Relacionado">
                <p>
                    Para conversar con la IA desde el dashboard, sin pasar por el chat del stream, está <Link to="/dashboard/docs/features/decatron-chat" className="underline">Decatron Chat</Link>.
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
