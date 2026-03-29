import { Plus, Edit3, Trash2, Copy } from 'lucide-react';
import CodeBlock from '../../components/docs/CodeBlock';

export default function CustomCommandsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl flex items-center justify-center border border-[#e2e8f0] dark:border-[#374151]">
                        <Edit3 className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white">Comandos Personalizados</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Crea comandos únicos adaptados a las necesidades de tu canal
                        </p>
                    </div>
                </div>
            </div>

            {/* Introducción */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                    ¿Qué son los Comandos Personalizados?
                </h2>
                <p className="text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Los comandos personalizados te permiten crear respuestas automáticas únicas para tu canal.
                    Puedes usar <strong className="text-gray-900 dark:text-white">variables del sistema</strong> para
                    hacer tus comandos dinámicos e interactivos.
                </p>
                <p className="text-[#64748b] dark:text-[#94a3b8]">
                    A diferencia de los comandos por defecto, tú tienes control total sobre estos comandos:
                    crear, editar, duplicar o eliminarlos cuando quieras.
                </p>
            </div>

            {/* Crear Comandos */}
            <section>
                <SectionHeader
                    icon={<Plus className="w-8 h-8" />}
                    title="Crear un Comando"
                    description="Pasos para crear tu primer comando personalizado"
                />

                <div className="mt-4 space-y-4">
                    {/* Método 1: Dashboard */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="bg-[#2563eb] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                            Desde el Dashboard
                        </h3>
                        <ol className="space-y-3 text-[#64748b] dark:text-[#94a3b8]">
                            <li className="flex gap-3">
                                <span className="font-bold text-[#2563eb]">1.</span>
                                <span>Ve a <strong className="text-gray-900 dark:text-white">Comandos → Personalizados</strong> en el menú lateral</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-[#2563eb]">2.</span>
                                <span>Haz clic en el botón <strong className="text-gray-900 dark:text-white">"+ Nuevo Comando"</strong></span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-[#2563eb]">3.</span>
                                <span>Rellena el formulario con el nombre y la respuesta del comando</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-[#2563eb]">4.</span>
                                <span>Configura opciones adicionales (cooldown, permisos, alias)</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="font-bold text-[#2563eb]">5.</span>
                                <span>Guarda y ¡listo! Tu comando está activo</span>
                            </li>
                        </ol>
                    </div>

                    {/* Método 2: Chat */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                            Desde el Chat (solo moderadores)
                        </h3>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mb-4">
                            Los moderadores pueden crear comandos directamente desde el chat usando:
                        </p>
                        <CodeBlock
                            code={`!addcom <nombre> <respuesta>

# Ejemplos:
!addcom !discord ¡Únete a nuestro Discord! https://discord.gg/ejemplo
!addcom !redes Sígueme en: Twitter @ejemplo | Instagram @ejemplo
!addcom !horario Stream todos los días de 18:00 a 22:00 (GMT-5)`}
                        />
                    </div>
                </div>
            </section>

            {/* Ejemplos de Comandos */}
            <section>
                <SectionHeader
                    icon={<Copy className="w-8 h-8" />}
                    title="Ejemplos de Comandos"
                    description="Inspiración para tus comandos personalizados"
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <ExampleCard
                        title="Redes Sociales"
                        command="!redes"
                        response="Sígueme en todas mis redes: Twitter @Anthonydeca | Instagram @Anthonydeca | TikTok @Anthonydeca 🎮"
                        category="Información"
                    />

                    <ExampleCard
                        title="Discord"
                        command="!discord"
                        response="¡Únete a nuestra comunidad! 👉 https://discord.gg/ejemplo"
                        category="Información"
                    />

                    <ExampleCard
                        title="Saludo Personalizado"
                        command="!hola"
                        response="¡Hola $(user)! 👋 Bienvenido al stream de $(channel)"
                        category="Interactivo"
                    />

                    <ExampleCard
                        title="Donaciones"
                        command="!donar"
                        response="¡Gracias por tu apoyo $(user)! Puedes donar aquí: https://streamelements.com/ejemplo/tip"
                        category="Información"
                    />

                    <ExampleCard
                        title="Horario"
                        command="!horario"
                        response="📅 Stream todos los Lunes, Miércoles y Viernes de 18:00 a 22:00 (GMT-5)"
                        category="Información"
                    />

                    <ExampleCard
                        title="Comandos Disponibles"
                        command="!ayuda"
                        response="Comandos disponibles: !redes !discord !horario !donar | Más comandos en el panel de chat"
                        category="Información"
                    />

                    <ExampleCard
                        title="Contador de Muertes"
                        command="!muertes"
                        response="Muertes en el stream de hoy: $(count)"
                        category="Contador"
                    />

                    <ExampleCard
                        title="8Ball Personalizada"
                        command="!pregunta"
                        response="🎱 $(user) pregunta... La bola mágica dice: $(8ball)"
                        category="Interactivo"
                    />
                </div>
            </section>

            {/* Editar y Gestionar */}
            <section>
                <SectionHeader
                    icon={<Edit3 className="w-8 h-8" />}
                    title="Gestionar Comandos"
                    description="Editar, duplicar o eliminar comandos existentes"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <ActionCard
                        icon={<Edit3 />}
                        title="Editar"
                        description="Modifica el nombre, respuesta o configuración de cualquier comando"
                        action="Haz clic en el icono de lápiz"
                    />

                    <ActionCard
                        icon={<Copy />}
                        title="Duplicar"
                        description="Crea una copia de un comando existente para personalizarlo"
                        action="Haz clic en el icono de copiar"
                    />

                    <ActionCard
                        icon={<Trash2 />}
                        title="Eliminar"
                        description="Borra permanentemente comandos que ya no necesites"
                        action="Haz clic en el icono de papelera"
                    />
                </div>
            </section>

            {/* Opciones Avanzadas */}
            <section className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                    ⚙️ Opciones Avanzadas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Cooldown</h4>
                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">
                            Define cuántos segundos deben pasar antes de que el comando pueda usarse nuevamente.
                            Evita spam en el chat.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Permisos</h4>
                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">
                            Controla quién puede usar el comando: Todos, Solo Subs, Moderadores, o Solo Broadcaster.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Alias</h4>
                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">
                            Crea nombres alternativos para el mismo comando. Ejemplo: !dc como alias de !discord
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">Activar/Desactivar</h4>
                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">
                            Desactiva temporalmente comandos sin eliminarlos. Útil para eventos especiales.
                        </p>
                    </div>
                </div>
            </section>

            {/* Consejos */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-3">
                    💡 Consejos
                </h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-300">
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Usa variables del sistema como $(user), $(channel), $(count) para comandos dinámicos</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Los nombres de comandos deben empezar con ! y no contener espacios</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Agrega un cooldown de 5-10 segundos a comandos populares para evitar spam</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Mantén las respuestas concisas - mensajes muy largos pueden ser truncados</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

// Componente para ejemplos de comandos
interface ExampleCardProps {
    title: string;
    command: string;
    response: string;
    category: string;
}

function ExampleCard({ title, command, response, category }: ExampleCardProps) {
    const categoryColors: Record<string, string> = {
        'Información': 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
        'Interactivo': 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
        'Contador': 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
    };

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden hover:shadow-lg transition-all">
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${categoryColors[category]}`}>
                        {category}
                    </span>
                </div>

                <code className="block text-sm font-bold text-[#2563eb] bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg mb-2">
                    {command}
                </code>

                <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg p-3 border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-sm text-gray-800 dark:text-[#f8fafc] font-mono">
                        {response}
                    </p>
                </div>
            </div>
        </div>
    );
}

// Componente para acciones
interface ActionCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    action: string;
}

function ActionCard({ icon, title, description, action }: ActionCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-6 border border-[#e2e8f0] dark:border-[#374151] hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-[#2563eb] bg-opacity-10 rounded-xl flex items-center justify-center mb-4 text-[#2563eb]">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
            <p className="text-[#64748b] dark:text-[#94a3b8] text-sm mb-3">{description}</p>
            <p className="text-[#2563eb] text-sm font-semibold">{action}</p>
        </div>
    );
}

// Componente para headers de sección
interface SectionHeaderProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function SectionHeader({ icon, title, description }: SectionHeaderProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <div className="text-[#2563eb]">
                        {icon}
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">{title}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] text-sm mt-1">{description}</p>
                </div>
            </div>
        </div>
    );
}
