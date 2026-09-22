import { Gamepad2, ArrowRight, Users, Radar, Palette, MessageSquare, Monitor, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function GameOverlaysDoc() {
    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <Gamepad2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Game Overlays</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">Tu rango, sesión y últimas partidas en pantalla, del juego que estás jugando</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Link to="/overlays/games" className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
                        Ir a configuración <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a href="/demo/game-overlay" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-[#f1f5f9] dark:bg-[#262626] text-gray-900 dark:text-white font-bold rounded-lg">
                        Ver demo
                    </a>
                </div>
            </div>

            <DocSection title="¿Qué es?">
                <p>
                    Un solo overlay para OBS que muestra tu rango, los puntos ganados o perdidos en el stream de hoy, tus victorias y derrotas
                    y tus últimas partidas. Detecta el juego por la categoría de tu stream: si pones League of Legends aparece con tus datos de LoL;
                    si cambias a Just Chatting se oculta.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FeatureCard icon={<Radar className="w-5 h-5" />} title="Detección automática" description="Por la categoría del stream, en Twitch y Kick" />
                    <FeatureCard icon={<Users className="w-5 h-5" />} title="Varias cuentas" description="Main y smurfs, con rotación" />
                    <FeatureCard icon={<Palette className="w-5 h-5" />} title="Editor visual" description="Layout, fuentes, colores y posición, gratis" />
                </div>
            </DocSection>

            <DocSection title="Juegos">
                <p><b>League of Legends</b> tiene datos automáticos (rango, LP, partidas, partida en vivo). Los demás juegos del catálogo — TFT, VALORANT,
                    Marvel Rivals, CS2, Fortnite, Rocket League y Warzone — funcionan hoy con <b>rango manual</b>: lo fijas en la cuenta o con
                    <code> !setrango</code>, y el overlay lo muestra igual de bonito. A medida que se conecten sus APIs pasan a automático sin reconfigurar nada.</p>
            </DocSection>

            <DocSection title="Paso a paso">
                <ol className="list-decimal pl-5 space-y-2">
                    <li><b>Cuentas</b>: vincula tu cuenta (para Riot: nombre, tag y región). Te pedimos que pongas un ícono de invocador concreto para verificar que es tuya.</li>
                    <li><b>Juegos</b>: activa el juego, marca qué cuentas mostrar y cómo rotar.</li>
                    <li><b>Diseño</b>: arrastra la tarjeta a donde la quieras y ajusta layout, fuentes y colores. Lo que ves es lo que sale en OBS. En LoL hay además widgets de estadísticas (winrate, KDA y CS por minuto, racha, top campeones, maestría, gráfico de LP de la sesión e íconos de campeón en las últimas partidas) y presets <i>Minimal</i> / <i>Stats</i> / <i>Completo</i> para activarlos de un clic. Vienen apagados por defecto para no cambiar overlays que ya tengas en OBS.</li>
                    <li><b>Overlay</b>: copia la URL y agrégala en OBS como fuente de navegador con el tamaño del lienzo (por defecto 1920×1080).</li>
                </ol>
                <p className="text-sm mt-3">La tarjeta tiene un <b>tamaño fijo</b>: la caja no cambia al rotar cuentas ni vistas. En automático se dimensiona con la vista más grande;
                    en manual eliges ancho y alto y el editor avisa si algo no entra. Si falta un dato (sin LP, sin partidas hoy) se muestra un marcador en su lugar.</p>
                <DocAlert type="tip" title="Solo una fuente en OBS">
                    No necesitas una fuente por juego: la misma URL cambia sola según lo que estés jugando.
                </DocAlert>
            </DocSection>

            <DocSection title="Partida en vivo (Desktop)">
                <p>La selección de campeón, el "Coach dice" y la predicción del chat <b>no van en esta tarjeta</b>: tienen su propio overlay,
                    <Link to="/dashboard/docs/features/live-overlay" className="underline font-semibold"> Partida en vivo</Link>, con una pantalla por fase de la partida.
                    Aquí solo queda la línea de estado ("En partida · Jinx · 12:30"), que con Decatron Desktop conectado muestra la fase real y sin él usa la Riot API.</p>
                <p className="text-sm mt-2">Los anuncios de Decatron que aparecen de vez en cuando los administra la plataforma; según tu plan puedes apagarlos en Diseño.</p>
            </DocSection>

            <DocSection title="Comandos de chat">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Cmd name="!rango" alias="!rank" desc="Rango de tus cuentas en el juego activo. !rango valorant consulta otro juego." />
                    <Cmd name="!lp" alias="!puntos" desc="Puntos ganados/perdidos hoy y W-L de la cuenta visible." />
                    <Cmd name="!sesion" alias="!session" desc="W-L de hoy, sumado de todas tus cuentas." />
                    <Cmd name="!ultimas" alias="!recent" desc="Últimas 5 partidas con KDA." />
                    <Cmd name="!cuentas" alias="!accounts" desc="Tus cuentas con Riot ID, región y rango." />
                    <Cmd name="!juego lol / auto" alias="mods" desc="Fuerza el juego del overlay o vuelve a automático." />
                    <Cmd name="!setrango Champion II" alias="mods" desc="Fija el rango manual de la cuenta visible." />
                    <Cmd name="!rankup / !rankdown" alias="mods" desc="Sube o baja una división el rango manual." />
                    <Cmd name="!win / !loss" alias="mods" desc="Suma un resultado a la sesión de hoy." />
                </div>
                <p className="text-sm mt-3">Todos se pueden apagar desde Comandos → Comandos por defecto.</p>
            </DocSection>

            <DocSection title="Planes">
                <p>La personalización, la detección, los comandos y los ocho juegos son gratis para todos. Lo que crece con el plan es la cantidad:
                    cuentas por juego (1 / 3 / 5 / ilimitado), overlays (1 / 2 / 4 / ilimitado), refresco de datos (3 / 2 / 1 / 1 min),
                    partidas mostradas (5 / 10 / 20) y rotación avanzada (por intervalo desde Supporter, "la que está en partida" desde Premium).</p>
            </DocSection>

            <DocSection title="Privacidad">
                <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-green-500 mt-0.5" />
                    <p>Solo se muestran cuentas verificadas del propio streamer. Los datos se consultan únicamente mientras el canal está en vivo (y una
                        vez al abrir el overlay), con caché compartida para no abusar de las APIs.</p>
                </div>
            </DocSection>

            <DocSection title="Problemas comunes">
                <ul className="list-disc pl-5 space-y-1">
                    <li><b>No aparece nada</b>: revisa que el juego esté activado, que tenga cuentas marcadas y que la categoría del stream sea la del juego (o usa <code>!juego lol</code>).</li>
                    <li><b>Muestra el juego anterior</b>: la categoría de Twitch tarda unos segundos en llegar; el overlay se refresca solo.</li>
                    <li><b>Rango estimado (≈)</b>: en juegos sin puntos exactos por API se muestra el último rango conocido; puedes corregirlo con <code>!setrango</code>.</li>
                    <li><b>En Kick</b>: la detección usa la categoría de Kick; la URL lleva <code>platform=kick</code>.</li>
                </ul>
            </DocSection>

            <div className="flex items-center gap-2 text-sm text-[#64748b] dark:text-[#94a3b8]"><Monitor className="w-4 h-4" /> <span>Tamaño recomendado de la fuente en OBS: el del lienzo configurado (1920×1080 por defecto).</span></div>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">{icon}</div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

function Cmd({ name, alias, desc }: { name: string; alias: string; desc: string }) {
    return (
        <div className="p-3 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-lg">
            <div className="flex items-center gap-2"><code className="font-bold text-gray-900 dark:text-white">{name}</code><span className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">{alias}</span></div>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 flex items-start gap-1"><MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />{desc}</p>
        </div>
    );
}
