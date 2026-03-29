import { Sparkles, MessageSquare, Shield, ArrowRight, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function AIDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Decatron AI
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Inteligencia artificial para tu stream
                        </p>
                    </div>
                </div>
                <Link
                    to="/features/decatron-ai"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Que es */}
            <DocSection title="Que es Decatron AI?">
                <p className="mb-4">
                    Decatron AI es un asistente de inteligencia artificial que puede interactuar
                    con tu chat, responder preguntas y ayudar con la moderacion de forma inteligente.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FeatureCard
                        icon={<MessageSquare className="w-5 h-5" />}
                        title="Respuestas"
                        description="Responde preguntas del chat"
                    />
                    <FeatureCard
                        icon={<Shield className="w-5 h-5" />}
                        title="Moderacion"
                        description="Ayuda a moderar el chat"
                    />
                    <FeatureCard
                        icon={<Brain className="w-5 h-5" />}
                        title="Contexto"
                        description="Entiende el contexto del stream"
                    />
                </div>
            </DocSection>

            {/* Como activar */}
            <DocSection title="Como activar">
                <div className="space-y-4">
                    <Step number={1} title="Ve a la configuracion de AI">
                        <p>Navega a <strong>Features → Decatron AI</strong> en el menu lateral.</p>
                    </Step>
                    <Step number={2} title="Activa Decatron AI">
                        <p>Activa el toggle para habilitar la IA en tu canal.</p>
                    </Step>
                    <Step number={3} title="Configura la personalidad">
                        <p>Define como quieres que la IA se comporte y responda.</p>
                    </Step>
                </div>
            </DocSection>

            {/* Comandos */}
            <DocSection title="Comandos de AI">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CommandCard
                        command="!ai [pregunta]"
                        description="Hazle una pregunta a Decatron AI"
                        example="!ai que juego estamos jugando?"
                    />
                    <CommandCard
                        command="!chat [mensaje]"
                        description="Chatea con la IA"
                        example="!chat cuentame un chiste"
                    />
                </div>
            </DocSection>

            {/* Personalidad */}
            <DocSection title="Configurar personalidad">
                <p className="mb-4">
                    Define como quieres que la IA se comporte:
                </p>
                <div className="space-y-3">
                    <PersonalityOption
                        title="Nombre"
                        description="Como se llamara la IA en el chat"
                        example="DecatronBot"
                    />
                    <PersonalityOption
                        title="Tono"
                        description="Formal, casual, amigable, sarcastico"
                        example="Amigable y divertido"
                    />
                    <PersonalityOption
                        title="Contexto"
                        description="Informacion sobre tu stream"
                        example="Streamer de videojuegos retro"
                    />
                    <PersonalityOption
                        title="Reglas"
                        description="Que puede y no puede hacer"
                        example="No hablar de politica"
                    />
                </div>
            </DocSection>

            {/* Moderacion inteligente */}
            <DocSection title="Moderacion inteligente">
                <p className="mb-4">
                    Decatron AI puede ayudar con la moderacion:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Detectar contenido toxico incluso sin palabras prohibidas
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Entender contexto y sarcasmo
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Advertir antes de tomar acciones
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Aprender de las decisiones de los moderadores
                    </li>
                </ul>
                <DocAlert type="info" title="Asistente, no reemplazo">
                    La IA esta diseñada para asistir a los moderadores, no reemplazarlos.
                    Las acciones graves siempre requieren aprobacion.
                </DocAlert>
            </DocSection>

            {/* Respuestas automaticas */}
            <DocSection title="Respuestas automaticas">
                <p className="mb-4">
                    Configura respuestas automaticas para preguntas frecuentes:
                </p>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-3">Ejemplo</h4>
                    <div className="space-y-2 text-sm">
                        <div>
                            <span className="text-purple-500 font-bold">Usuario:</span>
                            <span className="text-[#64748b] dark:text-[#94a3b8] ml-2">que PC usas?</span>
                        </div>
                        <div>
                            <span className="text-[#2563eb] font-bold">Decatron AI:</span>
                            <span className="text-[#64748b] dark:text-[#94a3b8] ml-2">
                                @Usuario, el streamer usa una RTX 4090, Ryzen 9 7950X y 64GB de RAM.
                            </span>
                        </div>
                    </div>
                </div>
                <DocAlert type="tip" title="FAQ automatico">
                    La IA puede aprender las preguntas frecuentes de tu chat y responderlas
                    automaticamente.
                </DocAlert>
            </DocSection>

            {/* Limites */}
            <DocSection title="Limites y restricciones">
                <p className="mb-4">
                    Configura limites para evitar spam:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Cooldown:</strong> Tiempo entre respuestas (por usuario)
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Limite global:</strong> Maximo de respuestas por minuto
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Solo mencion:</strong> Responder solo cuando la mencionan
                    </li>
                </ul>
            </DocSection>

            {/* Tips */}
            <DocSection title="Tips y trucos">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Contexto del stream">
                        Cuanta mas informacion le des sobre tu stream, mejores seran las respuestas.
                    </DocAlert>
                    <DocAlert type="tip" title="Entrena la IA">
                        Corrige las respuestas incorrectas para que la IA aprenda.
                    </DocAlert>
                    <DocAlert type="warning" title="Supervision">
                        Siempre supervisa las respuestas de la IA, especialmente al principio.
                    </DocAlert>
                </div>
            </DocSection>
        </div>
    );
}

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

interface StepProps {
    number: number;
    title: string;
    children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
    return (
        <div className="flex gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex-shrink-0 w-8 h-8 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{children}</div>
            </div>
        </div>
    );
}

interface CommandCardProps {
    command: string;
    description: string;
    example: string;
}

function CommandCard({ command, description, example }: CommandCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <code className="text-[#2563eb] font-mono font-bold">{command}</code>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 mb-2">{description}</p>
            <div className="text-xs bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] px-2 py-1 rounded">
                Ejemplo: {example}
            </div>
        </div>
    );
}

interface PersonalityOptionProps {
    title: string;
    description: string;
    example: string;
}

function PersonalityOption({ title, description, example }: PersonalityOptionProps) {
    return (
        <div className="flex items-center justify-between bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
            <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded">
                {example}
            </span>
        </div>
    );
}
