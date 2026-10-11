import { MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function DecatronChatDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Decatron Chat</h1>
                        <p className="text-ds-soft">Chat con la IA de Decatron desde tu dashboard</p>
                    </div>
                </div>
                <Link
                    to="/features/decatron-chat"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir al chat
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Qué es */}
            <DocSection title="¿Qué es Decatron Chat?">
                <p>
                    Es un asistente de IA dentro de tu dashboard. Le haces preguntas, le pides ayuda con tu stream o con código, y las conversaciones se guardan
                    para que continúes donde las dejaste. Cada conversación la ve solo quien la creó, dentro de ese canal; los espectadores no tienen acceso.
                </p>
            </DocSection>

            {/* Acceso */}
            <DocSection title="Quién puede usarlo">
                <ul className="space-y-2">
                    <DocItem label="Activación">El chat se activa para toda la plataforma desde la administración de Decatron. Si está apagado, la página muestra «El sistema de chat está deshabilitado».</DocItem>
                    <DocItem label="Dueño del canal">Siempre tiene acceso completo.</DocItem>
                    <DocItem label="Otras personas del canal">Necesitan un permiso que otorga el equipo de Decatron: solo ver las conversaciones, o también escribir. Con permiso de solo lectura aparece «Solo puedes ver conversaciones».</DocItem>
                </ul>
                <DocAlert type="warning" title="Créditos">
                    Cada mensaje consume créditos de IA. Si no tienes saldo, el mensaje no se envía y el chat te avisa que compres un plan o un paquete de créditos.
                    Consulta la guía de <Link to="/dashboard/docs/credits/balance" className="underline">Créditos</Link>.
                </DocAlert>
            </DocSection>

            {/* Cómo usar */}
            <DocSection title="Cómo usarlo">
                <ol className="space-y-2 list-decimal pl-5 text-ds-soft">
                    <li>Abre <strong>Decatron Chat</strong> desde el menú de Funciones.</li>
                    <li>Crea una conversación con el botón «+» del panel izquierdo.</li>
                    <li>Escribe tu mensaje y envíalo con Enter (Shift+Enter hace un salto de línea).</li>
                    <li>La respuesta aparece mientras se genera. Con «Detener» puedes cortarla.</li>
                </ol>
            </DocSection>

            {/* Conversaciones */}
            <DocSection title="Conversaciones y respuestas">
                <ul className="space-y-2">
                    <DocItem label="Varias conversaciones">Cada una guarda su propio historial; haz clic en una del panel para retomarla. La IA recibe los mensajes recientes de esa conversación como contexto.</DocItem>
                    <DocItem label="Eliminar">Borra una conversación; no se puede deshacer.</DocItem>
                    <DocItem label="Continuar">Si una respuesta larga se corta, el botón «Continue» de la respuesta sigue generándola desde donde quedó.</DocItem>
                    <DocItem label="Código">Los bloques de código se pueden copiar. Si es HTML, CSS o JavaScript, un botón abre una vista previa en vivo, y el botón «Editar» pone el código en el cuadro de mensaje con la petición «Modifica este código» para que escribas los cambios.</DocItem>
                    <DocItem label="Uso">Cada respuesta indica los tokens usados y cuánto tardó.</DocItem>
                </ul>
            </DocSection>

            {/* Diferencia */}
            <DocSection title="Decatron Chat y Decatron IA">
                <div className="overflow-x-auto rounded-lg border border-ds-border">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-ds-bg border-b border-ds-border">
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Característica</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Decatron Chat</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Decatron IA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ds-border">
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-ds-text">Dónde funciona</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">En el dashboard</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">En el chat del stream</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-ds-text">Quién lo usa</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Quien tiene acceso al panel</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Los espectadores, según el nivel que elijas</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-ds-text">Historial</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Conversaciones guardadas</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Cada pregunta es independiente</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-ds-text">Cómo se usa</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Ventana de chat</td>
                                <td className="px-4 py-3 text-sm text-ds-soft"><code>!ia</code> en el chat</td>
                            </tr>
                        </tbody>
                    </table>
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
