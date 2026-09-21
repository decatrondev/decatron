/**
 * Overlay "Partida en vivo" para OBS.
 * URL: /overlay/live?channel=<login>&platform=twitch|kick&slug=main
 *
 * Dibuja lo que Decatron Desktop lee del cliente de LoL, en una caja fija con una
 * pantalla por fase. Estado por SignalR ("LiveMatchState"), config por
 * "LiveOverlayConfigChanged". Sin Desktop conectado no dibuja nada (transparente).
 * Preview sin canal: /overlay/live?preview=champselect[&layout=bar]
 * Ver .dev/plans/LIVE_MATCH_OVERLAY_PLAN.md §3.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { AccountOverlayState, CARD_SIZE_LIMITS, LivePhaseId, LivePhaseInfo, OverlayState } from './features/game-overlays/types';
import { Measurer } from './features/game-overlays/CardMeasurer';
import { simulateLive } from './features/game-overlays/liveSim';
import { LiveMatchCard } from './features/live-overlay/LiveMatchCard';
import { LIVE_LAYOUTS, LIVE_LAYOUT_DEFAULT_SIZE, LIVE_SCREENS, LiveLayout, LiveMatchState, LiveOverlayConfig, LiveOverlayInstance, defaultLiveConfig, resolveLiveConfig } from './features/live-overlay/types';

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
    config?: LiveOverlayInstance;
    state?: LiveMatchState | null;
    channel?: { login: string; platform: string; displayName: string; language?: string };
}

export default function LiveOverlay() {
    const [params] = useSearchParams();
    const channel = params.get('channel') || '';
    const platform = params.get('platform') || 'twitch';
    const slug = params.get('slug') || 'main';
    const previewPhase = params.get('preview') as LivePhaseId | null;
    const previewLayout = params.get('layout') as LiveLayout | null;
    const isPublicPreview = !channel && !!previewPhase;

    const [instance, setInstance] = useState<LiveOverlayInstance | null>(null);
    const [channelKey, setChannelKey] = useState('');
    const [lang, setLang] = useState<'es' | 'en'>('es');
    const [state, setState] = useState<LiveMatchState | null>(null);
    const [previewAccount, setPreviewAccount] = useState<AccountOverlayState | null>(null);
    const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
    const connectionRef = useRef<signalR.HubConnection | null>(null);

    const load = useCallback(async () => {
        if (!channel) return;
        try {
            const res = await fetch(`/api/live-overlays/overlay/${encodeURIComponent(channel)}?platform=${platform}&slug=${encodeURIComponent(slug)}`);
            const data: PublicResponse = await res.json();
            if (!data.success) return;
            setChannelKey(data.channelKey);
            if (data.channel?.language) setLang(data.channel.language.toLowerCase().startsWith('en') ? 'en' : 'es');
            setInstance(data.enabled && data.config ? data.config : null);
            if (data.state) setState(data.state);
        } catch (e) {
            console.warn('[LiveOverlay] load failed', e);
        }
    }, [channel, platform, slug]);

    useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, [load]);

    // Datos simulados para el preview (íconos de campeón del estado de ejemplo).
    useEffect(() => {
        if (!previewPhase) return;
        fetch('/api/game-overlays/preview-public?game=lol').then(r => r.json())
            .then((d: { success: boolean; state: OverlayState }) => { if (d.success) setPreviewAccount(d.state.accounts[0] ?? null); })
            .catch(() => {});
    }, [previewPhase]);

    // SignalR: fase en vivo y cambios de config.
    useEffect(() => {
        if (!channelKey) return;
        let isMounted = true;
        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/overlay')
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .build();
        connectionRef.current = connection;
        connection.on('LiveMatchState', (payload: { state: LiveMatchState }) => { if (isMounted && payload?.state) setState(payload.state); });
        connection.on('LiveOverlayConfigChanged', (payload: { slug: string }) => { if (isMounted && payload?.slug === slug) load(); });
        connection.onreconnected(() => { connection.invoke('JoinChannel', channelKey).catch(() => {}); load(); });
        const start = async () => {
            if (!isMounted || connection.state !== signalR.HubConnectionState.Disconnected) return;
            try {
                await connection.start();
                await connection.invoke('JoinChannel', channelKey);
            } catch (err: any) {
                if (!isMounted || err?.message?.includes('negotiation')) return;
                setTimeout(start, 5000);
            }
        };
        start();
        return () => { isMounted = false; connection.stop().catch(() => {}); };
    }, [channelKey, slug, load]);

    const config: LiveOverlayConfig | null = useMemo(() => {
        if (isPublicPreview) {
            const c = defaultLiveConfig();
            if (previewLayout && LIVE_LAYOUTS.includes(previewLayout)) { c.layout = previewLayout; c.size = { ...LIVE_LAYOUT_DEFAULT_SIZE[previewLayout] }; }
            if (measured) {
                const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
                c.size = { width: c.layout === 'bar' ? clamp(1920 - 48, measured.width, CARD_SIZE_LIMITS.maxWidth) : clamp(measured.width, CARD_SIZE_LIMITS.minWidth, CARD_SIZE_LIMITS.maxWidth), height: clamp(measured.height, CARD_SIZE_LIMITS.minHeight, CARD_SIZE_LIMITS.maxHeight) };
            }
            return c;
        }
        return instance ? resolveLiveConfig(instance.config) : null;
    }, [isPublicPreview, previewLayout, measured, instance]);

    // Fuentes de Google usadas por los elementos.
    useEffect(() => {
        if (!config) return;
        const fams = new Set<string>();
        for (const e of Object.values(config.elements)) { const f = e?.font?.family; if (f && f !== 'system-ui' && f !== 'Inter') fams.add(f); }
        if (fams.size === 0) return;
        const id = 'go-fonts';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
        link.href = `https://fonts.googleapis.com/css2?${[...fams].map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`).join('&')}&display=swap`;
    }, [config]);

    const phase: LivePhaseInfo | null = isPublicPreview
        ? (previewAccount && previewPhase ? simulateLive(previewPhase, previewAccount) : null)
        : (state?.connected ? state.phase ?? null : null);
    const screen = phase?.phase ?? 'none';
    const showing = !!config && screen !== 'none' && !!config.screens[screen as keyof typeof config.screens]?.enabled;

    // Entrada/salida.
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

    // Cambio de pantalla: la tarjeta se remonta con la animación phaseSwitch.
    const prevScreen = useRef(screen);
    const switched = prevScreen.current !== screen && screen !== 'none';
    prevScreen.current = screen;

    if (!channel && !previewPhase) {
        return <div style={{ color: '#fff', fontFamily: 'Inter, sans-serif', padding: 20 }}>Falta el parámetro <code>?channel=</code> en la URL del overlay.</div>;
    }

    const anim = config?.animation ?? { in: 'fade', out: 'fade', phaseSwitch: 'fade' };
    const animation = leaving
        ? (anim.out === 'none' ? undefined : `go-${anim.out}-out 0.4s ease forwards`)
        : switched && anim.phaseSwitch !== 'none' ? `go-${anim.phaseSwitch}-in 0.35s ease`
        : (anim.in === 'none' ? undefined : `go-${anim.in}-in 0.4s ease`);

    return (
        <>
            <style>{OVERLAY_STYLES}</style>
            <div style={{ position: 'relative', width: instance?.canvas?.width ?? 1920, height: instance?.canvas?.height ?? 1080, overflow: 'hidden' }}>
                {isPublicPreview && config && previewAccount && (
                    <Measurer depsKey={previewLayout ?? 'panel'} onMeasure={setMeasured}
                        items={LIVE_SCREENS.map(s => ({ key: s, node: <LiveMatchCard config={{ ...config, scale: 1 }} phase={simulateLive(s, previewAccount)} lang={lang} measure /> }))} />
                )}
                {rendered && config && phase && (
                    <div style={{ position: 'absolute', left: config.position.x, top: config.position.y }}>
                        <LiveMatchCard key={screen} config={config} phase={phase} lang={lang} animation={animation} />
                    </div>
                )}
            </div>
        </>
    );
}
