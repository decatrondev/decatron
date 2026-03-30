/**
 * NowPlayingOverlay - Vista para OBS Browser Source
 * Muestra la cancion que el streamer esta escuchando actualmente.
 *
 * Estado persistente: muestra un widget mientras hay musica reproduciendose.
 * Se conecta via SignalR y recibe actualizaciones de NowPlaying.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';

// ============================================================================
// STYLES & ANIMATIONS
// ============================================================================
const OVERLAY_STYLES = `
    @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOutLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
    @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    @keyframes slideInTop { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideOutTop { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
    @keyframes slideInBottom { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideOutBottom { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes bounceInLeft {
        0% { transform: translateX(-100%); opacity: 0; }
        60% { transform: translateX(10%); opacity: 1; }
        80% { transform: translateX(-5%); }
        100% { transform: translateX(0); }
    }
    @keyframes bounceInRight {
        0% { transform: translateX(100%); opacity: 0; }
        60% { transform: translateX(-10%); opacity: 1; }
        80% { transform: translateX(5%); }
        100% { transform: translateX(0); }
    }
    @keyframes bounceInTop {
        0% { transform: translateY(-100%); opacity: 0; }
        60% { transform: translateY(10%); opacity: 1; }
        80% { transform: translateY(-5%); }
        100% { transform: translateY(0); }
    }
    @keyframes bounceInBottom {
        0% { transform: translateY(100%); opacity: 0; }
        60% { transform: translateY(-10%); opacity: 1; }
        80% { transform: translateY(5%); }
        100% { transform: translateY(0); }
    }
    @keyframes crossfade {
        0% { opacity: 0; transform: scale(0.98); }
        100% { opacity: 1; transform: scale(1); }
    }
    @keyframes marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
    }
`;

// ============================================================================
// TYPES
// ============================================================================

interface NowPlayingTrack {
    song: string;
    artist: string;
    album: string;
    albumArtUrl: string;
    durationMs: number;
    progressMs?: number;
    isPlaying: boolean;
    provider: string;
    isNewTrack?: boolean;
    timestamp: string;
}

interface LayoutConfig {
    orientation: 'horizontal' | 'vertical';
    showAlbumArt: boolean;
    showArtist: boolean;
    showAlbum: boolean;
    showProgressBar: boolean;
    showTimeStamps: boolean;
    showProviderIcon: boolean;
    marqueeOnOverflow: boolean;
}

interface StyleConfig {
    backgroundType: 'color' | 'gradient' | 'transparent';
    backgroundColor: string;
    backgroundGradient: { color1: string; color2: string; angle: number };
    opacity: number;
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
}

interface AlbumArtConfig {
    size: number;
    borderRadius: number;
    shadow: boolean;
}

interface TypographyItem {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    textShadow?: string;
}

interface TypographyConfig {
    songTitle: TypographyItem;
    artist: TypographyItem;
    album: TypographyItem;
    time: TypographyItem;
}

interface ProgressBarConfig {
    height: number;
    borderRadius: number;
    backgroundColor: string;
    foregroundColor: string;
    animated: boolean;
}

interface AnimationsConfig {
    showAnimation: string;
    showDirection: string;
    showDuration: number;
    showEasing: string;
    hideAnimation: string;
    hideDirection: string;
    hideDuration: number;
    hideEasing: string;
    songChangeAnimation: string;
    songChangeDuration: number;
}

interface OverlayElementsConfig {
    card: { x: number; y: number; width: number; height: number };
}

interface CanvasConfig {
    width: number;
    height: number;
}

interface NowPlayingWidgetConfig {
    layout: LayoutConfig;
    style: StyleConfig;
    albumArt: AlbumArtConfig;
    typography: TypographyConfig;
    progressBar: ProgressBarConfig;
    animations: AnimationsConfig;
    overlay: { elements: OverlayElementsConfig };
    canvas: CanvasConfig;
}

interface NowPlayingConfig {
    isEnabled: boolean;
    provider: string;
    pollingInterval: number;
    config: NowPlayingWidgetConfig;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_CONFIG: NowPlayingWidgetConfig = {
    layout: {
        orientation: 'horizontal',
        showAlbumArt: true,
        showArtist: true,
        showAlbum: false,
        showProgressBar: true,
        showTimeStamps: true,
        showProviderIcon: true,
        marqueeOnOverflow: true,
    },
    style: {
        backgroundType: 'color',
        backgroundColor: '#1B1C1D',
        backgroundGradient: { color1: '#1B1C1D', color2: '#262626', angle: 135 },
        opacity: 100,
        borderEnabled: true,
        borderColor: '#374151',
        borderWidth: 2,
        borderRadius: 12,
    },
    albumArt: { size: 80, borderRadius: 8, shadow: true },
    typography: {
        songTitle: { fontFamily: 'Inter', fontSize: 24, fontWeight: 700, color: '#f8fafc', textShadow: 'none' },
        artist: { fontFamily: 'Inter', fontSize: 18, fontWeight: 400, color: '#94a3b8', textShadow: 'none' },
        album: { fontFamily: 'Inter', fontSize: 14, fontWeight: 400, color: '#64748b', textShadow: 'none' },
        time: { fontFamily: 'Inter', fontSize: 12, fontWeight: 400, color: '#94a3b8' },
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        backgroundColor: '#374151',
        foregroundColor: '#1DB954',
        animated: true,
    },
    animations: {
        showAnimation: 'slideIn',
        showDirection: 'left',
        showDuration: 500,
        showEasing: 'ease-out',
        hideAnimation: 'slideOut',
        hideDirection: 'left',
        hideDuration: 500,
        hideEasing: 'ease-in',
        songChangeAnimation: 'crossfade',
        songChangeDuration: 300,
    },
    overlay: {
        elements: {
            card: { x: 20, y: 900, width: 400, height: 100 },
        },
    },
    canvas: { width: 1920, height: 1080 },
};

// Last.fm icon as inline SVG data URL
const LASTFM_ICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#D51007"><path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.284 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.627-3.932l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.594 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.825 1.869 1.676 0 1.017-.88 1.456-2.529 1.456-2.447 0-3.464-1.29-4.04-3.052l-.907-2.803c-1.237-3.793-3.216-4.893-6.765-4.893C2.089 5.71 0 8.423 0 12.635c0 4.04 2.089 6.27 5.993 6.27 3.326 0 4.591-1.1 4.591-1.1v-.595z"/></svg>`)}`;

// Spotify icon as inline SVG data URL
const SPOTIFY_ICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`)}`;

// ============================================================================
// HELPERS
// ============================================================================

function getTextShadowCSS(value?: string): string {
    switch (value) {
        case 'normal': return '1px 1px 2px rgba(0,0,0,0.5)';
        case 'strong': return '2px 2px 4px rgba(0,0,0,0.8)';
        case 'glow': return '0 0 10px rgba(255,255,255,0.5)';
        default: return 'none';
    }
}

function getBackgroundCSS(style: StyleConfig): string {
    if (style.backgroundType === 'transparent') return 'transparent';
    if (style.backgroundType === 'gradient') {
        return `linear-gradient(${style.backgroundGradient.angle}deg, ${style.backgroundGradient.color1}, ${style.backgroundGradient.color2})`;
    }
    return style.backgroundColor;
}

function getShowAnimationName(animation: string, direction: string): string {
    if (animation === 'slideIn') {
        switch (direction) {
            case 'left': return 'slideInLeft';
            case 'right': return 'slideInRight';
            case 'top': return 'slideInTop';
            case 'bottom': return 'slideInBottom';
            default: return 'slideInLeft';
        }
    }
    if (animation === 'bounceIn') {
        switch (direction) {
            case 'left': return 'bounceInLeft';
            case 'right': return 'bounceInRight';
            case 'top': return 'bounceInTop';
            case 'bottom': return 'bounceInBottom';
            default: return 'bounceInLeft';
        }
    }
    if (animation === 'fadeIn') return 'fadeIn';
    return 'slideInLeft';
}

function getHideAnimationName(animation: string, direction: string): string {
    if (animation === 'slideOut') {
        switch (direction) {
            case 'left': return 'slideOutLeft';
            case 'right': return 'slideOutRight';
            case 'top': return 'slideOutTop';
            case 'bottom': return 'slideOutBottom';
            default: return 'slideOutLeft';
        }
    }
    if (animation === 'fadeOut') return 'fadeOut';
    return 'slideOutLeft';
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function NowPlayingOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    const [config, setConfig] = useState<NowPlayingWidgetConfig>(DEFAULT_CONFIG);
    const [isEnabled, setIsEnabled] = useState(true);
    const [track, setTrack] = useState<NowPlayingTrack | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isSongChanging, setIsSongChanging] = useState(false);
    const [progressMs, setProgressMs] = useState(0);

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const trackRef = useRef<NowPlayingTrack | null>(null);
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);
    const lastProgressMsRef = useRef<number>(0);
    const songTitleRef = useRef<HTMLDivElement | null>(null);
    const songTitleContainerRef = useRef<HTMLDivElement | null>(null);
    const [needsMarquee, setNeedsMarquee] = useState(false);

    // Refs for stable callbacks (avoid stale closures in SignalR handlers)
    const isVisibleRef = useRef(false);
    const configRef = useRef(config);
    const isExitingRef = useRef(false);

    useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);
    useEffect(() => { configRef.current = config; }, [config]);
    useEffect(() => { isExitingRef.current = isExiting; }, [isExiting]);

    // ============================================================================
    // FETCH CONFIG & CURRENT TRACK
    // ============================================================================

    const fetchConfig = useCallback(async () => {
        if (!channel) return;
        try {
            const res = await fetch(`/api/nowplaying/config/overlay/${channel}`);
            if (res.ok) {
                const json = await res.json();
                // API returns { success, config: { isEnabled, provider, pollingInterval, config: {...} } }
                const data = json?.config;
                if (data) {
                    setIsEnabled(data.isEnabled ?? true);
                    if (data.config) {
                        setConfig(prev => deepMerge(prev, data.config));
                    }
                }
            }
        } catch (err) {
            console.error('[NowPlayingOverlay] Error fetching config:', err);
        }
    }, [channel]);

    const fetchCurrentTrack = useCallback(async () => {
        if (!channel) return;
        try {
            const res = await fetch(`/api/nowplaying/now/${channel}`);
            if (res.ok) {
                const json = await res.json();
                // API returns { success, data: { song, artist, ... } }
                const data = json?.data as NowPlayingTrack;
                if (data && data.isPlaying && data.song) {
                    handleTrackUpdate(data);
                }
            }
        } catch (err) {
            console.error('[NowPlayingOverlay] Error fetching current track:', err);
        }
    }, [channel]);

    // ============================================================================
    // TRACK UPDATE HANDLER
    // ============================================================================

    const handleTrackUpdate = useCallback((data: NowPlayingTrack) => {
        const prevTrack = trackRef.current;
        const isNewSong = data.isNewTrack || !prevTrack || prevTrack.song !== data.song || prevTrack.artist !== data.artist;

        trackRef.current = data;

        if (!data.isPlaying) {
            handleStop();
            return;
        }

        if (isNewSong && prevTrack && isVisibleRef.current) {
            // Song changed while visible - crossfade
            setIsSongChanging(true);
            const duration = configRef.current.animations.songChangeDuration;
            setTimeout(() => {
                setTrack(data);
                setIsSongChanging(false);
            }, duration);
        } else {
            setTrack(data);
        }

        // Start progress tracking
        startProgressTracking(data);

        // Show widget if not visible
        if (!isVisibleRef.current) {
            setIsExiting(false);
            setIsVisible(true);
        }
    }, []);

    const handleStop = useCallback(() => {
        if (!isVisibleRef.current || isExitingRef.current) return;
        setIsExiting(true);
        const hideDuration = configRef.current.animations.hideDuration || 500;
        setTimeout(() => {
            setIsVisible(false);
            setIsExiting(false);
            setTrack(null);
            trackRef.current = null;
            stopProgressTracking();
        }, hideDuration);
    }, []);

    // ============================================================================
    // PROGRESS BAR INTERPOLATION
    // ============================================================================

    const startProgressTracking = useCallback((data: NowPlayingTrack) => {
        stopProgressTracking();

        const now = Date.now();
        lastUpdateTimeRef.current = now;

        // If Spotify provides progressMs, use it directly (accurate)
        // Otherwise estimate from timestamp (Last.fm)
        if (data.progressMs != null && data.progressMs > 0) {
            lastProgressMsRef.current = data.progressMs;
        } else {
            const serverTime = new Date(data.timestamp).getTime();
            const elapsed = now - serverTime;
            lastProgressMsRef.current = elapsed > 0 ? elapsed : 0;
        }
        setProgressMs(lastProgressMsRef.current);

        if (data.durationMs > 0 && data.isPlaying) {
            progressIntervalRef.current = setInterval(() => {
                const currentTime = Date.now();
                const timeSinceUpdate = currentTime - lastUpdateTimeRef.current;
                const currentProgress = lastProgressMsRef.current + timeSinceUpdate;
                setProgressMs(Math.min(currentProgress, data.durationMs));
            }, 100);
        }
    }, []);

    const stopProgressTracking = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);

    // ============================================================================
    // CHECK MARQUEE OVERFLOW
    // ============================================================================

    useEffect(() => {
        if (songTitleRef.current && songTitleContainerRef.current && config.layout.marqueeOnOverflow) {
            const textWidth = songTitleRef.current.scrollWidth;
            const containerWidth = songTitleContainerRef.current.clientWidth;
            setNeedsMarquee(textWidth > containerWidth);
        } else {
            setNeedsMarquee(false);
        }
    }, [track?.song, config.layout.marqueeOnOverflow]);

    // ============================================================================
    // AUTO-HIDE TIMEOUT (15s without update → hide overlay)
    // ============================================================================

    useEffect(() => {
        if (!isVisible || !track) return;

        const timeoutCheck = setInterval(() => {
            const timeSinceUpdate = Date.now() - lastUpdateTimeRef.current;
            // 30s timeout - generous enough for slow API responses
            if (timeSinceUpdate > 30000) {
                handleStop();
            }
        }, 5000);

        return () => clearInterval(timeoutCheck);
    }, [isVisible, track, handleStop]);

    // ============================================================================
    // SIGNALR CONNECTION
    // ============================================================================

    useEffect(() => {
        if (!channel) {
            console.error('[NowPlayingOverlay] No channel provided');
            return;
        }

        // Fetch initial data
        fetchConfig();
        fetchCurrentTrack();

        let stopped = false;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

        const setupSignalRConnection = async () => {
            if (stopped) return;

            const connection = new signalR.HubConnectionBuilder()
                .withUrl('/hubs/overlay')
                .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
                .configureLogging(signalR.LogLevel.None)
                .build();

            connection.on('NowPlayingUpdate', (data: NowPlayingTrack) => {
                console.log('[NowPlayingOverlay] NowPlayingUpdate:', data.song, '-', data.artist);
                handleTrackUpdate(data);
            });

            connection.on('NowPlayingStopped', () => {
                console.log('[NowPlayingOverlay] NowPlayingStopped');
                handleStop();
            });

            connection.on('NowPlayingConfigChanged', () => {
                console.log('[NowPlayingOverlay] Config changed, reloading...');
                fetchConfig();
            });

            // Ignore unrelated SignalR messages
            connection.on('TimerTick', () => {});
            connection.on('TimerStateUpdate', () => {});
            connection.on('TimerEventAlert', () => {});
            connection.on('ShowEventAlert', () => {});

            connection.onreconnected(async () => {
                console.log('[NowPlayingOverlay] Reconnected, re-joining channel...');
                try {
                    await connection.invoke('JoinChannel', channel);
                    console.log(`[NowPlayingOverlay] Re-joined overlay_${channel}`);
                    // Re-fetch current state after reconnect
                    fetchCurrentTrack();
                } catch (err) {
                    console.error('[NowPlayingOverlay] Error re-joining channel:', err);
                }
            });

            connection.onclose((error) => {
                if (stopped) return;
                console.error(`[NowPlayingOverlay] Disconnected. Error: ${error?.message || 'Unknown'}`);
                console.log('[NowPlayingOverlay] Retrying in 5 seconds...');
                reconnectTimeout = setTimeout(setupSignalRConnection, 5000);
            });

            try {
                await connection.start();
                if (stopped) {
                    connection.stop();
                    return;
                }
                console.log(`[NowPlayingOverlay] Connected, joining overlay_${channel}`);
                await connection.invoke('JoinChannel', channel);
                console.log(`[NowPlayingOverlay] Ready on overlay_${channel}`);
                connectionRef.current = connection;
            } catch (err) {
                if (!stopped) {
                    console.error('[NowPlayingOverlay] Error connecting to SignalR:', err);
                    console.log('[NowPlayingOverlay] Retrying in 5 seconds...');
                    reconnectTimeout = setTimeout(setupSignalRConnection, 5000);
                }
            }
        };

        setupSignalRConnection();

        return () => {
            stopped = true;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            stopProgressTracking();
            connectionRef.current?.stop();
        };
    }, [channel]);

    // ============================================================================
    // RENDER
    // ============================================================================

    if (!isEnabled || !track || !isVisible) {
        return null;
    }

    const { layout, style, albumArt, typography, progressBar, animations, overlay, canvas } = config;
    const overlayMode = (overlay as any).mode || 'card';
    const els = overlayMode === 'free'
        ? (overlay as any).freeConfig || (overlay as any).elements
        : (overlay as any).cardConfig || (overlay as any).elements;

    // Show/hide animation
    const showAnimName = getShowAnimationName(animations.showAnimation, animations.showDirection);
    const hideAnimName = getHideAnimationName(animations.hideAnimation, animations.hideDirection);
    const animDuration = isExiting ? animations.hideDuration : animations.showDuration;
    const animEasing = isExiting ? animations.hideEasing : animations.showEasing;

    const containerAnimation = isExiting
        ? `${hideAnimName} ${animDuration}ms ${animEasing} forwards`
        : `${showAnimName} ${animDuration}ms ${animEasing}`;

    // Song change animation
    const songChangeStyle: React.CSSProperties = isSongChanging
        ? { opacity: 0, transition: `opacity ${animations.songChangeDuration}ms ease` }
        : { animation: `crossfade ${animations.songChangeDuration}ms ease` };

    // Background
    const background = getBackgroundCSS(style);

    // Progress
    const durationMs = track.durationMs || 0;
    const progressPercent = durationMs > 0 ? Math.min((progressMs / durationMs) * 100, 100) : 0;

    // Helper: position as % of canvas
    const pos = (x: number, y: number) => ({
        left: `${(x / canvas.width) * 100}%`,
        top: `${(y / canvas.height) * 100}%`,
    });

    // Provider icon renderer
    const renderProviderIcon = (size: number) => {
        if (track.provider === 'lastfm' || track.provider === 'Last.fm') {
            return <img src={LASTFM_ICON} alt="Last.fm" style={{ width: size, height: size }} />;
        }
        if (track.provider === 'spotify') {
            return <img src={SPOTIFY_ICON} alt="Spotify" style={{ width: size, height: size }} />;
        }
        return (
            <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.6, color: '#fff', fontWeight: 700 }}>
                {(track.provider || '?')[0].toUpperCase()}
            </div>
        );
    };

    // ─── FREE MODE: each element positioned absolutely ──────────────
    if (overlayMode === 'free') {
        const freeCard = els.card;
        return (
            <>
                <style>{OVERLAY_STYLES}</style>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, animation: containerAnimation, ...songChangeStyle }}>
                    {/* Card background */}
                    <div style={{
                        position: 'absolute',
                        ...pos(freeCard.x, freeCard.y),
                        width: freeCard.width,
                        height: freeCard.height,
                        background,
                        opacity: style.opacity / 100,
                        borderRadius: style.borderRadius,
                        border: style.borderEnabled ? `${style.borderWidth}px solid ${style.borderColor}` : 'none',
                        boxShadow: style.backgroundType !== 'transparent' ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
                        boxSizing: 'border-box',
                    }} />

                    {/* Album Art */}
                    {layout.showAlbumArt && track.albumArtUrl && els.albumArt && (
                        <div style={{
                            position: 'absolute',
                            ...pos(els.albumArt.x, els.albumArt.y),
                            width: els.albumArt.size,
                            height: els.albumArt.size,
                            borderRadius: albumArt.borderRadius,
                            overflow: 'hidden',
                            boxShadow: albumArt.shadow ? '0 4px 12px rgba(0,0,0,0.5)' : 'none',
                        }}>
                            <img src={track.albumArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
                        </div>
                    )}

                    {/* Song Title */}
                    {els.songTitle && (
                        <div
                            ref={songTitleContainerRef}
                            style={{
                                position: 'absolute',
                                ...pos(els.songTitle.x, els.songTitle.y),
                                maxWidth: els.songTitle.maxWidth,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <div
                                ref={songTitleRef}
                                style={{
                                    display: 'inline-block',
                                    fontFamily: `${typography.songTitle.fontFamily}, sans-serif`,
                                    fontSize: typography.songTitle.fontSize,
                                    fontWeight: typography.songTitle.fontWeight,
                                    color: typography.songTitle.color,
                                    textShadow: getTextShadowCSS(typography.songTitle.textShadow),
                                    lineHeight: 1.3,
                                    whiteSpace: 'nowrap',
                                    ...(needsMarquee && layout.marqueeOnOverflow ? { animation: 'marquee 10s linear infinite', paddingRight: 40 } : {}),
                                }}
                            >
                                {needsMarquee && layout.marqueeOnOverflow ? <>{track.song}<span style={{ paddingLeft: 40 }}>{track.song}</span></> : track.song}
                            </div>
                        </div>
                    )}

                    {/* Artist */}
                    {layout.showArtist && track.artist && els.artist && (
                        <div style={{
                            position: 'absolute',
                            ...pos(els.artist.x, els.artist.y),
                            maxWidth: els.artist.maxWidth,
                            fontFamily: `${typography.artist.fontFamily}, sans-serif`,
                            fontSize: typography.artist.fontSize,
                            fontWeight: typography.artist.fontWeight,
                            color: typography.artist.color,
                            textShadow: getTextShadowCSS(typography.artist.textShadow),
                            lineHeight: 1.3,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {track.artist}
                        </div>
                    )}

                    {/* Album */}
                    {layout.showAlbum && track.album && els.album && (
                        <div style={{
                            position: 'absolute',
                            ...pos(els.album.x, els.album.y),
                            maxWidth: els.album.maxWidth,
                            fontFamily: `${typography.album.fontFamily}, sans-serif`,
                            fontSize: typography.album.fontSize,
                            fontWeight: typography.album.fontWeight,
                            color: typography.album.color,
                            textShadow: getTextShadowCSS(typography.album.textShadow),
                            lineHeight: 1.3,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {track.album}
                        </div>
                    )}

                    {/* Progress Bar */}
                    {layout.showProgressBar && durationMs > 0 && els.progressBar && (
                        <div style={{
                            position: 'absolute',
                            ...pos(els.progressBar.x, els.progressBar.y),
                            width: els.progressBar.width,
                            height: els.progressBar.height,
                            backgroundColor: progressBar.backgroundColor,
                            borderRadius: progressBar.borderRadius,
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                backgroundColor: progressBar.foregroundColor,
                                borderRadius: progressBar.borderRadius,
                                transition: progressBar.animated ? 'width 0.1s linear' : 'none',
                            }} />
                        </div>
                    )}

                    {/* Timestamps */}
                    {layout.showTimeStamps && durationMs > 0 && els.timestamps && (
                        <div style={{
                            position: 'absolute',
                            ...pos(els.timestamps.x, els.timestamps.y),
                            display: 'flex',
                            gap: 8,
                            fontFamily: `${typography.time.fontFamily}, sans-serif`,
                            fontSize: typography.time.fontSize,
                            fontWeight: typography.time.fontWeight,
                            color: typography.time.color,
                        }}>
                            <span>{formatTime(progressMs)}</span>
                            <span>/</span>
                            <span>{formatTime(durationMs)}</span>
                        </div>
                    )}

                    {/* Provider Icon */}
                    {layout.showProviderIcon && els.providerIcon && (
                        <div style={{
                            position: 'absolute',
                            ...pos(els.providerIcon.x, els.providerIcon.y),
                            opacity: 0.6,
                        }}>
                            {renderProviderIcon(els.providerIcon.size)}
                        </div>
                    )}
                </div>
            </>
        );
    }

    // ─── CARD MODE: single card with auto layout ────────────────────
    const cardEl = els.card;
    const cardStyle: React.CSSProperties = {
        position: 'fixed',
        ...pos(cardEl.x, cardEl.y),
        width: cardEl.width,
        height: cardEl.height,
        zIndex: 9999,
    };

    const isHorizontal = layout.orientation === 'horizontal';
    const borderW = style.borderEnabled ? style.borderWidth : 0;

    // Scale factor: everything scales proportionally to card size vs default (760x220)
    const defaultCardW = 760, defaultCardH = 220;
    const scaleX = cardEl.width / defaultCardW;
    const scaleY = cardEl.height / defaultCardH;
    const scaleFactor = Math.min(scaleX, scaleY); // Uniform scale based on smallest axis
    const s = (v: number) => Math.round(v * scaleFactor); // Scale helper

    const cardPadding = s(isHorizontal ? 12 : 16);
    const cardArtSize = isHorizontal
        ? cardEl.height - (cardPadding * 2) - (borderW * 2)
        : Math.min(cardEl.width - (cardPadding * 2) - (borderW * 2), s(albumArt.size));

    return (
        <>
            <style>{OVERLAY_STYLES}</style>

            <div style={{ ...cardStyle, animation: containerAnimation }}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: isHorizontal ? 'row' : 'column',
                        alignItems: isHorizontal ? 'center' : 'stretch',
                        gap: s(isHorizontal ? 12 : 8),
                        padding: cardPadding,
                        background,
                        opacity: style.opacity / 100,
                        borderRadius: s(style.borderRadius),
                        border: style.borderEnabled
                            ? `${Math.max(1, s(style.borderWidth))}px solid ${style.borderColor}`
                            : 'none',
                        boxShadow: style.backgroundType !== 'transparent'
                            ? '0 4px 16px rgba(0,0,0,0.4)'
                            : 'none',
                        overflow: 'hidden',
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        boxSizing: 'border-box',
                        ...songChangeStyle,
                    }}
                >
                    {/* Album Art — scales proportionally */}
                    {layout.showAlbumArt && track.albumArtUrl && (
                        <div style={{
                            flexShrink: 0,
                            width: Math.max(cardArtSize, 20),
                            height: Math.max(cardArtSize, 20),
                            borderRadius: s(albumArt.borderRadius),
                            overflow: 'hidden',
                            boxShadow: albumArt.shadow ? '0 4px 12px rgba(0,0,0,0.5)' : 'none',
                            alignSelf: 'center',
                        }}>
                            <img src={track.albumArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
                        </div>
                    )}

                    {/* Track Info */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: s(2), overflow: 'hidden' }}>
                        {/* Song Title */}
                        <div ref={songTitleContainerRef} style={{ overflow: 'hidden', whiteSpace: 'nowrap', position: 'relative' }}>
                            <div
                                ref={songTitleRef}
                                style={{
                                    display: 'inline-block',
                                    fontFamily: `${typography.songTitle.fontFamily}, sans-serif`,
                                    fontSize: s(typography.songTitle.fontSize),
                                    fontWeight: typography.songTitle.fontWeight,
                                    color: typography.songTitle.color,
                                    textShadow: getTextShadowCSS(typography.songTitle.textShadow),
                                    lineHeight: 1.3,
                                    whiteSpace: 'nowrap',
                                    ...(needsMarquee && layout.marqueeOnOverflow ? { animation: 'marquee 10s linear infinite', paddingRight: s(40) } : {}),
                                }}
                            >
                                {needsMarquee && layout.marqueeOnOverflow ? <>{track.song}<span style={{ paddingLeft: s(40) }}>{track.song}</span></> : track.song}
                            </div>
                        </div>

                        {/* Artist */}
                        {layout.showArtist && track.artist && (
                            <div style={{ fontFamily: `${typography.artist.fontFamily}, sans-serif`, fontSize: s(typography.artist.fontSize), fontWeight: typography.artist.fontWeight, color: typography.artist.color, textShadow: getTextShadowCSS(typography.artist.textShadow), lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {track.artist}
                            </div>
                        )}

                        {/* Album */}
                        {layout.showAlbum && track.album && (
                            <div style={{ fontFamily: `${typography.album.fontFamily}, sans-serif`, fontSize: s(typography.album.fontSize), fontWeight: typography.album.fontWeight, color: typography.album.color, textShadow: getTextShadowCSS(typography.album.textShadow), lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {track.album}
                            </div>
                        )}

                        {/* Progress Bar + Time */}
                        {layout.showProgressBar && durationMs > 0 && (
                            <div style={{ marginTop: s(4) }}>
                                <div style={{ width: '100%', height: s(progressBar.height), backgroundColor: progressBar.backgroundColor, borderRadius: s(progressBar.borderRadius), overflow: 'hidden' }}>
                                    <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: progressBar.foregroundColor, borderRadius: s(progressBar.borderRadius), transition: progressBar.animated ? 'width 0.1s linear' : 'none' }} />
                                </div>
                                {layout.showTimeStamps && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: s(2), fontFamily: `${typography.time.fontFamily}, sans-serif`, fontSize: s(typography.time.fontSize), fontWeight: typography.time.fontWeight, color: typography.time.color }}>
                                        <span>{formatTime(progressMs)}</span>
                                        <span>{formatTime(durationMs)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Provider Icon */}
                    {layout.showProviderIcon && (
                        <div style={{ position: 'absolute', top: s(6), right: s(6), opacity: 0.6 }}>
                            {renderProviderIcon(s(16))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ============================================================================
// UTILS
// ============================================================================

/**
 * Deep merge two objects. Source values override target values.
 * Arrays are replaced, not merged.
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key of Object.keys(source) as (keyof T)[]) {
        const sourceVal = source[key];
        const targetVal = target[key];
        if (
            sourceVal &&
            typeof sourceVal === 'object' &&
            !Array.isArray(sourceVal) &&
            targetVal &&
            typeof targetVal === 'object' &&
            !Array.isArray(targetVal)
        ) {
            (result as any)[key] = deepMerge(targetVal as any, sourceVal as any);
        } else if (sourceVal !== undefined) {
            (result as any)[key] = sourceVal;
        }
    }
    return result;
}
