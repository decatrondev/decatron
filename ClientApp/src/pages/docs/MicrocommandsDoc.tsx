import { Zap, Terminal, Code2, Sparkles } from 'lucide-react';
import CodeBlock from '../../components/docs/CodeBlock';

export default function MicrocommandsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl flex items-center justify-center border border-[#e2e8f0] dark:border-[#374151]">
                        <Zap className="w-8 h-8 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white">Micro Comandos</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Comandos rápidos con sintaxis simplificada para acciones comunes
                        </p>
                    </div>
                </div>
            </div>

            {/* Introducción */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    ¿Qué son los Micro Comandos?
                </h2>
                <p className="text-gray-800 dark:text-gray-200 mb-4">
                    Los <strong>Micro Comandos</strong> son una característica poderosa que te permite crear comandos
                    complejos usando una sintaxis simple y directa, sin necesidad de escribir código.
                </p>
                <p className="text-gray-800 dark:text-gray-200">
                    A diferencia de los comandos personalizados normales, los micro comandos pueden:
                </p>
                <ul className="mt-3 space-y-2 text-gray-800 dark:text-gray-200">
                    <li className="flex gap-2">
                        <span className="text-purple-600">✓</span>
                        <span>Ejecutar múltiples acciones en una sola línea</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-purple-600">✓</span>
                        <span>Modificar contadores y variables automáticamente</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-purple-600">✓</span>
                        <span>Combinar texto con acciones del bot</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-purple-600">✓</span>
                        <span>Realizar cálculos matemáticos simples</span>
                    </li>
                </ul>
            </div>

            {/* Sintaxis Básica */}
            <section>
                <SectionHeader
                    icon={<Terminal className="w-8 h-8" />}
                    title="Sintaxis Básica"
                    description="Cómo escribir micro comandos"
                />

                <div className="mt-4 space-y-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Estructura General</h3>
                        <CodeBlock
                            code={`!comando [acción] [parámetros]

# Ejemplo básico:
!muertes +1

# Con respuesta personalizada:
!muertes +1 | $(user) ha añadido una muerte. Total: $(count)`}
                        />
                    </div>
                </div>
            </section>

            {/* Acciones Disponibles */}
            <section>
                <SectionHeader
                    icon={<Code2 className="w-8 h-8" />}
                    title="Acciones Disponibles"
                    description="Lista completa de acciones que puedes usar"
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <ActionCard
                        action="+N"
                        description="Incrementa un contador en N"
                        example="!muertes +1"
                        result="Muertes: 43"
                    />

                    <ActionCard
                        action="-N"
                        description="Decrementa un contador en N"
                        example="!vidas -1"
                        result="Vidas: 2"
                    />

                    <ActionCard
                        action="set N"
                        description="Establece un contador a un valor específico"
                        example="!puntos set 100"
                        result="Puntos: 100"
                        permission="Solo Mods"
                    />

                    <ActionCard
                        action="reset"
                        description="Reinicia un contador a 0"
                        example="!muertes reset"
                        result="Muertes: 0"
                        permission="Solo Mods"
                    />
                </div>
            </section>

            {/* Ejemplos Prácticos */}
            <section>
                <SectionHeader
                    icon={<Sparkles className="w-8 h-8" />}
                    title="Ejemplos Prácticos"
                    description="Micro comandos listos para usar en tu canal"
                />

                <div className="mt-4 space-y-4">
                    <ExampleCard
                        title="Contador de Muertes"
                        description="Rastrea muertes en juegos"
                        code={`# Comando base
!crear !muertes Muertes de hoy: $(count)

# Incrementar
!muertes +1
→ Muertes de hoy: 43

# Restar (si te equivocaste)
!muertes -1
→ Muertes de hoy: 42

# Reiniciar al empezar el stream (solo mods)
!muertes reset
→ Muertes de hoy: 0`}
                    />

                    <ExampleCard
                        title="Sistema de Vidas"
                        description="Contador de vidas en retos"
                        code={`# Comando base
!crear !vidas Vidas restantes: $(count)

# Establecer vidas al inicio (solo mods)
!vidas set 3
→ Vidas restantes: 3

# Perder una vida
!vidas -1
→ Vidas restantes: 2

# Mensaje personalizado
!crear !muero !vidas -1 | $(user) ha perdido una vida. Quedan $(count) vidas`}
                    />

                    <ExampleCard
                        title="Contador de Wins"
                        description="Rastrea victorias"
                        code={`# Comando base
!crear !wins Victorias de hoy: $(count) 🏆

# Añadir victoria
!wins +1
→ Victorias de hoy: 5 🏆

# Con mensaje personalizado
!crear !win !wins +1 | ¡$(user) celebra la victoria #$(count)! 🎉`}
                    />

                    <ExampleCard
                        title="Contador con Múltiples Respuestas"
                        description="Combinando acciones con texto dinámico"
                        code={`# Crear comando con contador y variables
!crear !intentos !intentos +1 | $(user) ha intentado el nivel $(count) veces

# Usar el comando
Viewer: !intentos
→ Viewer ha intentado el nivel 15 veces

# El contador se incrementa automáticamente cada uso`}
                    />
                </div>
            </section>

            {/* Combinaciones Avanzadas */}
            <section className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                    🚀 Combinaciones Avanzadas
                </h3>

                <div className="space-y-4">
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-3">Múltiples Contadores</h4>
                        <CodeBlock
                            code={`# Comando que gestiona wins y losses
!crear !victoria !wins +1 | !losses reset | ¡Victoria! Total: $(wins) wins

# Comando que gestiona losses
!crear !derrota !losses +1 | !wins reset | Derrota... Total: $(losses) losses`}
                        />
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-3">Con Variables del Sistema</h4>
                        <CodeBlock
                            code={`# Muerte con usuario que la reporta
!crear !muerte !muertes +1 | $(user) reporta muerte #$(count)

# Gacha con contador de intentos
!crear !gacha !intentos +1 | $(user) sacó $(choice:SSR,SR,R,N) en intento #$(count)`}
                        />
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-3">Estadísticas Completas</h4>
                        <CodeBlock
                            code={`# Comando que muestra múltiples stats
!crear !stats Muertes: $(muertes) | Wins: $(wins) | Intentos: $(intentos)

# Resetear todas las estadísticas (solo mods)
!crear !resetstats !muertes reset | !wins reset | !intentos reset | Stats reseteadas ✓`}
                        />
                    </div>
                </div>
            </section>

            {/* Diferencias con Scripts */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-300 mb-3">
                    ⚖️ Micro Comandos vs Scripts
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold text-amber-900 dark:text-amber-400 mb-2">Micro Comandos</h4>
                        <ul className="space-y-2 text-amber-800 dark:text-amber-300 text-sm">
                            <li>✓ Sintaxis simple y directa</li>
                            <li>✓ Ideal para contadores y acciones básicas</li>
                            <li>✓ No requiere conocimientos de programación</li>
                            <li>✓ Se crean directamente desde el chat</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-amber-900 dark:text-amber-400 mb-2">Scripts</h4>
                        <ul className="space-y-2 text-amber-800 dark:text-amber-300 text-sm">
                            <li>✓ Lógica compleja con condicionales</li>
                            <li>✓ Acceso completo a APIs externas</li>
                            <li>✓ Cálculos matemáticos avanzados</li>
                            <li>✓ Requiere conocimientos de JavaScript</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Consejos */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-3">
                    💡 Consejos
                </h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-300">
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Los micro comandos se procesan instantáneamente, más rápido que scripts completos</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Usa +1 y -1 para incrementos simples, puedes usar cualquier número (+5, -10, etc.)</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Solo moderadores y el broadcaster pueden usar 'set' y 'reset'</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Combina micro comandos con variables del sistema para máxima flexibilidad</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Si necesitas lógica condicional (if/else), usa Scripts en lugar de micro comandos</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

// Componente para ejemplos detallados
interface ExampleCardProps {
    title: string;
    description: string;
    code: string;
}

function ExampleCard({ title, description, code }: ExampleCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
            <div className="bg-purple-50 dark:bg-purple-900/20 px-6 py-4 border-b border-purple-200 dark:border-purple-800">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                <p className="text-[#64748b] dark:text-[#94a3b8] text-sm mt-1">{description}</p>
            </div>
            <div className="p-6">
                <CodeBlock code={code} />
            </div>
        </div>
    );
}

// Componente para tarjetas de acciones
interface ActionCardProps {
    action: string;
    description: string;
    example: string;
    result: string;
    permission?: string;
}

function ActionCard({ action, description, example, result, permission }: ActionCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden hover:shadow-lg transition-all">
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <code className="text-lg font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-lg">
                        {action}
                    </code>
                    {permission && (
                        <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold">
                            {permission}
                        </span>
                    )}
                </div>

                <p className="text-[#64748b] dark:text-[#94a3b8] text-sm mb-3">
                    {description}
                </p>

                <div className="space-y-2">
                    <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg p-3 border border-[#e2e8f0] dark:border-[#374151]">
                        <span className="text-[#64748b] dark:text-[#94a3b8] font-medium text-sm block mb-1">
                            Ejemplo:
                        </span>
                        <code className="block text-gray-800 dark:text-[#f8fafc] font-mono text-sm">
                            {example}
                        </code>
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <span className="text-green-700 dark:text-green-400 font-medium text-sm block mb-1">
                            Resultado:
                        </span>
                        <code className="text-green-800 dark:text-green-300 font-mono text-sm">
                            {result}
                        </code>
                    </div>
                </div>
            </div>
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
                <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <div className="text-purple-600">
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
