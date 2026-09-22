import { Radio, ArrowRight, Monitor, Layers, Bot, Coins, Shield, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function LiveOverlayDoc() {
    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                        <Radio className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Partida en vivo</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">Lo que pasa en tu partida ahora mismo: lobby, selección de campeón, partida y resultado</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Link to="/overlays/live" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                        Ir a configuración <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link to="/features/lol-coach" className="inline-flex items-center gap-2 px-4 py-2 bg-[#f1f5f9] dark:bg-[#262626] text-gray-900 dark:text-white font-bold rounded-lg">
                        Decatron Coach
                    </Link>
                </div>
            </div>

            <DocSection title="¿Qué es?">
                <p>
                    Un overlay para OBS que lee tu cliente de League of Legends a través de <b>Decatron Desktop</b> y dibuja una pantalla distinta según
                    la fase de la partida. Es independiente de Game Overlays: la tarjeta de rango dice <i>quién eres y cómo vas</i> (y rota entre tus cuentas);
                    Partida en vivo dice <i>qué está pasando ahora</i>, con la cuenta que tiene el cliente abierto.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FeatureCard icon={<Layers className="w-5 h-5" />} title="Una pantalla por fase" description="Lobby, buscando, selección, en partida y fin, en la misma caja" />
                    <FeatureCard icon={<Bot className="w-5 h-5" />} title="Coach dice" description="Sugerencia de pick y resumen al terminar, si tienes el Coach activo" />
                    <FeatureCard icon={<Coins className="w-5 h-5" />} title="Predicción del chat" description="Pozo de !pred win / loss en vivo y ganadores al final" />
                </div>
            </DocSection>

            <DocSection title="Pantallas">
                <ul className="list-disc pl-5 space-y-1">
                    <li><b>Lobby</b>: cola y compañeros. El scouting de tus amigos (rango, winrate, racha, top campeones) viene <b>apagado</b>; lo activas por elemento si quieres exponerlo.</li>
                    <li><b>Buscando</b>: cola y tiempo de búsqueda.</li>
                    <li><b>Selección</b>: picks de tu equipo (el tuyo resaltado), del rival, bans, timer y "¡Tu turno!". Aquí habla el coach.</li>
                    <li><b>En partida</b>: campeón, rol y tiempo, con la franja de predicción del chat.</li>
                    <li><b>Fin</b>: victoria o derrota, KDA, CS/daño/visión, ±LP, resumen del coach y resultado de la predicción.</li>
                </ul>
                <p className="text-sm mt-3">Cada pantalla se puede apagar entera (por ejemplo Lobby, para no mostrar con quién juegas) y dentro de cada una eliges qué elementos salen, con su fuente y color.</p>
            </DocSection>

            <DocSection title="Paso a paso">
                <ol className="list-decimal pl-5 space-y-2">
                    <li>Vincula <b>Decatron Desktop</b> desde Funciones → Decatron Coach y ábrelo en la PC donde juegas.</li>
                    <li>En <b>Overlays → Partida en vivo</b> crea una instancia (puedes tener hasta 5, por ejemplo una lateral y una barra superior).</li>
                    <li><b>Diseño</b>: elige layout (panel, compacto o barra), recorre las fases con los botones y ajusta elementos, fuentes y colores. La caja se dimensiona sola con la pantalla más grande, así nunca cambia de tamaño al pasar de una fase a otra.</li>
                    <li><b>Overlay</b>: copia la URL y agrégala en OBS como fuente de navegador con el tamaño del lienzo.</li>
                </ol>
                <DocAlert type="tip" title="Sin Desktop, transparente">
                    Si la app no está conectada o no estás en ninguna fase, el overlay no dibuja nada. Puedes dejarlo siempre activo en OBS.
                </DocAlert>
            </DocSection>

            <DocSection title="Coach y planes">
                <p>El overlay es <b>gratis para todos</b>. Lo único que depende del plan es la parte con IA (comentario del coach, tips, sugerencia de pick),
                    limitada por las llamadas diarias del Coach. Si se agota el cupo, el bloque "Coach dice" no se muestra y el resto de la pantalla
                    (picks, tiempo, resultado, predicción) sigue igual, porque no usa IA.</p>
            </DocSection>

            <DocSection title="Privacidad">
                <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-green-500 mt-0.5" />
                    <p>Solo se muestra lo que tu propio cliente de LoL reporta. Los datos públicos de tus compañeros de lobby (Riot API) solo se dibujan si activas el scouting.</p>
                </div>
            </DocSection>

            <DocSection title="Problemas comunes">
                <ul className="list-disc pl-5 space-y-1">
                    <li><b>No cambia de pantalla</b>: revisa en Decatron Coach que la app figure conectada y que el cliente de LoL esté abierto con la cuenta vinculada.</li>
                    <li><b>No aparece el coach</b>: en Decatron Coach debe estar activo "Mostrar lo que dice en el overlay" y quedar cupo de llamadas del día.</li>
                    <li><b>Se recorta algo</b>: pasa el tamaño a automático en Diseño, o agranda la caja en modo manual.</li>
                </ul>
            </DocSection>

            <div className="flex flex-wrap items-center gap-4 text-sm text-[#64748b] dark:text-[#94a3b8]">
                <span className="inline-flex items-center gap-2"><Monitor className="w-4 h-4" /> Tamaño de la fuente en OBS: el del lienzo (1920×1080 por defecto).</span>
                <Link to="/dashboard/docs/features/game-overlays" className="inline-flex items-center gap-2 underline"><Gamepad2 className="w-4 h-4" /> Ver Game Overlays (tarjeta de rango)</Link>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">{icon}</div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}
