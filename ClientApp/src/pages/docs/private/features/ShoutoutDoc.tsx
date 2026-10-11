import { MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function ShoutoutDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Shoutouts</h1>
                        <p className="text-ds-soft">Presenta a otro streamer con su clip, su foto y su juego</p>
                    </div>
                </div>
                <Link
                    to="/overlays/shoutout"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuración
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Cómo funciona */}
            <DocSection title="Cómo funciona">
                <p className="mb-4">
                    Cada shoutout hace tres cosas: muestra un overlay en OBS con la persona, escribe un mensaje en el chat y, si lo activas,
                    hace también el shoutout nativo de Twitch.
                </p>
                <p>
                    El diseño del overlay (clip, foto, textos, animaciones, variables y permisos) está explicado en la{' '}
                    <Link to="/dashboard/docs/overlays/shoutout" className="underline">guía del overlay de Shoutouts</Link>.
                </p>
            </DocSection>

            {/* Comando */}
            <DocSection title="Comando !so">
                <p className="mb-4">
                    Escribe <code>!so @usuario</code> o <code>!so usuario</code>. Por defecto lo usan el streamer y los moderadores; en la pestaña
                    <strong> Permisos</strong> puedes agregar a otras personas. No está disponible en Kick.
                </p>
                <DocAlert type="info" title="Espera entre shoutouts">
                    Para no repetir a la misma persona hay una espera (30 segundos por defecto, configurable en la pestaña General). Si alguien repite el comando antes,
                    el bot responde cuántos segundos faltan.
                </DocAlert>
            </DocSection>

            {/* Automático */}
            <DocSection title="Pestaña Automático">
                <ul className="space-y-3 text-ds-soft">
                    <Item label="Varios seguidos">Si alguien hace !so mientras hay otro en pantalla, espera su turno (hasta 10). Apagado, el nuevo reemplaza al que se está viendo.</Item>
                    <Item label="Mensaje en el chat">El bot escribe un mensaje con cada shoutout. Puedes escribir el tuyo con variables que empiezan con @ (<code>@displayname</code>, <code>@username</code>, <code>@game</code>, <code>@title</code>, <code>@tags</code>, <code>@followers</code>, <code>@clipTitle</code>, <code>@clipViews</code>, <code>@clipCreator</code> y <code>@url</code>). Para mencionar a la persona escribe una @ antes: <code>@@username</code>. Si lo dejas vacío se usa el mensaje de siempre, en el idioma de tu canal.</Item>
                    <Item label="Shoutout nativo de Twitch">Muestra en el chat la tarjeta de Twitch con el botón Seguir y le aparece a la persona en su panel. Twitch permite uno cada 2 minutos en tu canal y uno por hora a la misma persona, y solo con tu canal en vivo; el bot debe ser moderador de tu canal y tener el permiso <code>moderator:manage:shoutouts</code>. Si no se puede, igual salen el overlay y el mensaje del chat. El panel muestra el estado y el resultado del último intento.</Item>
                    <Item label="Shoutout a los raids">Cuando alguien te hace raid, el bot le hace el shoutout solo, sin que nadie escriba !so. Puedes pedir un mínimo de espectadores y una espera antes del shoutout para que no se encime con la alerta del raid.</Item>
                </ul>
            </DocSection>
        </div>
    );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2">
            <span className="text-ds-accent-text">•</span>
            <span><strong className="text-ds-text">{label}:</strong> {children}</span>
        </li>
    );
}
