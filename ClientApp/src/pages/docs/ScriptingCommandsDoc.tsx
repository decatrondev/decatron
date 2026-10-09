import { Code, Cpu, Puzzle, Rocket, AlertTriangle, Sparkles, Zap, GraduationCap } from 'lucide-react';
import CodeBlock from '../../components/docs/CodeBlock';

export default function ScriptingCommandsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-bg rounded-lg flex items-center justify-center border border-ds-border">
                        <Code className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-ds-text">Comandos con Scripts</h1>
                        <p className="text-ds-soft mt-1">
                            Crea comandos personalizados con lógica avanzada usando scripting
                        </p>
                    </div>
                </div>
            </div>

            {/* Introducción */}
            <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                <h2 className="text-2xl font-black text-ds-text mb-4 flex items-center gap-2">
                    <Rocket className="w-6 h-6 text-ds-accent-text" />
                    ¿Qué son los Scripts?
                </h2>
                <p className="text-ds-text mb-4">
                    Los <strong>Scripts</strong> son comandos que ejecutan código con lógica avanzada, dándote
                    control total sobre el comportamiento del bot.
                </p>
                <p className="text-ds-text">
                    Con scripts puedes:
                </p>
                <ul className="mt-3 space-y-2 text-ds-text">
                    <li className="flex gap-2">
                        <span className="text-ds-ok">✓</span>
                        <span>Usar variables y almacenar valores</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-ds-ok">✓</span>
                        <span>Implementar lógica condicional con when/then/end</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-ds-ok">✓</span>
                        <span>Generar números aleatorios y hacer picks</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-ds-ok">✓</span>
                        <span>Crear contadores y sistemas interactivos</span>
                    </li>
                </ul>
            </div>

            {/* Sintaxis Básica */}
            <section>
                <SectionHeader
                    icon={<Puzzle className="w-8 h-8" />}
                    title="Sintaxis Básica"
                    description="Estructura básica de un script"
                />

                <div className="mt-4 space-y-4">
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-bold text-ds-text mb-4">Declaraciones</h3>
                        <p className="text-ds-soft mb-4">
                            Un script está compuesto por declaraciones que se ejecutan en orden:
                        </p>
                        <CodeBlock
                            language="javascript"
                            code={`set variable = valor
send "mensaje"

when $(variable) > 5 then
    send "respuesta"
end`}
                        />
                    </div>

                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-bold text-ds-text mb-4">Variables</h3>
                        <p className="text-ds-soft mb-4">
                            Usa <code className="bg-ds-bg px-2 py-1 rounded text-sm">set</code> para declarar variables y <code className="bg-ds-bg px-2 py-1 rounded text-sm">$(nombre)</code> para usarlas:
                        </p>
                        <CodeBlock
                            language="javascript"
                            code={`set nombre = "Juan"
set edad = 25
send "Hola $(nombre), tienes $(edad) años"`}
                        />
                    </div>

                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-bold text-ds-text mb-4">Condicionales</h3>
                        <p className="text-ds-soft mb-4">
                            Usa <code className="bg-ds-bg px-2 py-1 rounded text-sm">when/then/end</code> para lógica condicional.
                            Para manejar multiples condiciones, usa bloques <code className="bg-ds-bg px-2 py-1 rounded text-sm">when</code> separados:
                        </p>
                        <CodeBlock
                            language="javascript"
                            code={`set numero = roll(1, 10)

when $(numero) > 5 then
    send "Mayor que 5!"
end

when $(numero) <= 5 then
    send "Menor o igual a 5"
end`}
                        />
                    </div>
                </div>
            </section>

            {/* Variables del Sistema */}
            <section>
                <SectionHeader
                    icon={<Cpu className="w-8 h-8" />}
                    title="Variables del Sistema"
                    description="Datos que puedes usar dentro de tus scripts"
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <VariableCard
                        name="$(user)"
                        type="string"
                        description="Usuario que ejecutó el comando"
                        example='send "Hola $(user)!"'
                    />

                    <VariableCard
                        name="$(channel)"
                        type="string"
                        description="Canal actual del stream"
                        example='send "Estás en $(channel)"'
                    />

                    <VariableCard
                        name="$(game)"
                        type="string"
                        description="Juego/categoría actual"
                        example='send "Jugando $(game)"'
                    />

                    <VariableCard
                        name="$(uptime)"
                        type="string"
                        description="Tiempo que lleva el stream en vivo"
                        example='send "En vivo: $(uptime)"'
                    />

                    <VariableCard
                        name="$(ruser)"
                        type="string"
                        description="Usuario aleatorio del chat"
                        example='send "Usuario random: $(ruser)"'
                    />

                    <VariableCard
                        name="$(touser)"
                        type="string"
                        description="Usuario mencionado con @"
                        example='send "Saludos para $(touser)"'
                    />
                </div>
            </section>

            {/* Funciones Built-in */}
            <section>
                <SectionHeader
                    icon={<Code className="w-8 h-8" />}
                    title="Funciones Built-in"
                    description="Funciones disponibles en tus scripts"
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                    <FunctionCard
                        name="roll(min, max)"
                        description="Número aleatorio entre min y max"
                        example="roll(1, 100)"
                    />

                    <FunctionCard
                        name='pick("a, b, c")'
                        description="Elige una opción aleatoria"
                        example='pick("pizza, tacos, sushi")'
                    />

                    <FunctionCard
                        name="count()"
                        description="Incrementa contador del comando"
                        example="count()"
                    />
                </div>
            </section>

            {/* Operadores */}
            <section>
                <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                    <h3 className="text-xl font-bold text-ds-text mb-4">Operadores</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-bold text-ds-accent-text mb-2">Comparación</h4>
                            <ul className="space-y-1 text-sm text-ds-text font-mono">
                                <li>== &nbsp;&nbsp;Igual a</li>
                                <li>!= &nbsp;&nbsp;Diferente de</li>
                                <li>&gt; &nbsp;&nbsp;&nbsp;Mayor que</li>
                                <li>&lt; &nbsp;&nbsp;&nbsp;Menor que</li>
                                <li>&gt;= &nbsp;&nbsp;Mayor o igual</li>
                                <li>&lt;= &nbsp;&nbsp;Menor o igual</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-ds-accent-text mb-2">Aritméticos</h4>
                            <ul className="space-y-1 text-sm text-ds-text font-mono">
                                <li>+ &nbsp;&nbsp;&nbsp;Suma</li>
                                <li>- &nbsp;&nbsp;&nbsp;Resta</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Ejemplos Prácticos */}
            <section>
                <SectionHeader
                    icon={<Code className="w-8 h-8" />}
                    title="Ejemplos Prácticos"
                    description="Scripts listos para usar y adaptar"
                />

                <div className="mt-4 space-y-4">
                    <ExampleCard
                        title="Dado Simple"
                        description="Tira un dado de 6 caras"
                        code={`set resultado = roll(1, 6)
send "🎲 $(user) lanzó un dado y obtuvo: $(resultado)"`}
                        category="basic"
                    />

                    <ExampleCard
                        title="Pick Aleatorio"
                        description="Elige entre múltiples opciones"
                        code={`set opciones = "pizza, tacos, sushi, hamburguesa"
set eleccion = pick($(opciones))
send "🍕 $(user), te recomiendo: $(eleccion)"`}
                        category="basic"
                    />

                    <ExampleCard
                        title="Contador"
                        description="Cuenta los usos del comando"
                        code={`set contador = count()
send "📊 Este comando se ha usado $(contador) veces por $(user)"`}
                        category="basic"
                    />

                    <ExampleCard
                        title="Dos Dados"
                        description="Tira dos dados y suma el resultado"
                        code={`set dado1 = roll(1, 6)
set dado2 = roll(1, 6)
set total = $(dado1) + $(dado2)

when $(dado1) == $(dado2) then
    send "🎲🎲 DOBLES! $(user) sacó $(dado1) y $(dado2) = $(total)"
end

when $(dado1) != $(dado2) then
    send "🎲 $(user) sacó $(dado1) + $(dado2) = $(total)"
end`}
                        category="intermediate"
                    />

                    <ExampleCard
                        title="Sistema de Suerte"
                        description="Porcentaje de suerte con rangos"
                        code={`set suerte = roll(1, 100)

when $(suerte) >= 90 then
    send "⭐ LEGENDARIA! $(user) tiene $(suerte)% de suerte"
end

when $(suerte) >= 70 then
    send "🔥 Buena suerte: $(user) tiene $(suerte)%"
end

when $(suerte) >= 50 then
    send "👍 Suerte normal: $(user) tiene $(suerte)%"
end

when $(suerte) < 50 then
    send "😅 Mala suerte: $(user) tiene $(suerte)%"
end`}
                        category="intermediate"
                    />

                    <ExampleCard
                        title="Contador con Mensajes"
                        description="Contador con diferentes respuestas"
                        code={`set contador = count()
set usuario = $(user)

when $(contador) == 1 then
    send "🎉 ¡Primera vez usando este comando, $(usuario)!"
end

when $(contador) > 100 then
    send "🏆 ¡Wow! Este comando se ha usado $(contador) veces"
end

when $(contador) > 10 then
    send "📊 Comando popular: $(contador) usos"
end

when $(contador) <= 10 then
    send "📊 Comando usado $(contador) veces"
end`}
                        category="intermediate"
                    />
                </div>
            </section>

            {/* Seguridad */}
            <div className="bg-ds-raised border border-ds-border rounded-lg p-6">
                <h3 className="text-xl font-bold text-ds-accent-text mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Límites y Restricciones
                </h3>
                <ul className="space-y-2 text-ds-accent-text">
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Los scripts tienen un tiempo máximo de ejecución de 5 segundos</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Tamaño máximo del script: 10,000 caracteres</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Profundidad máxima de anidación: 10 niveles</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Siempre valida tu script antes de guardar para detectar errores</span>
                    </li>
                </ul>
            </div>

            {/* Consejos */}
            <div className="bg-ds-surface border border-ds-border rounded-lg p-6">
                <h3 className="text-xl font-bold text-ds-accent-text mb-3">
                    💡 Consejos y Mejores Prácticas
                </h3>
                <ul className="space-y-2 text-ds-accent-text">
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Usa el botón "Validar" en el editor para verificar la sintaxis antes de guardar</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Prueba tu script con la consola de pruebas para ver cómo se ejecuta</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Las condiciones when se evalúan en orden, la primera que cumpla se ejecuta</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Usa plantillas rápidas en el editor para empezar más rápido</span>
                    </li>
                    <li className="flex gap-2">
                        <span>•</span>
                        <span>Puedes usar count("nombre") para tener múltiples contadores en un mismo comando</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

