/**
 * Demo publica de Game Overlays: /demo/game-overlay
 * Sin login. Muestra el overlay con datos simulados para cada juego, cambio de
 * juego animado y explica que hace el producto. Bilingue (es/en) porque es la
 * pagina que revisa Riot para la key de Valorant (plan Fase 0/1).
 */
import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, Radar, Users, Palette, MessageSquare, Shield, ExternalLink } from 'lucide-react';
import { GameOverlayCard, CARD_LABELS } from './features/game-overlays/GameOverlayCard';
import { GAME_IDS, GAME_NAMES, GameId, OverlayState, defaultGameConfig, formatTier } from './features/game-overlays/types';

type Lang = 'es' | 'en';

const T: Record<Lang, Record<string, string>> = {
    es: {
        title: 'Game Overlays',
        tagline: 'Tu rango, tu sesión y tus últimas partidas en pantalla, del juego que estás jugando ahora.',
        pick: 'Elige un juego',
        live: 'Vista del overlay (datos de ejemplo)',
        how: 'Cómo funciona',
        h1: 'Vincula tus cuentas', h1d: 'Una sola vez, en tu perfil. Sirven para tu canal de Twitch y de Kick.',
        h2: 'Detecta el juego solo', h2d: 'Lee la categoría de tu stream: si cambias a Just Chatting, el overlay se oculta; si vuelves a un juego, aparece.',
        h3: 'Varias cuentas', h3d: 'Main y smurfs con rotación; en LoL puede mostrar la cuenta que está en partida.',
        h4: 'Diseño libre', h4d: 'Layout, fuentes, colores, tamaño y posición. Sin costo para nadie.',
        h5: 'Comandos de chat', h5d: '!rango, !lp, !sesion, !ultimas y !cuentas responden con los mismos datos del overlay.',
        h6: 'Solo tus datos', h6d: 'Se muestran únicamente cuentas verificadas del propio streamer. Nunca datos de terceros.',
        games: 'Juegos',
        api: 'datos automáticos', manual: 'rango manual por ahora',
        cta: 'Configúralo en tu panel', obs: 'URL de ejemplo para OBS',
        foot: 'Decatron no está respaldado por Riot Games ni refleja las opiniones de Riot Games o de quien participe oficialmente en la producción de sus juegos. Marcas y activos de cada juego pertenecen a sus dueños.',
    },
    en: {
        title: 'Game Overlays',
        tagline: 'Your rank, session and recent matches on screen, for the game you are playing right now.',
        pick: 'Pick a game',
        live: 'Overlay view (sample data)',
        how: 'How it works',
        h1: 'Link your accounts', h1d: 'Once, in your profile. They work for both your Twitch and Kick channels.',
        h2: 'Detects the game by itself', h2d: 'It reads your stream category: switch to Just Chatting and the overlay hides; go back to a game and it shows up.',
        h3: 'Multiple accounts', h3d: 'Main and smurfs with rotation; in LoL it can show the account currently in game.',
        h4: 'Free design', h4d: 'Layout, fonts, colors, size and position. Free for everyone.',
        h5: 'Chat commands', h5d: '!rango, !lp, !sesion, !ultimas and !cuentas reply with the same data the overlay shows.',
        h6: 'Only your own data', h6d: 'Only the streamer\'s own verified accounts are displayed. Never third-party data.',
        games: 'Games',
        api: 'automatic data', manual: 'manual rank for now',
        cta: 'Set it up in your dashboard', obs: 'Example OBS URL',
        foot: 'Decatron isn\'t endorsed by Riot Games and doesn\'t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Game brands and assets belong to their owners.',
    },
};

const WITH_API: GameId[] = ['lol'];

