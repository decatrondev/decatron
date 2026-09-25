import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as signalR from '@microsoft/signalr';
import SongOverlayRenderer, { type OverlayLabels } from './features/song-request-extension/components/SongOverlayRenderer';
import YouTubePlayer from './features/song-request-extension/components/YouTubePlayer';
import { useSongRequestPlayer, useSongRequestWatch } from './features/song-request-extension/hooks/useSongRequestHub';
import { normalizeOverlayConfig } from './features/song-request-extension/constants/defaults';
import { useLayoutFonts } from './features/song-request-extension/utils';
import type { SongRequestOverlayConfig } from './features/song-request-extension/types';

// Overlay de song request para OBS (.dev/plans/SONG_REQUEST_PLAN.md, fase 2).
//   /overlay/songrequest?channel=X&key=Y  → el que suena (reproductor + su diseño)
//   /overlay/songrequest?channel=X        → solo muestra ("sonando ahora"), sin audio

function useOverlayConfig(channel: string) {
    const [config, setConfig] = useState<SongRequestOverlayConfig | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/public/song-request/${encodeURIComponent(channel)}/overlay`);
            if (res.ok) setConfig(normalizeOverlayConfig((await res.json()).overlayConfig));
        } catch { /* se reintenta con el próximo aviso */ }
    }, [channel]);

    useEffect(() => {
        if (!channel) return;
        load();
        // El editor avisa al guardar; conexión aparte para no mezclarlo con el reproductor
        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/songrequest')
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.None)
            .build();
        connection.on('SongRequestConfigChanged', load);
        connection.on('SongRequestUpdated', () => { /* lo maneja la otra conexión */ });
        connection.start().then(() => connection.invoke('Watch', channel.toLowerCase())).catch(() => { /* sin avisos: queda el diseño cargado */ });
        return () => { connection.stop(); };
    }, [channel, load]);

    return config;
}

function useLabels(): OverlayLabels {
    const { t } = useTranslation('overlays');
    return {
        requestedBy: t('songRequest.overlayLabels.requestedBy', { user: '{{user}}' }),
        next: t('songRequest.overlayLabels.next'),
        idle: t('songRequest.overlayLabels.idle'),
    };
}

export default function SongRequestOverlay() {
    const [params] = useSearchParams();
    const channel = (params.get('channel') || '').toLowerCase();
    const key = params.get('key');

    useEffect(() => {
        document.body.style.background = 'transparent';
        document.documentElement.style.background = 'transparent';
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';
    }, []);

    if (!channel) return null;
    return key ? <PlayerOverlay channel={channel} playerKey={key} /> : <DisplayOverlay channel={channel} />;
}

function PlayerOverlay({ channel, playerKey }: { channel: string; playerKey: string }) {
    const { t } = useTranslation('overlays');
    const labels = useLabels();
    const config = useOverlayConfig(channel);
    const { snapshot, status, progress, reportEnded, reportError, reportProgress } = useSongRequestPlayer(channel, playerKey);
    const layout = config?.player ?? null;
    useLayoutFonts([layout]);

    const current = snapshot?.current ?? null;
    const item = useMemo(
        () => (current?.sourceId ? { id: current.id, videoId: current.sourceId } : null),
        [current?.id, current?.sourceId],
    );

    if (status === 'invalid_key') {
        return <OverlayNotice text={t('songRequest.overlayErrors.invalidKey')} />;
    }
    // Otro reproductor tomó el control: este se calla y desaparece
    if (status === 'replaced' || !layout) return null;

    const player = (
        <YouTubePlayer
            item={item}
            paused={snapshot?.paused ?? false}
            volume={snapshot?.volume ?? 50}
            onEnded={reportEnded}
            onError={reportError}
            onProgress={reportProgress}
        />
    );

    return (
        <>
            <SongOverlayRenderer
                layout={layout}
                current={current}
                queue={snapshot?.queue ?? []}
                progress={progress}
                paused={snapshot?.paused ?? false}
                labels={labels}
                videoSlot={layout.elements.video.enabled ? player : undefined}
            />
            {/* Sin el video en el diseño, el reproductor igual tiene que existir para sonar */}
            {!layout.elements.video.enabled && (
                <div style={{ position: 'fixed', left: 0, top: 0, width: 200, height: 200, opacity: 0, pointerEvents: 'none' }} aria-hidden>
                    {player}
                </div>
            )}
        </>
    );
}

function DisplayOverlay({ channel }: { channel: string }) {
    const labels = useLabels();
    const config = useOverlayConfig(channel);
    const { snapshot, progress } = useSongRequestWatch(channel);
    const layout = config?.nowPlaying ?? null;
    useLayoutFonts([layout]);
    if (!layout || !snapshot?.enabled) return null;

    return (
        <SongOverlayRenderer
            layout={layout}
            current={snapshot.current}
            queue={snapshot.queue}
            progress={progress}
            paused={snapshot.paused}
            labels={labels}
        />
    );
}

function OverlayNotice({ text }: { text: string }) {
    return (
        <div style={{ display: 'inline-block', margin: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(127,29,29,0.9)', color: '#fff', font: '600 14px system-ui, sans-serif' }}>
            {text}
        </div>
    );
}
