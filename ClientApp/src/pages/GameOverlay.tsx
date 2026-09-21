/**
 * Overlay de juegos para OBS.
 * URL: /overlay/games?channel=<login>&platform=twitch|kick&slug=main
 *
 * Un solo overlay por canal que muestra el juego activo (detectado por la
 * categoria del stream o forzado). Estado por SignalR ("GameOverlayState"),
 * config por "GameOverlayConfigChanged". Se oculta si no hay juego configurado.
 * Ver .dev/plans/GAME_OVERLAYS_PLAN.md §5.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import {
    AccountOverlayState, GameId, GameOverlayInstance, GameVisualConfig, LayoutPreset, OverlayState, PromoCatalog, StylePreset,
    GAME_NAMES, LAYOUT_DEFAULT_SIZE, LAYOUT_PRESETS, STYLE_PRESET_ELEMENTS, formatTier, resolveGameConfig,
} from './features/game-overlays/types';
import { GameOverlayCard, CARD_LABELS } from './features/game-overlays/GameOverlayCard';
import { CardView, useCardCycle } from './features/game-overlays/slides';

const OVERLAY_STYLES = `
    html, body, #root { background: transparent !important; margin: 0; overflow: hidden; }
    @keyframes go-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes go-fade-out { from { opacity: 1; } to { opacity: 0; } }
    @keyframes go-slide-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes go-slide-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }
`;

interface PublicResponse {
    success: boolean;
    enabled: boolean;
    channelKey: string;
    config?: GameOverlayInstance;
    state?: OverlayState | null;
    channel?: { login: string; platform: string; displayName: string; language?: string };
    limits?: { canHidePromo?: boolean };
    /** Anuncios de Decatron (catálogo del admin) ya en el idioma del canal. */
    promos?: PromoCatalog | null;
}

