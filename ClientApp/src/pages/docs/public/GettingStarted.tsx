import { ArrowRight, ExternalLink, CheckCircle, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import DocAlert from '../../../components/docs/DocAlert';

export default function GettingStarted() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <h1 className="text-4xl font-black text-ds-text mb-4">
                    Como empezar con Decatron
                </h1>
                <p className="text-xl text-ds-soft">
                    En solo 5 minutos tendras tu bot configurado y funcionando en tu canal de Twitch.
                </p>
            </div>

            {/* Requisitos previos */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <h2 className="text-2xl font-black text-ds-text mb-4">
                    Requisitos previos
                </h2>
                <ul className="space-y-3">
                    <Requirement text="Una cuenta de Twitch (streamer o creador)" />
                    <Requirement text="Navegador web moderno (Chrome, Firefox, Edge, Safari)" />
                    <Requirement text="OBS Studio o similar (para overlays)" optional />
                </ul>
            </div>

            {/* Pasos */}
            <div className="space-y-6">
                <h2 className="text-2xl font-black text-ds-text">
                    Guia paso a paso
                </h2>

                {/* Paso 1 */}
                <Step
                    number={1}
                    title="Inicia sesion con Twitch"
                    description="Haz clic en el boton de inicio de sesion y autoriza a Decatron para acceder a tu cuenta de Twitch."
                >
                    <div className="mt-4 space-y-4">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                        >
                            <svg className="w-5 h-5" viewBox="0 24" fill="currentColor">
                                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                            </svg>
                            Conectar con Twitch
                        </Link>
                        <DocAlert type="info">
                            Decatron solo solicita los permisos necesarios para funcionar. Puedes revocar el acceso en cualquier momento desde tu cuenta de Twitch.
                        </DocAlert>
                    </div>
                </Step>

                {/* Paso 2 */}
                <Step
                    number={2}
                    title="Configura tu bot"
                    description="Una vez conectado, seras redirigido al dashboard donde podras personalizar tu bot."
                >
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ConfigItem
                            title="Comandos por defecto"
                            description="Activa o desactiva comandos como !game, !title, !so"
                        />
                        <ConfigItem
                            title="Prefijo del bot"
                            description="Cambia el prefijo ! por otro caracter si lo prefieres"
                        />
                        <ConfigItem
                            title="Idioma"
                            description="Selecciona el idioma para los mensajes del bot"
                        />
                        <ConfigItem
                            title="Permisos"
                            description="Configura quien puede usar cada comando"
                        />
                    </div>
                </Step>

                {/* Paso 3 */}
                <Step
                    number={3}
                    title="Prueba el comando !title"
                    description="Ve a tu chat de Twitch y escribe el comando para verificar que el bot esta funcionando."
                >
                    <div className="mt-4">
                        <CommandExample command="!title" response="Título actual: Mi primer stream con Decatron" />
                        <DocAlert type="success" title="El bot responde!">
                            Si ves la respuesta en el chat, felicidades! Tu bot esta configurado correctamente.
                        </DocAlert>
                    </div>
                </Step>

                {/* Paso 4 */}
                <Step
                    number={4}
                    title="Agrega tu primer overlay"
                    description="Los overlays son elementos visuales que puedes agregar a tu stream en OBS."
                >
                    <div className="mt-4 space-y-4">
                        <p className="text-ds-soft">
                            Para agregar el overlay del timer a OBS:
                        </p>
                        <ol className="space-y-3 ml-4">
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                                <span className="text-ds-soft">Abre OBS Studio y ve a la escena donde quieres el overlay</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                <span className="text-ds-soft">Haz clic en "+" en Fuentes y selecciona "Navegador"</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                                <span className="text-ds-soft">Copia la URL del overlay desde tu dashboard</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                                <span className="text-ds-soft">Pega la URL en OBS y ajusta el tamaño (1920x1080 recomendado)</span>
                            </li>
                        </ol>
                        <DocAlert type="tip" title="Consejo">
                            Activa "Actualizar navegador cuando la escena se active" para que el overlay se refresque automaticamente.
                        </DocAlert>
                    </div>
                </Step>
            </div>

            {/* Siguiente paso */}
            <div className="bg-ds-surface border border-ds-border rounded-lg p-8 text-ds-text">
                <h2 className="text-2xl font-black mb-4">Siguiente paso</h2>
                <p className="text-ds-soft mb-6">
                    Ya tienes lo basico configurado. Ahora explora todas las features que Decatron tiene para ofrecer.
                </p>
                <div className="flex flex-wrap gap-4">
                    <Link
                        to="/docs/features"
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        Ver todas las features
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link
                        to="/docs/commands/default"
                        className="ds-btn ds-btn--secondary ds-btn--lg"
                    >
                        Comandos por defecto
                    </Link>
                </div>
            </div>
        </div>
    );
}

interface RequirementProps {
    text: string;
    optional?: boolean;
}

function Requirement({ text, optional }: RequirementProps) {
    return (
        <li className="flex items-center gap-3">
            <CheckCircle className={`w-5 h-5 flex-shrink-0 ${optional ? 'text-ds-soft' : 'text-ds-ok'}`} />
            <span className="text-ds-soft">
                {text}
                {optional && <span className="ml-2 text-xs bg-ds-bg px-2 py-0.5 rounded">Opcional</span>}
            </span>
        </li>
    );
}

interface StepProps {
    number: number;
    title: string;
    description: string;
    children?: React.ReactNode;
}

function Step({ number, title, description, children }: StepProps) {
    return (
        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-ds-accent text-white rounded-full flex items-center justify-center font-black text-xl">
                    {number}
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-ds-text mb-2">{title}</h3>
                    <p className="text-ds-soft">{description}</p>
                    {children}
                </div>
            </div>
        </div>
    );
}

interface ConfigItemProps {
    title: string;
    description: string;
}

function ConfigItem({ title, description }: ConfigItemProps) {
    return (
        <div className="bg-ds-bg rounded-lg p-4 border border-ds-border">
            <h4 className="font-bold text-ds-text mb-1">{title}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}

interface CommandExampleProps {
    command: string;
    response: string;
}

function CommandExample({ command, response }: CommandExampleProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-ds-bg rounded-lg p-4 border border-ds-border mb-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ds-soft">Comando:</span>
                <button
                    onClick={handleCopy}
                    className="p-1 hover:bg-hover:bg-ds-bg rounded transition-colors"
                    title="Copiar comando"
                >
                    {copied ? <Check className="w-4 h-4 text-ds-ok" /> : <Copy className="w-4 h-4 text-ds-soft" />}
                </button>
            </div>
            <code className="block text-ds-accent-text font-mono text-lg mb-3">{command}</code>
            <div className="text-sm font-medium text-ds-soft mb-1">Respuesta:</div>
            <code className="block text-ds-text font-mono">{response}</code>
        </div>
    );
}
