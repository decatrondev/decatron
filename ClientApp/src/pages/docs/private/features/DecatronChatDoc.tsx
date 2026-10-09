import { MessageSquare, Plus, Trash2, Send, ArrowRight, Brain, Lock, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function DecatronChatDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Decatron Chat
                        </h1>
                        <p className="text-ds-soft">
                            Chat privado con la IA de Decatron desde tu dashboard
                        </p>
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

            {/* Que es */}
            <DocSection title="Que es Decatron Chat?">
                <p>
                    Decatron Chat es un asistente de IA privado dentro de tu dashboard. Puedes hacerle preguntas,
                    pedirle ayuda con la configuracion del bot, o simplemente conversar. Las conversaciones
                    se guardan y puedes continuar donde lo dejaste.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FeatureCard
                        icon={<Brain className="w-5 h-5" />}
                        title="IA inteligente"
                        description="Respuestas contextuales y utiles"
                    />
                    <FeatureCard
                        icon={<History className="w-5 h-5" />}
                        title="Historial"
                        description="Multiples conversaciones guardadas"
                    />
                    <FeatureCard
                        icon={<Lock className="w-5 h-5" />}
                        title="Privado"
                        description="Solo tu puedes ver tus conversaciones"
                    />
                </div>
            </DocSection>

            {/* Como usar */}
            <DocSection title="Como usar">
                <div className="space-y-3">
                    <StepItem number={1} text="Abre Decatron Chat desde el menu lateral del dashboard" />
                    <StepItem number={2} text="Crea una nueva conversacion con el boton '+'" />
                    <StepItem number={3} text="Escribe tu mensaje y presiona Enter o el boton de enviar" />
                    <StepItem number={4} text="La IA respondera en tiempo real con streaming de texto" />
                </div>
            </DocSection>

            {/* Conversaciones */}
            <DocSection title="Gestionar conversaciones">
                <div className="space-y-4">
                    <ActionItem
                        icon={<Plus className="w-5 h-5" />}
                        title="Nueva conversacion"
                        description="Crea una conversacion nueva para un tema diferente. Cada conversacion mantiene su propio contexto."
                    />
                    <ActionItem
                        icon={<History className="w-5 h-5" />}
                        title="Cambiar de conversacion"
                        description="Haz clic en cualquier conversacion del panel lateral para retomar donde lo dejaste."
                    />
                    <ActionItem
                        icon={<Trash2 className="w-5 h-5" />}
                        title="Eliminar conversacion"
                        description="Borra conversaciones que ya no necesites. Esta accion no se puede deshacer."
                    />
                </div>
            </DocSection>

            {/* Diferencia con AI */}
            <DocSection title="Decatron Chat vs Decatron AI">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-ds-bg border-b border-ds-border">
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Caracteristica</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Decatron Chat</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Decatron AI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ds-border">
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-ds-text">Donde funciona</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Dashboard (privado)</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Chat de Twitch (publico)</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-ds-text">Quien lo usa</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Solo el streamer</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Viewers del chat</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-ds-text">Historial</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Conversaciones guardadas</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Contexto por sesion</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm font-medium text-ds-text">Comando</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Interfaz de chat</td>
                                <td className="px-4 py-3 text-sm text-ds-soft">!ai en el chat</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Tips */}
            <DocSection title="Consejos">
                <DocAlert type="tip" title="Organiza tus conversaciones">
                    Crea conversaciones separadas por tema: una para configuracion, otra para ideas
                    de comandos, otra para troubleshooting.
                </DocAlert>
                <DocAlert type="info" title="Acceso">
                    Decatron Chat esta disponible para todos los usuarios desde el dashboard.
                    El acceso puede variar segun tu nivel de permisos.
                </DocAlert>
            </DocSection>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
            <div className="w-10 h-10 bg-ds-raised rounded-lg flex items-center justify-center text-ds-accent-text mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-ds-text mb-1">{title}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}

function StepItem({ number, text }: { number: number; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 bg-ds-accent text-white rounded-full flex items-center justify-center font-bold text-xs">
                {number}
            </div>
            <p className="text-sm text-ds-soft">{text}</p>
        </div>
    );
}

function ActionItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 p-4 bg-ds-surface rounded-lg border border-ds-border">
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