export default function GameOverlay() {
    const [params] = useSearchParams();
    const channel = params.get('channel') || '';
    const platform = params.get('platform') || 'twitch';
    const slug = params.get('slug') || 'main';
    const previewGame = params.get('preview') as GameId | null; // ?preview=lol → datos simulados (demo/editor)
    // Solo en preview sin canal: forzar layout/preset/vista para revisar el diseño (docs, capturas).
    const previewLayout = params.get('layout') as LayoutPreset | null;
    const previewPreset = params.get('preset') as StylePreset | null;
    const previewView = params.get('view') as CardView | null;

    const [config, setConfig] = useState<GameOverlayInstance | null>(null);
    const [channelKey, setChannelKey] = useState('');
    const [lang, setLang] = useState<'es' | 'en'>('es');
    const [state, setState] = useState<OverlayState | null>(null);
    const [visibleAccountId, setVisibleAccountId] = useState<number | null>(null);
    // Tier gratis: la tarjeta de Decatron no se puede apagar. En preview no molesta (true).
    const [canHidePromo, setCanHidePromo] = useState(true);
    const [promos, setPromos] = useState<PromoCatalog | null>(null);
    const connectionRef = useRef<signalR.HubConnection | null>(null);

    const load = useCallback(async () => {
        if (!channel) return;
        try {
            const res = await fetch(`/api/game-overlays/overlay/${encodeURIComponent(channel)}?platform=${platform}&slug=${encodeURIComponent(slug)}`);
            const data: PublicResponse = await res.json();
            if (!data.success) return;
            setChannelKey(data.channelKey);
            if (data.channel?.language) setLang(data.channel.language.toLowerCase().startsWith('en') ? 'en' : 'es');
            setConfig(data.enabled && data.config ? data.config : null);
            setCanHidePromo(data.limits?.canHidePromo !== false);
            setPromos(data.promos ?? null);
            if (data.state) setState(data.state);
        } catch (e) {
            console.warn('[GameOverlay] load failed', e);
        }
    }, [channel, platform, slug]);

    // Preview publico sin login: /overlay/games?preview=lol (demo). Con canal y
    // preview a la vez, usa la config real del canal y datos simulados.
    useEffect(() => {
        if (!previewGame) return;
        fetch(`/api/game-overlays/preview-public?game=${previewGame}`)
            .then(r => r.json())
            .then(d => { if (d.success) setState(d.state); })
            .catch(() => {});
    }, [previewGame]);

    useEffect(() => { load(); }, [load]);

    // Respaldo por si se pierde un push de SignalR (OBS suspendido, reconexion):
    // cada 2 min vuelve a pedir config + estado.
    useEffect(() => {
        if (previewGame) return;
        const t = setInterval(load, 120000);
        return () => clearInterval(t);
    }, [load, previewGame]);

    // ─── SignalR ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!channelKey || previewGame) return;
        let isMounted = true;

        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/overlay')
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        connection.on('GameOverlayState', (payload: { slug: string; state: OverlayState }) => {
            if (payload.slug !== slug) return;
            setState(payload.state);
        });
        connection.on('GameOverlayConfigChanged', (payload: { slug: string }) => {
            if (payload.slug !== slug) return;
            load();
        });
        connection.onreconnected(() => {
            connection.invoke('JoinChannel', channelKey).catch(() => {});
            load();
        });
        connection.onclose(() => { if (isMounted) setTimeout(start, 5000); });

        const start = async () => {
            if (!isMounted || connection.state !== signalR.HubConnectionState.Disconnected) return;
            try {
                await connection.start();
                connectionRef.current = connection;
                await connection.invoke('JoinChannel', channelKey);
            } catch (err: any) {
                if (!isMounted || err?.message?.includes('negotiation')) return;
                setTimeout(start, 5000);
            }
        };
        start();

        return () => { isMounted = false; connection.stop().catch(() => {}); };
    }, [channelKey, slug, load, previewGame]);

    // ─── Juego activo y config visual ────────────────────────────────────────
    const game = (state?.activeGame ?? previewGame ?? null) as GameId | null;
    const gameConfig: GameVisualConfig | null = useMemo(() => {
        if (!game) return null;
        const cfg = resolveGameConfig(game, config?.games?.[game] ?? null);
        if (channel || !previewGame) return cfg;
        if (previewLayout && LAYOUT_PRESETS.includes(previewLayout)) { cfg.layout = previewLayout; cfg.size = { ...LAYOUT_DEFAULT_SIZE[previewLayout] }; }
        if (previewPreset && STYLE_PRESET_ELEMENTS[previewPreset]) {
            const show = new Set(STYLE_PRESET_ELEMENTS[previewPreset]);
            for (const id of Object.keys(cfg.elements) as (keyof typeof cfg.elements)[]) cfg.elements[id] = { ...cfg.elements[id]!, visible: show.has(id) };
        }
        return cfg;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game, config]);

    // Fuentes de Google usadas por los elementos (el editor hace lo mismo).
    useEffect(() => {
        if (!gameConfig) return;
        const fams = new Set<string>();
        for (const e of Object.values(gameConfig.elements)) { const f = e?.font?.family; if (f && f !== 'system-ui' && f !== 'Inter') fams.add(f); }
        if (fams.size === 0) return;
        const id = 'go-fonts';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
        link.href = `https://fonts.googleapis.com/css2?${[...fams].map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`).join('&')}&display=swap`;
    }, [gameConfig]);

    const accounts: AccountOverlayState[] = state?.accounts ?? [];
    const showing = !!game && !!gameConfig && (gameConfig.enabled || !!previewGame) && accounts.length > 0
        && (state?.reason !== 'idle' && state?.reason !== 'unconfigured' && state?.reason !== 'no_accounts');

    // ─── Rotacion de cuentas (cliente) ───────────────────────────────────────
    useEffect(() => {
        if (!showing || !gameConfig) { setVisibleAccountId(null); return; }
        const mode = gameConfig.rotation.mode;
        const ids = accounts.map(a => a.accountId);

        // active_first: la cuenta en partida manda; si ninguna, rota por intervalo.
        const inGame = mode === 'active_first' ? accounts.find(a => a.live?.inGame)?.accountId ?? null : null;
        if (inGame != null) { setVisibleAccountId(inGame); return; }

        if (mode === 'none' || ids.length <= 1) {
            setVisibleAccountId(state?.activeAccountId ?? ids[0]);
            return;
        }

        setVisibleAccountId(prev => (prev != null && ids.includes(prev) ? prev : ids[0]));
        const seconds = Math.max(5, gameConfig.rotation.seconds || 30);
        const timer = setInterval(() => {
            setVisibleAccountId(prev => {
                const i = prev == null ? -1 : ids.indexOf(prev);
                return ids[(i + 1) % ids.length];
            });
        }, seconds * 1000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showing, gameConfig?.rotation.mode, gameConfig?.rotation.seconds, accounts.map(a => `${a.accountId}:${a.live?.inGame ? 1 : 0}`).join(','), state?.activeAccountId]);

    const account = accounts.find(a => a.accountId === visibleAccountId) ?? accounts[0] ?? null;
    const cycle = useCardCycle(gameConfig, account, canHidePromo, promos);
    const view: CardView = !channel && previewGame && previewView ? previewView : cycle.view;
    const promo = cycle.promo;

    // Animación al cambiar: de cuenta usa animation.accountSwitch; de vista (o al volver de un anuncio) usa slides.animation.
    const prevRef = useRef<{ accountId: number | null; view: string }>({ accountId: null, view: 'main' });
    const switchAnimation = useMemo(() => {
        const prev = prevRef.current;
        const accountChanged = prev.accountId != null && account != null && prev.accountId !== account.accountId;
        prevRef.current = { accountId: account?.accountId ?? null, view };
        const anim = gameConfig?.animation.accountSwitch ?? 'slide';
        if (accountChanged) return anim;
        if (prev.view !== view) return gameConfig?.slides.animation ?? anim;
        return anim;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account?.accountId, view, gameConfig]);

    // Sesion sumada de todas las cuentas del juego (sessionScope=all_accounts).
    const aggregateSession = useMemo(() => {
        if (!gameConfig || gameConfig.sessionScope !== 'all_accounts') return null;
        const wins = accounts.reduce((s, a) => s + (a.session?.wins ?? 0), 0);
        const losses = accounts.reduce((s, a) => s + (a.session?.losses ?? 0), 0);
        const deltas = accounts.map(a => a.session?.pointsDelta).filter((d): d is number => typeof d === 'number');
        return { wins, losses, pointsDelta: deltas.length ? deltas.reduce((s, d) => s + d, 0) : null };
    }, [accounts, gameConfig]);

    // ─── Animacion de entrada/salida ─────────────────────────────────────────
    const [rendered, setRendered] = useState(false);
    const [leaving, setLeaving] = useState(false);
    useEffect(() => {
        if (showing) { setRendered(true); setLeaving(false); return; }
        if (!rendered) return;
        setLeaving(true);
        const t = setTimeout(() => { setRendered(false); setLeaving(false); }, 400);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showing]);

    if (!channel && !previewGame) {
        return (
            <div style={{ color: '#fff', fontFamily: 'Inter, sans-serif', padding: 20 }}>
                Falta el parámetro <code>?channel=</code> en la URL del overlay.
            </div>
        );
    }

    const anim = gameConfig?.animation ?? { in: 'fade', out: 'fade', accountSwitch: 'slide' };
    const animation = leaving
        ? (anim.out === 'none' ? undefined : `go-${anim.out}-out 0.4s ease forwards`)
        : (anim.in === 'none' ? undefined : `go-${anim.in}-in 0.4s ease`);

    return (
        <>
            <style>{OVERLAY_STYLES}</style>
            <div style={{ position: 'relative', width: config?.canvas?.width ?? 1920, height: config?.canvas?.height ?? 1080, overflow: 'hidden' }}>
                {rendered && game && gameConfig && account && (
                    <div style={{ position: 'absolute', left: gameConfig.position.x, top: gameConfig.position.y, animation }}>
                        <GameOverlayCard
                            key={`${game}-${account.accountId}-${view}-${promo?.id ?? 0}`}
                            view={view}
                            promo={promo}
                            lang={lang}
                            game={game}
                            gameName={GAME_NAMES[game]}
                            config={gameConfig}
                            account={account}
                            aggregate={aggregateSession}
                            accountIndex={accounts.findIndex(a => a.accountId === account.accountId)}
                            accountCount={accounts.length}
                            switchAnimation={switchAnimation}
                            formatTier={formatTier}
                            labels={CARD_LABELS[lang]}
                        />
                    </div>
                )}
            </div>
        </>
    );
}
