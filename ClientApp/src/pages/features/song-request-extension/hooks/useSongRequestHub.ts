import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import type { PlaybackProgress, QueueSnapshot } from '../types';

// Conexión a /hubs/songrequest. Dos modos:
// - watch: solo mira (overlay de "sonando ahora", cola pública, pestaña Cola del dashboard).
// - player: además toma el control del canal con la clave y avisa terminó / error / avance.

export type PlayerStatus = 'connecting' | 'active' | 'replaced' | 'invalid_key' | 'disconnected';

function buildConnection() {
    return new signalR.HubConnectionBuilder()
        .withUrl('/hubs/songrequest')
        .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
        .configureLogging(signalR.LogLevel.None)
        .build();
}

export function useSongRequestWatch(channel: string | null) {
    const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
    const [progress, setProgress] = useState<PlaybackProgress | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!channel) return;
        const ch = channel.toLowerCase();
        const connection = buildConnection();
        let stopped = false;

        const watch = async () => {
            const state = await connection.invoke<QueueSnapshot | null>('Watch', ch);
            if (!stopped) { setSnapshot(state); setConnected(true); }
        };

        connection.on('SongRequestUpdated', (s: QueueSnapshot) => setSnapshot(s));
        connection.on('SongRequestProgress', (p: PlaybackProgress) => setProgress(p));
        connection.onreconnecting(() => setConnected(false));
        connection.onreconnected(() => { watch().catch(() => setConnected(false)); });
        connection.onclose(() => setConnected(false));

        connection.start().then(watch).catch(() => setConnected(false));
        return () => { stopped = true; connection.stop(); };
    }, [channel]);

    return { snapshot, progress, connected };
}

export function useSongRequestPlayer(channel: string | null, key: string | null, enabled = true) {
    const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
    const [status, setStatus] = useState<PlayerStatus>('connecting');
    const [progress, setProgress] = useState<PlaybackProgress | null>(null);
    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const statusRef = useRef<PlayerStatus>('connecting');
    const ch = channel?.toLowerCase() ?? '';

    const setBoth = (s: PlayerStatus) => { statusRef.current = s; setStatus(s); };

    useEffect(() => {
        if (!channel || !key || !enabled) return;
        const connection = buildConnection();
        connectionRef.current = connection;
        let stopped = false;

        const register = async () => {
            const state = await connection.invoke<QueueSnapshot | null>('RegisterPlayer', ch, key);
            if (stopped) return;
            if (!state) { setBoth('invalid_key'); return; }
            setSnapshot(state);
            setBoth('active');
        };

        connection.on('SongRequestUpdated', (s: QueueSnapshot) => setSnapshot(s));
        connection.on('PlayerReplaced', () => setBoth('replaced'));
        // Quien nos quitó el control se fue (ej. se apagó "escuchar aquí"): volver a sonar
        connection.on('PlayerReleased', () => {
            if (statusRef.current === 'replaced') register().catch(() => setBoth('disconnected'));
        });
        connection.onreconnecting(() => { if (statusRef.current === 'active') setBoth('disconnected'); });
        connection.onreconnected(() => {
            // Si otro tomó el control mientras tanto, no se lo quitamos al reconectar
            if (statusRef.current !== 'replaced') register().catch(() => setBoth('disconnected'));
        });
        connection.onclose(() => { if (statusRef.current === 'active') setBoth('disconnected'); });

        setBoth('connecting');
        connection.start().then(register).catch(() => setBoth('disconnected'));
        return () => { stopped = true; connectionRef.current = null; connection.stop(); };
    }, [channel, key, enabled, ch]);

    const active = status === 'active';

    // Sin nada sonando y con cola: pedir la siguiente
    const current = snapshot?.current ?? null;
    const queueLength = snapshot?.queue.length ?? 0;
    const paused = snapshot?.paused ?? false;
    useEffect(() => {
        if (!active || current || queueLength === 0 || paused) return;
        connectionRef.current?.invoke('PlayerIdle', ch).catch(() => { /* reintenta con el próximo cambio */ });
    }, [active, current, queueLength, paused, ch]);

    const invoke = useCallback((method: string, ...args: unknown[]) => {
        if (statusRef.current !== 'active') return;
        connectionRef.current?.invoke(method, ch, ...args).catch(() => { /* el servidor lo reintenta al reconectar */ });
    }, [ch]);

    const reportEnded = useCallback((itemId: number) => invoke('PlayerEnded', itemId), [invoke]);
    const reportError = useCallback((itemId: number, code: number) => invoke('PlayerError', itemId, code), [invoke]);
    const reportProgress = useCallback((itemId: number, position: number, duration: number, playing: boolean) => {
        setProgress({ itemId, position, duration, playing });
        invoke('PlayerProgress', itemId, position, duration, playing);
    }, [invoke]);

    return { snapshot, status, progress, reportEnded, reportError, reportProgress };
}
