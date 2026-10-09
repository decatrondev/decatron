import { Zap, Video, Settings, Palette, Shield, Target, Play, ExternalLink } from 'lucide-react';
import CodeBlock from '../../components/docs/CodeBlock';

export default function ShoutoutOverlayDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-bg rounded-lg flex items-center justify-center border border-ds-border">
                        <Zap className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-ds-text">Overlay de Shoutouts</h1>
                        <p className="text-ds-soft mt-1">
                            Sistema completo de shoutouts con overlays personalizables
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <StatCard icon={<Video />} label="Clips Automáticos" />
                    <StatCard icon={<Palette />} label="Personalizable" />
                    <StatCard icon={<Shield />} label="Control de Acceso" />
                    <StatCard icon={<Play />} label="Animaciones" />
                </div>
            </div>

            {/* Introducción */}
            <section className="scroll-mt-20">
                <SectionHeader
                    icon={<Zap className="w-8 h-8" />}
                    title="¿Qué es el Sistema de Shoutouts?"
                    color="purple"
                    description="Un overlay visual que muestra información del streamer al que das shoutout"
                />
                <div className="bg-ds-surface rounded-lg p-6 border border-ds-border mt-4">
                    <p className="text-ds-soft mb-4">
                        El sistema de shoutouts permite dar reconocimiento a otros streamers de manera visual y atractiva.
                        Cuando ejecutas el comando <code className="bg-ds-bg px-2 py-1 rounded text-ds-accent-text">!so @usuario</code>,
                        aparece un overlay con:
                    </p>
                    <ul className="space-y-2 text-ds-soft">
                        <li className="flex items-start gap-2">
                            <span className="text-ds-accent-text font-bold">•</span>
                            <span>Clip más reciente del streamer (si está disponible)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-ds-accent-text font-bold">•</span>
                            <span>Foto de perfil y categoría que está jugando</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-ds-accent-text font-bold">•</span>
                            <span>Texto personalizable con variables dinámicas</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-ds-accent-text font-bold">•</span>
                            <span>Animaciones y efectos visuales configurables</span>
                        </li>
                    </ul>
                </div>
            </section>

            {/* Configuración Básica */}
            <section className="scroll-mt-20">
                <SectionHeader
                    icon={<Settings className="w-8 h-8" />}
                    title="Configuración Básica"
                    color="blue"
                    description="Pasos para empezar a usar shoutouts"
                />
                <div className="space-y-4 mt-4">
                    <ConfigStep
                        number={1}
                        title="Habilitar el Bot"
                        description="Ve a Configuración y activa el bot para tu canal"
                    />
                    <ConfigStep
                        number={2}
                        title="Configurar Shoutouts"
                        description="Ve a Overlays → Shoutouts y personaliza el diseño"
                    />
                    <ConfigStep
                        number={3}
                        title="Agregar a OBS"
                        description="Copia la URL del overlay y agrégalo como fuente de navegador"
                    >
                        <CodeBlock
                            code={`URL: https://tu-dominio/overlay/shoutout?channel=tu_canal

Configuración recomendada en OBS:
- Ancho: 1000px
- Alto: 300px
- Actualizar navegador cuando la escena se vuelve activa: ✓`}
                            language="text"
                        />
                    </ConfigStep>
                    <ConfigStep
                        number={4}
                        title="Usar el Comando"
                        description="En tu chat de Twitch, escribe:"
                    >
                        <CodeBlock
                            code={`!so @nombreusuario`}
                            language="bash"
                        />
                    </ConfigStep>
                </div>
            </section>

            {/* Personalización */}
            <section className="scroll-mt-20">
                <SectionHeader
                    icon={<Palette className="w-8 h-8" />}
                    title="Personalización del Overlay"
                    color="purple"
                    description="Opciones de diseño y estilo"
                />
                <div className="space-y-4 mt-4">
                    <FeatureCard
                        icon={<Palette />}
                        title="Estilos y Colores"
                        description="Personaliza colores, fuentes, fondos y opacidad"
                        features={[
                            'Selector de fuente (Google Fonts)',
                            'Colores personalizados para texto',
                            'Fondo: sólido, gradiente o transparente',
                            'Opacidad del fondo ajustable',
                            'Sombras de texto configurables'
                        ]}
                    />
                    <FeatureCard
                        icon={<Play />}
                        title="Animaciones"
                        description="Efectos de entrada y salida"
                        features={[
                            'Sin animación (por defecto)',
                            'Deslizar (slide)',
                            'Rebote (bounce)',
                            'Fade In/Out',
                            'Zoom',
                            'Rotar',
                            'Velocidades: Lenta (1s), Normal (0.5s), Rápida (0.3s)'
                        ]}
                    />
                    <FeatureCard
                        icon={<Target />}
                        title="Efectos Visuales"
                        description="Detalles adicionales para mejorar la apariencia"
                        features={[
                            'Contorno de texto (color y grosor ajustables)',
                            'Borde del contenedor (color y grosor)',
                            'Layout personalizable (posición de elementos)',
                            'Vista previa en tiempo real'
                        ]}
                    />
                </div>
            </section>

            {/* Control de Acceso */}
            <section className="scroll-mt-20">
                <SectionHeader
                    icon={<Shield className="w-8 h-8" />}
                    title="Control de Acceso"
                    color="green"
                    description="Gestión de permisos y listas"
                />
                <div className="space-y-4 mt-4">
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-bold text-ds-text mb-4">¿Quién puede ejecutar !so?</h3>
                        <div className="space-y-3">
                            <PermissionItem
                                icon="✅"
                                title="Broadcaster (Streamer)"
                                description="SIEMPRE puede usar el comando"
                            />
                            <PermissionItem
                                icon="✅"
                                title="Moderadores"
                                description="SIEMPRE pueden usar el comando (excepto si están en blacklist del usuario objetivo)"
                            />
                            <PermissionItem
                                icon="➕"
                                title="Whitelist"
                                description="Usuarios ADICIONALES que pueden ejecutar !so. Los mods siguen teniendo acceso."
                            />
                        </div>
                    </div>

                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-bold text-ds-text mb-4">Blacklist</h3>
                        <p className="text-ds-soft mb-3">
                            Usuarios que <strong>NO pueden recibir</strong> shoutouts. Útil para evitar dar shoutout a bots, cuentas problemáticas, etc.
                        </p>
                        <CodeBlock
                            code={`Ejemplo:
Blacklist: ["bot_spammer", "troll_account"]

Resultado: !so @bot_spammer → (No hace nada, ignora silenciosamente)`}
                            language="text"
                        />
                    </div>
                </div>
            </section>

            {/* Variables del Sistema */}
            <section className="scroll-mt-20">
                <SectionHeader
                    icon={<Zap className="w-8 h-8" />}
                    title="Variables Disponibles"
                    color="orange"
                    description="Placeholders para personalizar el texto"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <VariableCard
                        name="@username"
                        description="Nombre del streamer que recibe el shoutout"
                        example="¡Denle follow a @username!"
                        result="¡Denle follow a @anthonyedca!"
                    />
                    <VariableCard
                        name="@game"
                        description="Categoría/juego que está jugando el streamer"
                        example="Jugando: @game"
                        result="Jugando: Just Chatting"
                    />
                </div>
            </section>

            {/* Cooldowns */}
            <section className="scroll-mt-20">
                <SectionHeader
                    icon={<Shield className="w-8 h-8" />}
                    title="Cooldowns"
                    color="red"
                    description="Control de frecuencia de shoutouts"
                />
                <div className="bg-ds-surface rounded-lg p-6 border border-ds-border mt-4">
                    <p className="text-ds-soft mb-4">
                        El sistema incluye un cooldown configurable para evitar spam de shoutouts al mismo usuario.
                    </p>
                    <div className="bg-ds-bg rounded-lg p-4">
                        <p className="text-sm font-mono text-ds-text">
                            Cooldown predeterminado: <span className="text-ds-accent-text font-bold">30 segundos</span>
                        </p>
                        <p className="text-xs text-ds-soft mt-2">
                            Si intentas dar shoutout al mismo usuario dentro del cooldown, el comando será ignorado silenciosamente.
                        </p>
                    </div>
                </div>
            </section>

            {/* Vista Previa */}
            <section className="scroll-mt-20">
                <SectionHeader
                    icon={<Play className="w-8 h-8" />}
                    title="Probar el Overlay"
                    color="green"
                    description="Cómo verificar que todo funciona"
                />
                <div className="space-y-4 mt-4">
                    <div className="bg-ds-raised border border-ds-border rounded-lg p-6">
                        <div className="flex items-start gap-3">
                            <Play className="w-6 h-6 text-ds-accent-text flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-lg font-bold text-ds-accent-text mb-2">
                                    Botón de Vista Previa
                                </h3>
                                <p className="text-ds-accent-text text-sm mb-3">
                                    En la configuración de Shoutouts, en el tab de "Animaciones", encontrarás un botón
                                    <strong> "Probar Animaciones"</strong> que envía un shoutout de prueba al overlay.
                                </p>
                                <p className="text-ds-accent-text text-xs">
                                    💡 Asegúrate de tener el overlay abierto en OBS o en una pestaña del navegador
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-ds-raised border border-ds-border rounded-lg p-6">
                        <div className="flex items-start gap-3">
                            <ExternalLink className="w-6 h-6 text-ds-accent-text flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-lg font-bold text-ds-accent-text mb-2">
                                    Prueba en Chat
                                </h3>
                                <p className="text-ds-accent-text text-sm">
                                    Simplemente ejecuta <code className="bg-ds-raised px-2 py-1 rounded">!so @usuario</code> en
                                    tu chat de Twitch y verás el overlay en acción.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Solución de Problemas */}
            <section className="scroll-mt-20">
                <SectionHeader
                    icon={<Settings className="w-8 h-8" />}
                    title="Solución de Problemas"
                    color="red"
                    description="Problemas comunes y soluciones"
                />
                <div className="space-y-4 mt-4">
                    <TroubleshootCard
                        problem="El overlay no aparece en OBS"
                        solutions={[
                            'Verifica que la URL sea correcta: /overlay/shoutout?channel=tu_canal',
                            'Asegúrate de que el bot esté activo en Configuración',
                            'Refresca la fuente de navegador en OBS (click derecho → Actualizar)',
                            'Verifica que el tamaño sea 1000x300 píxeles'
                        ]}
                    />
                    <TroubleshootCard
                        problem="El comando !so no funciona"
                        solutions={[
                            'Verifica que el bot esté conectado a tu canal',
                            'Asegúrate de tener permisos (ser mod o estar en whitelist)',
                            'Revisa que no haya cooldown activo para ese usuario',
                            'Verifica que el usuario objetivo no esté en la blacklist'
                        ]}
                    />
                    <TroubleshootCard
                        problem="No se muestra el clip"
                        solutions={[
                            'Es normal si el usuario no tiene clips públicos',
                            'El mensaje mostrará: "(No tiene clips, pero denle amor igual!)"',
                            'El overlay funcionará de todos modos con la foto de perfil'
                        ]}
                    />
                    <TroubleshootCard
                        problem="Los cambios no se reflejan después de guardar"
                        solutions={[
                            'El overlay se actualiza automáticamente al reconectar',
                            'Si acabas de reiniciar el backend, espera unos segundos',
                            'Si persiste, actualiza manualmente la fuente en OBS'
                        ]}
                    />
                </div>
            </section>
        </div>
    );
}

