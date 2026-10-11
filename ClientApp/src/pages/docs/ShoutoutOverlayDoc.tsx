import { Zap } from 'lucide-react';
import CodeBlock from '../../components/docs/CodeBlock';
import DocSection from '../../components/docs/DocSection';

function DocItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2 text-ds-soft">
            <span className="text-ds-accent-text">•</span>
            <span><strong className="text-ds-text">{label}:</strong> {children}</span>
        </li>
    );
}

export default function ShoutoutOverlayDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-ds-bg rounded-lg flex items-center justify-center border border-ds-border">
                        <Zap className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-ds-text">Overlay de Shoutouts</h1>
                        <p className="text-ds-soft mt-1">Presenta a otro streamer con su clip, su foto y su juego cuando alguien usa !so</p>
                    </div>
                </div>
            </div>

            <DocSection title="Qué muestra">
                <p className="mb-4">
                    Cuando alguien escribe <code>!so @usuario</code> en tu chat, el overlay muestra a esa persona. Cada parte se puede prender, apagar,
                    mover y cambiar de tamaño:
                </p>
                <ul className="space-y-2">
                    <DocItem label="Clip">Un clip de la persona (ver «Qué clip se muestra»).</DocItem>
                    <DocItem label="Foto de perfil">La de Twitch, redonda, redondeada o cuadrada.</DocItem>
                    <DocItem label="Textos">Una o más líneas con el nombre, el juego y lo que escribas, con variables.</DocItem>
                    <DocItem label="Insignia">Partner o Afiliado de Twitch (los afiliados se pueden ocultar).</DocItem>
                    <DocItem label="En vivo">Un cartel que aparece si la persona está transmitiendo en ese momento.</DocItem>
                    <DocItem label="Barra de tiempo y contador">La barra se vacía mientras dura el shoutout; el contador muestra los segundos que faltan (sirve para probar y normalmente va apagado).</DocItem>
                </ul>
            </DocSection>

            <DocSection title="Agregarlo a OBS">
                <ol className="space-y-2 list-decimal pl-5 text-ds-soft mb-4">
                    <li>En el panel, entra a <strong>Overlays → Shoutout</strong> y copia el link de la pestaña <strong>Guía</strong>.</li>
                    <li>En OBS agrega una fuente <strong>Navegador</strong> y pega el link.</li>
                    <li>Pon el ancho y el alto que indica la guía. Por defecto son 1000×300, pero cambian si eliges otro diseño.</li>
                    <li>Guarda y usa <strong>Probar en OBS</strong> para ver un shoutout de prueba en tu escena.</li>
                </ol>
                <CodeBlock code={`https://decatron.net/overlay/shoutout?channel=tu_canal`} language="text" />
            </DocSection>

            <DocSection title="Pestañas del panel">
                <ul className="space-y-2">
                    <DocItem label="Guía">Link del overlay y pasos para empezar.</DocItem>
                    <DocItem label="General">Duración en pantalla, espera para repetir a la misma persona (por defecto 30 segundos; en 0, sin espera) y el contador.</DocItem>
                    <DocItem label="Clip">Qué clip se muestra, qué hacer si no hay clips, y volumen del clip.</DocItem>
                    <DocItem label="Tema">Diseños prearmados (Clásico, Tarjeta vertical, Clip con título encima, Barra inferior, Solo texto y foto), temas de color y el fondo (degradado, color sólido o transparente, esquinas, desenfoque, sombra y borde).</DocItem>
                    <DocItem label="Elementos">Prende o apaga cada parte y ajusta cómo se ve.</DocItem>
                    <DocItem label="Texto">Las líneas de texto, sus variables, fuente, color, tamaño, sombra y contorno.</DocItem>
                    <DocItem label="Animaciones">Entrada y salida: fundido, fundido con zoom, deslizar, rebote, salto, zoom, giro, giro 3D o glitch, con dirección, suavizado y duración.</DocItem>
                    <DocItem label="Editor">Un lienzo para arrastrar cada elemento y cambiar su tamaño desde las esquinas.</DocItem>
                    <DocItem label="Automático">Varios seguidos, mensaje en el chat, shoutout nativo de Twitch y shoutout automático a los raids.</DocItem>
                    <DocItem label="Permisos">Quién más puede usar !so y qué canales están bloqueados.</DocItem>
                </ul>
            </DocSection>

            <DocSection title="Qué clip se muestra">
                <ul className="space-y-2">
                    <DocItem label="Al azar">Uno de sus 20 clips más vistos (es lo habitual).</DocItem>
                    <DocItem label="El más visto">Siempre su clip con más vistas.</DocItem>
                    <DocItem label="El más reciente">El último clip que le hicieron.</DocItem>
                    <DocItem label="De los últimos días">Uno al azar dentro del rango que elijas. Si no hay clips en ese rango puedes usar cualquiera, o dejar que el shoutout salga sin clip.</DocItem>
                </ul>
                <p className="text-ds-soft mt-3">
                    Si la persona no tiene clips, en el lugar del clip puedes mostrar su foto, su imagen de canal offline (o su foto si no tiene) o dejar el espacio vacío, y elegir cuánto tiempo se queda.
                    Si el clip termina antes de la duración, el shoutout se va cuando termina.
                </p>
            </DocSection>

            <DocSection title="Variables de texto">
                <p className="mb-4">En las líneas de texto se reemplazan por los datos de la persona:</p>
                <ul className="space-y-2">
                    <DocItem label="@displayname">El nombre como se ve en Twitch.</DocItem>
                    <DocItem label="@username">Su usuario de Twitch, en minúsculas.</DocItem>
                    <DocItem label="@game">El último juego o categoría.</DocItem>
                    <DocItem label="@title">El título de su último stream.</DocItem>
                    <DocItem label="@tags">Las etiquetas de su canal.</DocItem>
                    <DocItem label="@followers">Su cantidad de seguidores.</DocItem>
                    <DocItem label="@clipTitle, @clipViews y @clipCreator">El título del clip, sus vistas y quién lo creó.</DocItem>
                </ul>
            </DocSection>

            <DocSection title="Quién puede usar !so">
                <ul className="space-y-2">
                    <DocItem label="Siempre">Tú y tus moderadores.</DocItem>
                    <DocItem label="Lista de permitidos">En Permisos puedes agregar a otras personas (por ejemplo, VIPs de confianza); los moderadores siguen pudiendo.</DocItem>
                    <DocItem label="Canales bloqueados">A esos canales no se les puede hacer !so: el bot responde con un mensaje en broma.</DocItem>
                </ul>
                <p className="text-ds-soft mt-3">
                    Si repites el !so a la misma persona antes de que pase la espera, el bot responde indicando cuántos segundos faltan.
                    Si el usuario no existe en Twitch, avisa que no existe.
                </p>
            </DocSection>

            <DocSection title="Problemas frecuentes">
                <ul className="space-y-2">
                    <DocItem label="El overlay no aparece en OBS">Revisa que el link sea el de tu canal, que el ancho y el alto coincidan con los de la guía, y actualiza la fuente (clic derecho → Actualizar).</DocItem>
                    <DocItem label="!so no responde">El bot debe estar conectado a tu canal y quien lo usa debe ser moderador o estar en la lista de permitidos. En Kick no está disponible.</DocItem>
                    <DocItem label="No se muestra clip">Es normal si la persona no tiene clips; revisa en la pestaña Clip qué se muestra en ese caso.</DocItem>
                    <DocItem label="Los cambios no se reflejan">Guarda en el panel: el overlay de OBS se actualiza solo. Si no cambia, actualiza la fuente en OBS.</DocItem>
                </ul>
            </DocSection>
        </div>
    );
}
