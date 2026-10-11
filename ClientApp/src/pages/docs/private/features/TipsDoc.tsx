import { DollarSign, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function TipsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <DollarSign className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Donaciones / Tips</h1>
                        <p className="text-ds-soft">Recibe donaciones con PayPal, con alertas y tiempo para el timer</p>
                    </div>
                </div>
                <Link
                    to="/features/tips"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuración
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Cómo funciona */}
            <DocSection title="Cómo funciona">
                <p className="mb-4">
                    Tu audiencia dona desde una página pública con tu nombre, paga con PayPal y el dinero va directo a la cuenta de PayPal que conectaste.
                    Decatron no retiene ningún porcentaje; solo aplican las comisiones de PayPal. La donación dispara una alerta en tu stream y, si
                    quieres, suma tiempo al timer.
                </p>
                <DocAlert type="info" title="Dinero y datos de pago">
                    Los pagos se procesan en PayPal. Los reembolsos se gestionan directamente allí.
                </DocAlert>
            </DocSection>

            {/* Primeros pasos */}
            <DocSection title="Primeros pasos">
                <ol className="space-y-2 list-decimal pl-5 text-ds-soft">
                    <li><strong>Conecta PayPal.</strong> En la pestaña <strong>General</strong> pulsa «Conectar PayPal» e inicia sesión. Las donaciones se envían al correo de esa cuenta.</li>
                    <li><strong>Define los montos.</strong> En General eliges la moneda, el monto mínimo y máximo y los montos sugeridos (los botones rápidos de la página).</li>
                    <li><strong>Activa el sistema de Tips.</strong> Mientras esté apagado, tu página de donaciones muestra que no está disponible.</li>
                    <li><strong>Comparte tu enlace:</strong> <code>https://decatron.net/tip/tu-canal</code>. El panel lo muestra listo para copiar.</li>
                    <li><strong>Agrega las alertas a OBS</strong> (ver más abajo).</li>
                </ol>
                <p className="text-ds-soft mt-3">Monedas disponibles: USD, EUR, GBP, MXN, ARS, COP, CLP, BRL y PEN.</p>
            </DocSection>

            {/* Pestañas */}
            <DocSection title="Pestañas del panel">
                <ul className="space-y-2">
                    <DocItem label="General">Activar Tips, conectar PayPal, moneda, mínimo, máximo y montos sugeridos.</DocItem>
                    <DocItem label="Página">Título, descripción, color de acento e imagen de fondo (por URL) de la página de donaciones.</DocItem>
                    <DocItem label="Alertas">Elige cómo se avisan las donaciones (ver más abajo).</DocItem>
                    <DocItem label="Timer">Cuánto tiempo suma cada donación.</DocItem>
                    <DocItem label="Seguridad">Longitud máxima del mensaje (de 1 a 500), espera entre donaciones, filtro de palabras prohibidas y mensaje obligatorio.</DocItem>
                    <DocItem label="Historial">Estadísticas por periodo (hoy, semana, mes, año o todo el tiempo) y donaciones recientes.</DocItem>
                </ul>
            </DocSection>

            {/* Página */}
            <DocSection title="Lo que ve quien dona">
                <p className="mb-4">En tu página escribe su nombre (se muestra en el stream), elige o escribe un monto dentro de tu mínimo y tu máximo, agrega un mensaje y paga con PayPal.</p>
                <ul className="space-y-2">
                    <DocItem label="Mensaje">Opcional, o requerido si activas «Requerir mensaje».</DocItem>
                    <DocItem label="Filtro de palabras">Si lo activas, usa la misma lista de palabras prohibidas de la moderación del chat.</DocItem>
                    <DocItem label="Espera entre donaciones">Segundos que debe esperar antes de donar de nuevo (0 = sin espera).</DocItem>
                    <DocItem label="Confirmación">Al terminar ve un agradecimiento y, si el timer suma tiempo, cuánto añadió su donación.</DocItem>
                </ul>
            </DocSection>

            {/* Alertas */}
            <DocSection title="Alertas de donación">
                <p className="mb-4">En la pestaña Alertas eliges uno de dos sistemas:</p>
                <ul className="space-y-2 mb-4">
                    <DocItem label="Sistema del Timer (por defecto)">Usa el mismo sistema que las alertas de bits, subs y raids del Timer: variantes, multimedia, voz y más. Se configura en la pestaña Alertas del Timer, en «Donaciones», donde puedes crear variantes según el monto. El tiempo que suma la donación sale de las reglas del evento «Donaciones» de la pestaña Eventos del Timer. Si el timer está apagado o detenido y no puede procesar la donación, se muestra la alerta independiente.</DocItem>
                    <DocItem label="Alertas independientes">Un sistema propio para Tips, con sonido, voz, multimedia y niveles por monto. Su overlay para OBS es el link «Overlay OBS» que muestra el panel de Tips. Aquí el tiempo que suma la donación sale de la pestaña Timer de Tips.</DocItem>
                </ul>
            </DocSection>

            {/* Timer */}
            <DocSection title="Integración con el Timer">
                <p className="mb-4">
                    En la pestaña Timer de Tips activas la integración con el Timer y defines cuánto tiempo vale cada 1 unidad de tu moneda, en segundos, minutos,
                    horas o días. El panel muestra un ejemplo de cuánto sumará una donación. Útil para subathons en los que las donaciones alargan el stream.
                </p>
                <DocAlert type="info" title="Con el sistema de alertas del Timer">
                    Si usas el sistema de alertas del Timer, el tiempo de cada donación lo deciden las reglas del evento «Donaciones» del Timer (tiempo base y reglas
                    avanzadas por monto). Consulta la <Link to="/dashboard/docs/features/timer" className="underline">guía del Timer</Link>.
                </DocAlert>
            </DocSection>

            {/* Historial */}
            <DocSection title="Historial y estadísticas">
                <p className="mb-4">La pestaña Historial muestra, para el periodo que elijas:</p>
                <ul className="space-y-2">
                    <DocItem label="Estadísticas">Total recaudado, cantidad de donaciones, promedio, tiempo añadido y el top donante.</DocItem>
                    <DocItem label="Donaciones recientes">Quién donó, el monto, el mensaje si dejó uno y el tiempo que sumó.</DocItem>
                </ul>
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