// Componentes auxiliares
function StatCard({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="bg-ds-bg rounded-lg p-4 border border-ds-border">
            <div className="flex flex-col items-center gap-2">
                <div className="text-ds-accent-text">{icon}</div>
                <span className="text-xs font-semibold text-ds-soft text-center">{label}</span>
            </div>
        </div>
    );
}

function SectionHeader({
    icon,
    title,
    color,
    description
}: {
    icon: React.ReactNode;
    title: string;
    color: string;
    description: string;
}) {
    const colors = {
        blue: 'text-ds-accent-text ',
        purple: 'text-ds-accent-text ',
        green: 'bg-ds-raised text-ds-accent-text',
        orange: 'text-ds-accent-text ',
        red: 'bg-ds-raised text-ds-accent-text'
    };

    return (
        <div className="flex items-start gap-4 mb-4">
            <div className={`${colors[color as keyof typeof colors]} mt-1`}>{icon}</div>
            <div>
                <h2 className="text-2xl font-black text-ds-text">{title}</h2>
                <p className="text-ds-soft mt-1">{description}</p>
            </div>
        </div>
    );
}

function ConfigStep({
    number,
    title,
    description,
    children
}: {
    number: number;
    title: string;
    description: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-ds-accent text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    {number}
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-ds-text mb-1">{title}</h3>
                    <p className="text-ds-soft">{description}</p>
                    {children && <div className="mt-4">{children}</div>}
                </div>
            </div>
        </div>
    );
}

