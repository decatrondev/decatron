import { User, Tv, Hash, Dice1, Clock as ClockIcon, Zap } from 'lucide-react';
import CodeBlock from '../../components/docs/CodeBlock';
import VariableCard from '../../components/docs/VariableCard';

export default function VariablesDoc() {
    return (
        <div className="space-y-8">
            {/* Header con colores del sistema */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl flex items-center justify-center border border-[#e2e8f0] dark:border-[#374151]">
                        <Hash className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white">Sistema de Variables</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Placeholders dinámicos para comandos interactivos
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
                    <StatCard icon={<User />} count="3" label="Usuario" />
                    <StatCard icon={<Tv />} count="3" label="Canal" />
                    <StatCard icon={<Hash />} count="2" label="Twitch" />
                    <StatCard icon={<Dice1 />} count="5" label="Utilidades" />
                    <StatCard icon={<ClockIcon />} count="2" label="Tiempo" />
                    <StatCard icon={<Zap />} count="2" label="Contadores" />
                </div>
            </div>

            {/* Variables de Usuario */}
            <section id="user-variables" className="scroll-mt-20">
                <SectionHeader
                    icon={<User className="w-8 h-8" />}
                    title="Variables de Usuario"
                    color="blue"
                    description="Información dinámica sobre usuarios en el chat"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <VariableCard
                        name="$(user)"
                        description="Nombre del usuario que ejecutó el comando"
                        example={{
                            command: "!saludo",
                            response: "Hola $(user)!",
                            result: "Hola Anthonydeca!"
                        }}
                    />

                    <VariableCard
                        name="$(touser)"
                        description="Usuario mencionado en el comando (destinatario). Si no se menciona a nadie, usa el ejecutor."
                        example={{
                            command: "!slap @pepito",
                            response: "$(user) le da una cachetada a $(touser) 👋",
                            result: "Anthonydeca le da una cachetada a pepito 👋"
                        }}
                    />

                    <VariableCard
                        name="$(ruser)"
                        description="Usuario aleatorio del chat en ese momento (usa Twitch API)"
                        example={{
                            command: "!regalo",
                            response: "🎁 $(ruser) ha ganado el regalo de hoy!",
                            result: "🎁 randomviewer123 ha ganado el regalo de hoy!"
                        }}
                    />
                </div>
            </section>

            {/* Variables de Canal */}
            <section id="channel-variables" className="scroll-mt-20">
                <SectionHeader
                    icon={<Tv className="w-8 h-8" />}
                    title="Variables de Canal"
                    color="purple"
                    description="Información sobre el canal y stream actual"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <VariableCard
                        name="$(channel)"
                        description="Nombre del canal actual"
                        example={{
                            command: "!canal",
                            response: "Estás viendo el canal de $(channel)",
                            result: "Estás viendo el canal de Anthonydeca"
                        }}
                    />

                    <VariableCard
                        name="$(game)"
                        description="Juego/categoría actual del stream"
                        example={{
                            command: "!game",
                            response: "Estamos jugando $(game)",
                            result: "Estamos jugando League of Legends"
                        }}
                    />

                    <VariableCard
                        name="$(uptime)"
                        description="Tiempo que lleva el stream en vivo"
                        example={{
                            command: "!uptime",
                            response: "Stream en vivo por $(uptime)",
                            result: "Stream en vivo por 2 horas, 30 minutos"
                        }}
                    />
                </div>
            </section>

            {/* Variables de Twitch */}
            <section id="twitch-variables" className="scroll-mt-20">
                <SectionHeader
                    icon={<Hash className="w-8 h-8" />}
                    title="Variables de Información de Twitch"
                    color="indigo"
                    description="Datos específicos de Twitch en tiempo real"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <VariableCard
                        name="$(followage)"
                        description="Muestra cuánto tiempo lleva siguiendo el canal. Inteligente: toma el primer argumento del comando, o el ejecutor si no hay argumentos."
                        intelligent
                        example={{
                            usage: [
                                "!followage              → 2 años, 3 meses, 15 días",
                                "!followage pepito       → 1 año, 2 meses, 5 días",
                                "!followage @deca        → 5 años, 1 mes"
                            ]
                        }}
                    />

                    <VariableCard
                        name="$(accountage)"
                        description="Muestra cuánto tiempo tiene la cuenta de Twitch. Inteligente: toma el primer argumento del comando, o el ejecutor si no hay argumentos."
                        intelligent
                        example={{
                            usage: [
                                "!accountage             → 5 años, 8 meses, 22 días",
                                "!accountage pepito      → 3 años, 1 mes, 10 días",
                                "!accountage @deca       → 7 años, 2 meses"
                            ]
                        }}
                    />
                </div>
            </section>

            {/* Variables de Contadores */}
            <section id="counter-variables" className="scroll-mt-20">
                <SectionHeader
                    icon={<Zap className="w-8 h-8" />}
                    title="Variables de Contadores"
                    color="yellow"
                    description="Mantén estadísticas y contadores personalizados"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <VariableCard
                        name="$(count)"
                        description="Contador avanzado con operaciones. Todos pueden ver/incrementar, solo mods pueden usar set/reset."
                        example={{
                            usage: [
                                "!muertes              → Muertes: 42",
                                "!muertes +            → Muertes: 43",
                                "!muertes -5           → Muertes: 38",
                                "!muertes set 100      → Muertes: 100 (solo mods)",
                                "!muertes reset        → Muertes: 0 (solo mods)"
                            ]
                        }}
                    />

                    <VariableCard
                        name="$(uses)"
                        description="Contador simple que auto-incrementa cada vez que se usa el comando"
                        example={{
                            command: "!usos",
                            response: "Este comando se ha usado $(uses) veces",
                            result: "Este comando se ha usado 125 veces"
                        }}
                    />
                </div>
            </section>

            {/* Variables de Utilidad */}
            <section id="utility-variables" className="scroll-mt-20">
                <SectionHeader
                    icon={<Dice1 className="w-8 h-8" />}
                    title="Variables de Utilidad"
                    color="green"
                    description="Herramientas aleatorias para comandos interactivos"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <VariableCard
                        name="$(roll)"
                        description="Número aleatorio. Por defecto 1-100, o especifica rango con $(roll:min-max)"
                        example={{
                            usage: [
                                "$(roll)               → 42",
                                "$(roll:1-6)           → 4",
                                "$(roll:1-20)          → 17"
                            ]
                        }}
                    />

                    <VariableCard
                        name="$(flip)"
                        description="Lanzar una moneda (Cara o Cruz)"
                        example={{
                            command: "!moneda",
                            response: "Resultado: $(flip)",
                            result: "Resultado: Cara"
                        }}
                    />

                    <VariableCard
                        name="$(8ball)"
                        description="Bola mágica 8 con 20 respuestas aleatorias en español"
                        example={{
                            command: "!8ball",
                            response: "La bola dice: $(8ball)",
                            result: "La bola dice: Es muy probable"
                        }}
                    />

                    <VariableCard
                        name="$(choice:opciones)"
                        description="Elige aleatoriamente entre opciones separadas por coma o |"
                        example={{
                            usage: [
                                "$(choice:Pizza,Tacos,Hamburguesa)    → Tacos",
                                "$(choice:Sí|No|Tal vez)              → Tal vez"
                            ]
                        }}
                    />

                    <VariableCard
                        name="$(percent)"
                        description="Porcentaje aleatorio de 0-100%"
                        example={{
                            command: "!vibes",
                            response: "Tus vibes de hoy: $(percent)%",
                            result: "Tus vibes de hoy: 87%"
                        }}
                    />
                </div>
            </section>

            {/* Variables de Tiempo */}
            <section id="time-variables" className="scroll-mt-20">
                <SectionHeader
                    icon={<ClockIcon className="w-8 h-8" />}
                    title="Variables de Tiempo"
                    color="orange"
                    description="Fecha y hora actual con formatos personalizables"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <VariableCard
                        name="$(time)"
                        description="Hora actual. Usa $(time:formato) para formato personalizado"
                        example={{
                            usage: [
                                "$(time)                → 15:30:45",
                                "$(time:HH:mm)          → 15:30",
                                "$(time:hh:mm tt)       → 03:30 PM"
                            ]
                        }}
                    />

                    <VariableCard
                        name="$(date)"
                        description="Fecha actual. Usa $(date:formato) para formato personalizado"
                        example={{
                            usage: [
                                "$(date)                → 10/11/2025",
                                "$(date:dd/MM/yyyy)     → 10/11/2025",
                                "$(date:yyyy-MM-dd)     → 2025-11-10"
                            ]
                        }}
                    />
                </div>
            </section>

            {/* Ejemplos Completos */}
            <section className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                    💡 Ejemplos de Comandos Completos
                </h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-bold text-[#64748b] dark:text-[#f8fafc] mb-3">Crear comandos con variables:</h4>
                        <CodeBlock
                            code={`# Comando de saludo personalizado
!crear !hola Hola $(user)! Bienvenido al stream de $(channel)

# Información del stream
!crear !info $(channel) está jugando $(game) | En vivo por $(uptime)

# Followage inteligente
!crear !followage $(user) sigue desde hace $(followage)

# Estadísticas completas
!crear !stats $(user) | Sigue: $(followage) | Cuenta: $(accountage) | Juego: $(game)`}
                        />
                    </div>

                    <div>
                        <h4 className="font-bold text-[#64748b] dark:text-[#f8fafc] mb-3">Ejecutar comandos:</h4>
                        <CodeBlock
                            code={`# Comando sin argumentos
!followage
→ Anthonydeca sigue desde hace 2 años, 3 meses, 15 días

# Comando con argumento
!followage pepito
→ Anthonydeca sigue desde hace 1 año, 2 meses, 5 días

# Con @ (se limpia automáticamente)
!followage @deca
→ Anthonydeca sigue desde hace 5 años, 1 mes`}
                        />
                    </div>
                </div>
            </section>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-3">
                    💡 Consejos
                </h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-300">
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Las variables se resuelven en tiempo real cuando se ejecuta el comando</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Puedes combinar múltiples variables en una sola respuesta</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Las variables inteligentes como $(followage) detectan argumentos automáticamente</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>$(count) solo permite set/reset a moderadores y el dueño del canal</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

// Componente para las estadísticas del header
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

// Componente para los headers de sección
interface SectionHeaderProps {
    icon: React.ReactNode;
    title: string;
    color?: string; // Mantener por compatibilidad pero no se usa
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