export default function GameOverlayDemo() {
    const [lang, setLang] = useState<Lang>(() => (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es');
    const [game, setGame] = useState<GameId>('lol');
    const [states, setStates] = useState<Partial<Record<GameId, OverlayState>>>({});
    const t = T[lang];

    useEffect(() => {
        if (states[game]) return;
        fetch(`/api/game-overlays/preview-public?game=${game}`)
            .then(r => r.json())
            .then(d => { if (d.success) setStates(prev => ({ ...prev, [game]: d.state })); })
            .catch(() => {});
    }, [game, states]);

    const cfg = useMemo(() => ({ ...defaultGameConfig(game), enabled: true }), [game]);
    const account = states[game]?.accounts?.[0];

    return (
        <div className="min-h-screen bg-[#0b0d10] text-[#e6edf3]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center"><Gamepad2 className="w-6 h-6" /></div>
                            <h1 className="text-3xl font-black">{t.title} <span className="text-[#6b7280] font-medium text-lg">· Decatron</span></h1>
                        </div>
                        <p className="text-[#94a3b8] mt-2 max-w-2xl">{t.tagline}</p>
                    </div>
                    <div className="flex gap-1 bg-[#15181d] rounded-lg p-1 border border-[#2a2f37]">
                        {(['es', 'en'] as Lang[]).map(l => (
                            <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${lang === l ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:text-white'}`}>{l.toUpperCase()}</button>
                        ))}
                    </div>
                </header>

                <section>
                    <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-2">{t.pick}</div>
                    <div className="flex flex-wrap gap-2">
                        {GAME_IDS.map(g => (
                            <button key={g} onClick={() => setGame(g)} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${game === g ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#15181d] border-[#2a2f37] text-[#e6edf3] hover:border-[#4b5563]'}`}>
                                {GAME_NAMES[g]}
                            </button>
                        ))}
                    </div>
                </section>

                <section>
                    <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-2">{t.live}</div>
                    <div className="relative rounded-2xl overflow-hidden border border-[#2a2f37]" style={{ aspectRatio: '16 / 9', background: 'radial-gradient(1200px 500px at 30% 20%, #1c2230 0%, #0b0d10 60%)' }}>
                        <div style={{ position: 'absolute', left: '2%', top: '4%', transform: 'scale(1)', transformOrigin: 'top left' }}>
                            {account && (
                                <div key={game} style={{ animation: 'go-fade-in .4s ease' }}>
                                    <GameOverlayCard game={game} gameName={GAME_NAMES[game]} config={cfg} account={account}
                                        accountIndex={0} accountCount={states[game]?.accounts.length ?? 1} switchAnimation="none" formatTier={formatTier} labels={CARD_LABELS[lang]} />
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-3 right-4 text-[11px] text-[#6b7280]">{GAME_NAMES[game]} · {WITH_API.includes(game) ? t.api : t.manual}</div>
                    </div>
                    <style>{`@keyframes go-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4">{t.how}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            [<Users className="w-5 h-5" />, t.h1, t.h1d], [<Radar className="w-5 h-5" />, t.h2, t.h2d], [<Gamepad2 className="w-5 h-5" />, t.h3, t.h3d],
                            [<Palette className="w-5 h-5" />, t.h4, t.h4d], [<MessageSquare className="w-5 h-5" />, t.h5, t.h5d], [<Shield className="w-5 h-5" />, t.h6, t.h6d],
                        ].map(([icon, title, desc], i) => (
                            <div key={i} className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37]">
                                <div className="w-9 h-9 rounded-lg bg-blue-600/15 text-blue-400 flex items-center justify-center mb-3">{icon as any}</div>
                                <div className="font-semibold mb-1">{title as string}</div>
                                <div className="text-sm text-[#94a3b8]">{desc as string}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37]">
                        <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-2">{t.games}</div>
                        <ul className="text-sm space-y-1">
                            {GAME_IDS.map(g => <li key={g} className="flex justify-between"><span>{GAME_NAMES[g]}</span><span className="text-[#6b7280]">{WITH_API.includes(g) ? t.api : t.manual}</span></li>)}
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] flex flex-col justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-2">{t.obs}</div>
                            <code className="text-xs text-[#c9d1d9] break-all">https://decatron.net/overlay/games?channel=tu_canal&platform=twitch&slug=main</code>
                        </div>
                        <a href="/overlays/games" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold w-fit">{t.cta} <ExternalLink className="w-4 h-4" /></a>
                    </div>
                </section>

                <footer className="text-[11px] text-[#6b7280] border-t border-[#2a2f37] pt-4">{t.foot}</footer>
            </div>
        </div>
    );
}