// Componente para ejemplos de scripts
interface ExampleCardProps {
    title: string;
    description: string;
    code: string;
    category: 'basic' | 'intermediate' | 'advanced';
}

function ExampleCard({ title, description, code, category }: ExampleCardProps) {
    const categoryColors = {
        basic: 'bg-ds-raised border-ds-border text-ds-accent-text ',
        intermediate: 'bg-ds-raised border-ds-border text-ds-accent-text ',
        advanced: 'bg-ds-raised border-ds-border text-ds-accent-text '
    };

    const categoryLabels = {
        basic: 'Básico',
        intermediate: 'Intermedio',
        advanced: 'Avanzado'
    };

    const categoryIcons = {
        basic: Sparkles,
        intermediate: Zap,
        advanced: GraduationCap
    };

    const Icon = categoryIcons[category];

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
            <div className={`px-6 py-4 border-b ${categoryColors[category]} border`}>
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-ds-text">{title}</h3>
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${categoryColors[category]}`}>
                        <Icon className="w-3 h-3" />
                        {categoryLabels[category]}
                    </span>
                </div>
                <p className="text-ds-soft text-sm mt-1">{description}</p>
            </div>
            <div className="p-6">
                <CodeBlock code={code} language="javascript" />
            </div>
        </div>
    );
}

// Componente para variables disponibles
interface VariableCardProps {
    name: string;
    type: string;
    description: string;
    example: string;
}

function VariableCard({ name, type, description, example }: VariableCardProps) {
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
                <code className="text-base font-bold text-ds-accent-text">
                    {name}
                </code>
                <span className="px-2 py-1 bg-ds-bg text-ds-text rounded text-xs font-mono">
                    {type}
                </span>
            </div>
            <p className="text-ds-soft text-sm mb-3">
                {description}
            </p>
            <div className="bg-ds-bg rounded-lg p-2 border border-ds-border">
                <code className="text-xs text-ds-text font-mono">
                    {example}
                </code>
            </div>
        </div>
    );
}

// Componente para funciones
interface FunctionCardProps {
    name: string;
    description: string;
    example: string;
}

function FunctionCard({ name, description, example }: FunctionCardProps) {
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-4 transition-all">
            <code className="text-base font-bold text-ds-accent-text block mb-2">
                {name}
            </code>
            <p className="text-ds-soft text-sm mb-3">
                {description}
            </p>
            <div className="bg-ds-bg rounded-lg p-2 border border-ds-border">
                <code className="text-xs text-ds-accent-text font-mono">
                    {example}
                </code>
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
        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center flex-shrink-0">
                    <div className="text-ds-accent-text">
                        {icon}
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-ds-text">{title}</h2>
                    <p className="text-ds-soft text-sm mt-1">{description}</p>
                </div>
            </div>
        </div>
    );
}
