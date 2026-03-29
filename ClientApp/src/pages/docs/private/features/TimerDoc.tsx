import { Clock, Play, Pause, Square, RotateCcw, Settings, Palette, BarChart3, Bell, Zap, ArrowRight, Monitor, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';
import CodeBlock from '../../../../components/docs/CodeBlock';

export default function TimerDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <Clock className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Guia del Timer
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Temporizadores profesionales con overlay, alertas y eventos
                        </p>
                    </div>
                </div>
                <Link
                    to="/overlays/timer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Que es el timer */}
            <DocSection title="Que es el timer?">
                <p>
                    El timer de Decatron es un temporizador profesional que puedes mostrar en tu stream.
                    Soporta cuenta regresiva (countdown) y cuenta ascendente (countup), con barras de progreso,
                    alertas de finalizacion y eventos automaticos.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FeatureCard
                        icon={<Clock className="w-5 h-5" />}
                        title="Countdown / Countup"
                        description="Cuenta regresiva o ascendente"
                    />
                    <FeatureCard
                        icon={<BarChart3 className="w-5 h-5" />}
                        title="Barras de progreso"
                        description="Horizontal, vertical o circular"
                    />
                    <FeatureCard
                        icon={<Bell className="w-5 h-5" />}
                        title="Alertas"
                        description="Audio y video al finalizar"
                    />
                </div>
            </DocSection>

            {/* Crear tu primer timer */}
            <DocSection title="Crear tu primer timer">
                <div className="space-y-4">
                    <Step number={1} title="Ve a la configuracion del timer">
                        <p>Navega a <strong>Overlays → Timer</strong> en el menu lateral.</p>
                    </Step>
                    <Step number={2} title="Configura la duracion">
                        <p>
                            En la pestaña "Basico", establece la duracion del timer usando el selector de tiempo.
                            Puedes configurar horas, minutos y segundos.
                        </p>
                    </Step>
                    <Step number={3} title="Copia la URL del overlay">
                        <p>
                            Haz clic en el boton "Copiar URL" para obtener la URL del overlay.
                            Esta URL es unica para tu cuenta.
                        </p>
                    </Step>
                    <Step number={4} title="Agrega a OBS">
                        <p>
                            Agrega una fuente de navegador en OBS con la URL copiada.
                            Usa dimensiones de 1920x1080.
                        </p>
                        <Link
                            to="/dashboard/docs/overlays"
                            className="inline-flex items-center gap-2 text-[#2563eb] font-medium hover:underline mt-2"
                        >
                            Ver guia de overlays
                            <ExternalLink className="w-4 h-4" />
                        </Link>
                    </Step>
                </div>
            </DocSection>

            {/* Comandos asociados */}
            <DocSection title="Comandos del timer">
                <p className="mb-4">
                    Puedes controlar el timer desde el chat usando estos comandos:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CommandCard
                        command="!dstart"
                        description="Inicia el timer desde el principio"
                        icon={<Play className="w-4 h-4" />}
                    />
                    <CommandCard
                        command="!dplay"
                        description="Reanuda el timer pausado"
                        icon={<Play className="w-4 h-4" />}
                    />
                    <CommandCard
                        command="!dpause"
                        description="Pausa el timer"
                        icon={<Pause className="w-4 h-4" />}
                    />
                    <CommandCard
                        command="!dstop"
                        description="Detiene y oculta el timer"
                        icon={<Square className="w-4 h-4" />}
                    />
                    <CommandCard
                        command="!dreset"
                        description="Reinicia el timer a su duracion inicial"
                        icon={<RotateCcw className="w-4 h-4" />}
                    />
                    <CommandCard
                        command="!dtimer [tiempo]"
                        description="Cambia la duracion (ej: !dtimer 30m)"
                        icon={<Settings className="w-4 h-4" />}
                    />
                </div>
                <DocAlert type="info" title="Permisos">
                    Por defecto, solo los moderadores y el broadcaster pueden controlar el timer.
                    Puedes cambiar los permisos en la configuracion de comandos.
                </DocAlert>
            </DocSection>

            {/* Configuracion de display */}
            <DocSection title="Configuracion del display">
                <p className="mb-4">
                    En la pestaña "Display" puedes configurar que elementos mostrar en el overlay:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Tiempo:</strong> Muestra el contador principal (HH:MM:SS o MM:SS)
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Etiqueta:</strong> Texto personalizado sobre o debajo del timer
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Barra de progreso:</strong> Visual del progreso del timer
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Formato:</strong> Compacto (1:30:00), detallado (1h 30m 0s), etc.
                    </li>
                </ul>
            </DocSection>

            {/* Barras de progreso */}
            <DocSection title="Barras de progreso">
                <p className="mb-4">
                    El timer soporta tres tipos de barras de progreso:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Horizontal</h4>
                        <div className="h-4 bg-[#f8fafc] dark:bg-[#374151] rounded-full overflow-hidden">
                            <div className="h-full w-2/3 bg-[#2563eb] rounded-full" />
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">
                            Barra clasica de izquierda a derecha
                        </p>
                    </div>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Vertical</h4>
                        <div className="h-16 w-4 bg-[#f8fafc] dark:bg-[#374151] rounded-full overflow-hidden mx-auto flex flex-col-reverse">
                            <div className="w-full h-2/3 bg-[#2563eb] rounded-full" />
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">
                            Barra vertical de abajo hacia arriba
                        </p>
                    </div>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Circular</h4>
                        <div className="w-16 h-16 rounded-full border-4 border-[#f8fafc] dark:border-[#374151] mx-auto relative">
                            <div className="absolute inset-0 rounded-full border-4 border-[#2563eb] border-t-transparent border-r-transparent rotate-45" />
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">
                            Anillo con progreso circular
                        </p>
                    </div>
                </div>
            </DocSection>

            {/* Alertas de finalizacion */}
            <DocSection title="Alertas de finalizacion">
                <p className="mb-4">
                    Cuando el timer llega a cero, puedes reproducir alertas de audio y video:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Audio:</strong> Reproduce un sonido de notificacion
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Video:</strong> Muestra un video o GIF de celebracion
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Imagen:</strong> Muestra una imagen estatica
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Mensaje en chat:</strong> Envia un mensaje automatico al chat
                    </li>
                </ul>
                <DocAlert type="tip" title="Formatos soportados">
                    Audio: MP3, WAV, OGG. Video: MP4, WebM. Imagenes: PNG, JPG, GIF, WebP.
                </DocAlert>
            </DocSection>

            {/* Eventos automaticos */}
            <DocSection title="Eventos automaticos">
                <p className="mb-4">
                    Configura acciones automaticas basadas en eventos del timer:
                </p>
                <div className="space-y-3">
                    <EventCard
                        event="Al iniciar"
                        description="Ejecuta acciones cuando el timer comienza"
                        examples={["Enviar mensaje al chat", "Cambiar titulo del stream"]}
                    />
                    <EventCard
                        event="Al pausar"
                        description="Ejecuta acciones cuando el timer se pausa"
                        examples={["Enviar mensaje de pausa"]}
                    />
                    <EventCard
                        event="Al terminar"
                        description="Ejecuta acciones cuando el timer llega a cero"
                        examples={["Reproducir alerta", "Enviar mensaje", "Iniciar raid"]}
                    />
                    <EventCard
                        event="Al extender"
                        description="Ejecuta acciones cuando se agrega tiempo al timer"
                        examples={["Agradecer al usuario", "Actualizar meta"]}
                    />
                </div>
            </DocSection>

            {/* Tips y trucos */}
            <DocSection title="Tips y trucos">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Posicion del overlay">
                        Puedes mover el timer a cualquier posicion de la pantalla usando los controles
                        de posicion en la pestaña "Display".
                    </DocAlert>
                    <DocAlert type="tip" title="Ocultar cuando no esta activo">
                        Activa la opcion "Ocultar cuando esta detenido" para que el timer desaparezca
                        automaticamente cuando no esta en uso.
                    </DocAlert>
                    <DocAlert type="tip" title="Integracion con metas">
                        El timer puede integrarse con el sistema de metas. Cada vez que se alcanza
                        una meta, se puede agregar tiempo automaticamente.
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
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-[#2563eb] mb-3">
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
    icon: React.ReactNode;
}

function CommandCard({ command, description, icon }: CommandCardProps) {
    return (
        <div className="flex items-start gap-3 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-8 h-8 bg-[#f8fafc] dark:bg-[#374151] rounded-lg flex items-center justify-center text-[#2563eb] flex-shrink-0">
                {icon}
            </div>
            <div>
                <code className="text-[#2563eb] font-mono font-bold">{command}</code>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">{description}</p>
            </div>
        </div>
    );
}

interface EventCardProps {
    event: string;
    description: string;
    examples: string[];
}

function EventCard({ event, description, examples }: EventCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{event}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2">{description}</p>
            <div className="flex flex-wrap gap-2">
                {examples.map((example, index) => (
                    <span key={index} className="px-2 py-1 bg-[#f8fafc] dark:bg-[#374151] text-xs text-[#64748b] dark:text-[#94a3b8] rounded">
                        {example}
                    </span>
                ))}
            </div>
        </div>
    );
}
