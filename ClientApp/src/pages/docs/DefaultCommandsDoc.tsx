import { Zap, Info, Users, Shield, Settings } from 'lucide-react';
import CodeBlock from '../../components/docs/CodeBlock';

export default function DefaultCommandsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl flex items-center justify-center border border-[#e2e8f0] dark:border-[#374151]">
                        <Zap className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white">Comandos por Defecto</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Comandos preconfigurados listos para usar en tu canal
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <StatCard icon={<Info />} count="5+" label="Informativos" />
                    <StatCard icon={<Users />} count="3+" label="Interactivos" />
                    <StatCard icon={<Shield />} count="4+" label="Moderación" />
                    <StatCard icon={<Settings />} count="2+" label="Configuración" />
                </div>
            </div>

            {/* Comandos Informativos */}
            <section>
                <SectionHeader
                    icon={<Info className="w-8 h-8" />}
                    title="Comandos Informativos"
                    description="Información sobre el canal y estadísticas"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <CommandCard
                        name="!uptime"
                        description="Muestra cuánto tiempo lleva el stream en vivo"
                        usage="!uptime"
                        example="El stream lleva 2 horas, 30 minutos en vivo"
                        permission="Todos"
                    />

                    <CommandCard
                        name="!followage"
                        description="Muestra cuánto tiempo llevas siguiendo el canal"
                        usage={["!followage", "!followage @usuario"]}
                        example="Anthonydeca sigue desde hace 2 años, 3 meses"
                        permission="Todos"
                    />

                    <CommandCard
                        name="!game"
                        description="Muestra el juego/categoría actual del stream"
                        usage="!game"
                        example="Estamos jugando League of Legends"
                        permission="Todos"
                    />

                    <CommandCard
                        name="!title"
                        description="Muestra el título actual del stream"
                        usage="!title"
                        example="🔴 LIVE | Rankeds hasta Diamante | !discord"
                        permission="Todos"
                    />

                    <CommandCard
                        name="!commands"
                        description="Lista todos los comandos disponibles"
                        usage="!commands"
                        example="Comandos disponibles: !uptime, !followage, !game..."
                        permission="Todos"
                    />
                </div>
            </section>

            {/* Comandos Interactivos */}
            <section>
                <SectionHeader
                    icon={<Users className="w-8 h-8" />}
                    title="Comandos Interactivos"
                    description="Comandos para interactuar con la comunidad"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <CommandCard
                        name="!shoutout / !so"
                        description="Da un shoutout a otro streamer"
                        usage="!so @streamer"
                        example="¡Todos vayan a seguir a @streamer! Hace contenido increíble de [Categoría]"
                        permission="Moderadores"
                    />

                    <CommandCard
                        name="!poll"
                        description="Crea una encuesta rápida en el chat"
                        usage="!poll ¿Pregunta? Opción1 | Opción2 | Opción3"
                        example="📊 Encuesta: ¿Pregunta? 1️⃣ Opción1 2️⃣ Opción2 3️⃣ Opción3"
                        permission="Moderadores"
                    />

                    <CommandCard
                        name="!lurk"
                        description="Avisa que estás en modo lurk"
                        usage="!lurk"
                        example="Anthonydeca está en modo lurk 👀 ¡Gracias por el apoyo!"
                        permission="Todos"
                    />
                </div>
            </section>

            {/* Comandos de Moderación */}
            <section>
                <SectionHeader
                    icon={<Shield className="w-8 h-8" />}
                    title="Comandos de Moderación"
                    description="Herramientas para moderar el chat"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <CommandCard
                        name="!timeout / !to"
                        description="Pone timeout a un usuario"
                        usage={["!timeout @usuario 600", "!to @usuario 10m"]}
                        example="@usuario ha sido puesto en timeout por 10 minutos"
                        permission="Moderadores"
                    />

                    <CommandCard
                        name="!ban"
                        description="Banea permanentemente a un usuario"
                        usage="!ban @usuario [razón]"
                        example="@usuario ha sido baneado del canal"
                        permission="Moderadores"
                    />

                    <CommandCard
                        name="!clear / !purge"
                        description="Limpia mensajes de un usuario"
                        usage="!clear @usuario"
                        example="Se han limpiado todos los mensajes de @usuario"
                        permission="Moderadores"
                    />

                    <CommandCard
                        name="!slow"
                        description="Activa modo lento en el chat"
                        usage={["!slow 30", "!slow off"]}
                        example="Modo lento activado: 1 mensaje cada 30 segundos"
                        permission="Moderadores"
                    />
                </div>
            </section>

            {/* Ejemplo de Uso */}
            <section className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                    💡 Ejemplo de Uso en Chat
                </h3>
                <CodeBlock
                    code={`# Usuario normal
Viewer123: !uptime
Bot: El stream lleva 2 horas, 15 minutos en vivo ⏱️

# Moderador usando comandos
Moderador: !so @FriendStreamer
Bot: ¡Todos vayan a seguir a @FriendStreamer! Hace contenido increíble de Just Chatting 🎉

# Followage de otro usuario
Viewer123: !followage @Anthonydeca
Bot: Anthonydeca sigue desde hace 2 años, 3 meses, 15 días 💜`}
                />
            </section>

            {/* Consejos */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-3">
                    💡 Consejos
                </h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-300">
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Los comandos por defecto están siempre disponibles y no se pueden eliminar</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Puedes desactivar comandos individuales desde el panel de configuración</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Los alias (como !so para !shoutout) funcionan igual que el comando principal</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Los comandos de moderación requieren que el bot tenga permisos de moderador</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

// Componente para tarjetas de comandos
interface CommandCardProps {
    name: string;
    description: string;
    usage: string | string[];
    example: string;
    permission: string;
}

function CommandCard({ name, description, usage, example, permission }: CommandCardProps) {
    const usageArray = Array.isArray(usage) ? usage : [usage];

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden hover:shadow-lg transition-all">
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <code className="text-lg font-bold text-[#2563eb] bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
                        {name}
                    </code>
                    <span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-bold">
                        {permission}
                    </span>
                </div>

                <p className="text-[#64748b] dark:text-[#94a3b8] text-sm mb-3">
                    {description}
                </p>

                <div className="space-y-2">
                    <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg p-3 border border-[#e2e8f0] dark:border-[#374151]">
                        <span className="text-[#64748b] dark:text-[#94a3b8] font-medium text-sm block mb-1">
                            Uso:
                        </span>
                        {usageArray.map((u, idx) => (
                            <code key={idx} className="block text-gray-800 dark:text-[#f8fafc] font-mono text-sm">
                                {u}
                            </code>
                        ))}
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <span className="text-green-700 dark:text-green-400 font-medium text-sm block mb-1">
                            Ejemplo:
                        </span>
                        <code className="text-green-800 dark:text-green-300 font-mono text-sm">
                            {example}
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Componente para estadísticas
interface StatCardProps {
    icon: React.ReactNode;
    count: string;
    label: string;
}

function StatCard({ icon, count, label }: StatCardProps) {
    return (
        <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-xl p-3 text-center border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-all">
            <div className="flex items-center justify-center mb-1 text-[#2563eb]">
                {icon}
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{count}</div>
            <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{label}</div>
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
