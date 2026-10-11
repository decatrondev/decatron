import { Bell, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function EventAlertsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Bell className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Alertas de eventos</h1>
                        <p className="text-ds-soft">Follows, bits, subs, regalos, raids, resubs y hype train en tu stream</p>
                    </div>
                </div>
                <Link
                    to="/overlays/event-alerts"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuración
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Eventos */}
            <DocSection title="Qué eventos avisan">
                <p className="mb-4">
                    Las alertas se disparan con los eventos de tu canal de Twitch. Cada tipo tiene su pestaña dentro de <strong>Eventos</strong>:
                </p>
                <ul className="space-y-2">
                    <DocItem label="Follows">Alguien sigue tu canal. Tiene un anti-spam por usuario (activado por defecto, 24 horas): el mismo usuario no repite la alerta si deja de seguirte y vuelve a seguirte.</DocItem>
                    <DocItem label="Bits">Alguien usa bits. Se puede dar una alerta distinta según la cantidad.</DocItem>
                    <DocItem label="Subs">Una sub nueva, con su propia alerta para Prime, Tier 1, Tier 2 y Tier 3.</DocItem>
                    <DocItem label="Subs regaladas">Alguien regala subs a la comunidad; la cantidad regalada decide el nivel.</DocItem>
                    <DocItem label="Raids">Otro canal te hace raid; la cantidad de viewers decide el nivel.</DocItem>
                    <DocItem label="Resubs">Una sub que se renueva, con los meses y el mensaje del usuario; los meses de antigüedad deciden el nivel.</DocItem>
                    <DocItem label="Hype Train">Una alerta por cada nivel del hype train (del 1 al 5) y otra para cuando se completa.</DocItem>
                </ul>
                <DocAlert type="info" title="Solo Twitch">
                    Estas alertas no se disparan con eventos de Kick. Para las recompensas canjeadas con puntos del canal,
                    en Twitch y en Kick, usa <Link to="/dashboard/docs/features/sound-alerts" className="underline">Sound Alerts</Link>.
                </DocAlert>
            </DocSection>

            {/* Primeros pasos */}
            <DocSection title="Primeros pasos">
                <ol className="space-y-2 list-decimal pl-5 text-ds-soft">
                    <li><strong>Agrega el overlay a OBS.</strong> En la pestaña <strong>Guía</strong> copia el link y agrégalo como fuente de navegador, con el ancho y el alto que indica la guía (por defecto 1920×1080). Marca «Controlar audio mediante OBS» si quieres manejar el volumen desde el mezclador.</li>
                    <li><strong>Configura cada evento</strong> en la pestaña <strong>Eventos</strong>.</li>
                    <li><strong>Dale el diseño</strong> en la pestaña <strong>Diseño</strong>.</li>
                    <li><strong>Guarda y prueba</strong> con «Probar en OBS» en la vista previa. El overlay usa lo nuevo desde la próxima alerta.</li>
                </ol>
            </DocSection>

            {/* Pestañas */}
            <DocSection title="Pestañas del panel">
                <ul className="space-y-2">
                    <DocItem label="Guía">Pasos y link del overlay.</DocItem>
                    <DocItem label="General">Alertas activadas o apagadas, duración, volumen, animación, posición y tamaño del lienzo por defecto, cola de alertas, esperas entre alertas y la voz (TTS) que usan todos los eventos salvo que uno tenga la suya.</DocItem>
                    <DocItem label="Eventos">La alerta de cada evento: mensaje, duración, volumen, multimedia, sonido, animación y efectos, voz, mensaje del bot en el chat, niveles por cantidad y variantes.</DocItem>
                    <DocItem label="Diseño">Cómo se ve la alerta: un diseño general para todas y, si quieres, uno propio por evento (en el hype train, también por nivel). Incluye el editor visual, diseños prearmados, temas de color y animaciones.</DocItem>
                    <DocItem label="Avanzado">Los ajustes de estilo de la tarjeta (fondo, borde y forma, tipografía y ajuste de la multimedia).</DocItem>
                    <DocItem label="Media">Tu galería de audio, video e imágenes para usar en las alertas.</DocItem>
                    <DocItem label="Pruebas">Envía una alerta de prueba de cualquier evento con el nombre y la cantidad que elijas.</DocItem>
                </ul>
            </DocSection>

            {/* Configurar alertas */}
            <DocSection title="La alerta de cada evento">
                <ul className="space-y-2">
                    <DocItem label="Mensaje">El texto de la alerta, con variables.</DocItem>
                    <DocItem label="Duración y volumen">De 1 a 30 segundos y de 0 a 100.</DocItem>
                    <DocItem label="Multimedia y sonido">Una imagen, un video o un audio que acompaña la alerta.</DocItem>
                    <DocItem label="Animación y efectos">Entrada y salida (fundido, deslizar, deslizar con rebote, rebote, zoom, giro, giro 3D o glitch) y efectos que se pueden combinar: brillo, confeti y fuegos artificiales; de sacudida, flotar y pulso va uno solo.</DocItem>
                    <DocItem label="Mensaje del bot en el chat">El bot puede escribir un mensaje en el chat cuando llega la alerta.</DocItem>
                </ul>
            </DocSection>

            {/* Niveles */}
            <DocSection title="Niveles por cantidad">
                <p className="mb-4">
                    En bits, subs regaladas, raids y resubs puedes crear niveles según la cantidad. Cada nivel tiene su propia alerta,
                    y la condición puede ser un rango (por ejemplo, de 100 a 499), un mínimo (500 o más) o una cantidad exacta.
                    Además existe una <strong>alerta base</strong>, que suena siempre; los niveles pueden sobrescribirla.
                </p>
                <DocAlert type="tip" title="Consejo">
                    Para los niveles nuevos, el panel propone valores crecientes (más duración, más volumen y más efectos),
                    que puedes cambiar a tu gusto.
                </DocAlert>
            </DocSection>

            {/* Variantes */}
            <DocSection title="Variantes">
                <p className="mb-4">
                    Una alerta puede tener varias variantes (mensaje, multimedia, sonido, voz) y el bot elige una cada vez.
                    El modo de elección puede ser:
                </p>
                <ul className="space-y-2 mb-4">
                    <DocItem label="Aleatorio">Todas con la misma probabilidad.</DocItem>
                    <DocItem label="Por peso">Cada variante tiene un peso de 1 a 100 que decide su probabilidad.</DocItem>
                    <DocItem label="Secuencial">En orden, una tras otra.</DocItem>
                    <DocItem label="Sin repetir">Usa todas antes de repetir; se reinicia al terminar o pasado un tiempo que eliges.</DocItem>
                </ul>
                <p className="text-ds-soft">El editor permite hasta 5 variantes por alerta.</p>
            </DocSection>

            {/* Variables */}
            <DocSection title="Variables">
                <p className="mb-4">En los mensajes, la voz y el mensaje del chat puedes usar:</p>
                <ul className="space-y-2">
                    <DocItem label="{username}">Quien hizo el evento (también valen {'{user}'} y {'{userName}'}).</DocItem>
                    <DocItem label="{amount}">La cantidad: bits, subs regaladas o viewers del raid.</DocItem>
                    <DocItem label="{tier}">El tier de la sub (Prime, Tier 1, Tier 2 o Tier 3).</DocItem>
                    <DocItem label="{months}">Los meses de una resub.</DocItem>
                    <DocItem label="{level}">El nivel del hype train.</DocItem>
                    <DocItem label="{message}">El mensaje que escribió el usuario, en los eventos que lo traen.</DocItem>
                </ul>
                <p className="text-ds-soft mt-3">
                    En el editor de la pestaña Diseño también están disponibles el emoji, el título y el nombre del evento, la hora y la fecha.
                </p>
            </DocSection>

            {/* Cola */}
            <DocSection title="Cola de alertas">
                <p className="mb-4">
                    Si llegan varias alertas juntas, esperan su turno y salen una por una. En <strong>General</strong> puedes ajustar:
                </p>
                <ul className="space-y-2">
                    <DocItem label="Cola activada">Si la apagas, cada alerta se muestra apenas llega, aunque haya otra en pantalla.</DocItem>
                    <DocItem label="Tamaño máximo">De 1 a 50 alertas pendientes. Si se llena, se descartan las más antiguas.</DocItem>
                    <DocItem label="Espera entre alertas">De 0 a 10 000 ms entre el final de una y el comienzo de la siguiente.</DocItem>
                    <DocItem label="Contador de la cola">Muestra cuántas alertas faltan.</DocItem>
                    <DocItem label="Cooldowns">Un tiempo mínimo (de 0 a 60 segundos) entre cualquier alerta y otro entre alertas del mismo tipo, para evitar spam.</DocItem>
                </ul>
                <p className="text-ds-soft mt-3">La cola vive en el overlay: si recargas la fuente en OBS, se vacía.</p>
            </DocSection>

            {/* TTS */}
            <DocSection title="Voz (Text-to-Speech)">
                <p className="mb-4">
                    Cada evento puede leer su mensaje en voz alta. Hay dos motores:
                </p>
                <ul className="space-y-2 mb-4">
                    <DocItem label="Voz estándar">Incluida en tu plan.</DocItem>
                    <DocItem label="Voz premium">Gasta créditos premium y ofrece más idiomas. Si te quedas sin créditos, la alerta no se queda muda: se lee con la voz estándar.</DocItem>
                </ul>
                <p className="text-ds-soft mb-3">
                    Puedes leer el mensaje de la alerta, el mensaje del usuario (con un máximo de caracteres) y elegir si la voz espera a que termine el sonido de la alerta.
                    La voz general se define en <strong>General</strong> y cada evento puede cambiarla.
                </p>
                <DocAlert type="info" title="Vista previa">
                    En la vista previa, «Reproducir» suena con el sonido y el video de la alerta; la voz se escucha con «Probar en OBS».
                </DocAlert>
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