function FeatureCard({
    icon,
    title,
    description,
    features
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    features: string[];
}) {
    return (
        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
            <div className="flex items-start gap-3 mb-4">
                <div className="text-ds-accent-text mt-1">{icon}</div>
                <div>
                    <h3 className="text-lg font-bold text-ds-text">{title}</h3>
                    <p className="text-sm text-ds-soft mt-1">{description}</p>
                </div>
            </div>
            <ul className="space-y-2">
                {features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-ds-soft">
                        <span className="text-ds-accent-text font-bold">•</span>
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function PermissionItem({
    icon,
    title,
    description
}: {
    icon: string;
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-start gap-3 p-3 bg-ds-bg rounded-lg">
            <span className="text-xl">{icon}</span>
            <div>
                <h4 className="font-bold text-ds-text text-sm">{title}</h4>
                <p className="text-xs text-ds-soft mt-1">{description}</p>
            </div>
        </div>
    );
}

function VariableCard({
    name,
    description,
    example,
    result
}: {
    name: string;
    description: string;
    example: string;
    result: string;
}) {
    return (
        <div className="bg-ds-surface rounded-lg p-5 border border-ds-border">
            <div className="mb-3">
                <code className="text-lg font-bold text-ds-accent-text bg-ds-raised px-2 py-1 rounded">
                    {name}
                </code>
            </div>
            <p className="text-sm text-ds-soft mb-3">{description}</p>
            <div className="space-y-2">
                <div className="bg-ds-bg rounded p-3">
                    <p className="text-xs text-ds-soft mb-1">Ejemplo:</p>
                    <code className="text-sm text-ds-text">{example}</code>
                </div>
                <div className="bg-ds-raised rounded p-3">
                    <p className="text-xs text-ds-accent-text mb-1">Resultado:</p>
                    <code className="text-sm text-ds-accent-text">{result}</code>
                </div>
            </div>
        </div>
    );
}

function TroubleshootCard({ problem, solutions }: { problem: string; solutions: string[] }) {
    return (
        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
            <h3 className="text-lg font-bold text-ds-text mb-3">❌ {problem}</h3>
            <div className="space-y-2">
                {solutions.map((solution, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                        <span className="text-ds-ok font-bold flex-shrink-0">✓</span>
                        <p className="text-sm text-ds-soft">{solution}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
