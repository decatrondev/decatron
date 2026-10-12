import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { isTokenExpired } from '../../../utils/jwt';
import type { ChatMsg, ChatStatus, MeInfo, ModRequest, Role, SendResult } from './types';

const MAX_MESSAGES = 600;
const FLUSH_MS = 200;

type Raw = Omit<ChatMsg, 'key' | 'deleted'>;

/**
 * Conexión al hub público /hubs/multiview: dice qué canales se miran y recibe su chat. Los mensajes se agrupan y se
 * entregan cada 200 ms para que un canal muy activo no obligue a dibujar el panel por cada línea.
 */
export function useMultiviewChat(keys: string[], enabled: boolean, present: boolean) {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [status, setStatus] = useState<ChatStatus>('connecting');
    const [me, setMe] = useState<MeInfo>({ authenticated: false, twitch: null, kick: null });
    const [roles, setRoles] = useState<Record<string, Role>>({});
    const conn = useRef<signalR.HubConnection | null>(null);
    const presentRef = useRef(present);
    presentRef.current = present;
    const keysRef = useRef(keys);
    keysRef.current = keys;
    const queue = useRef<ChatMsg[]>([]);
    const timer = useRef<number | null>(null);
    const keyList = keys.join(',');

    useEffect(() => {
        if (!enabled) return;
        const c = new signalR.HubConnectionBuilder()
            // Con sesión iniciada el token viaja al conectar (el servidor reconoce quién escribe); sin sesión o vencido, anónimo.
            .withUrl('/hubs/multiview', {
                accessTokenFactory: () => {
                    try { const k = localStorage.getItem('token'); return k && !isTokenExpired(k, 60) ? k : ''; } catch { return ''; }
                },
            })
            .withAutomaticReconnect([0, 1000, 3000, 8000, 15000, 30000])
            .configureLogging(signalR.LogLevel.None)
            .build();
        conn.current = c;

        const flush = () => {
            timer.current = null;
            const batch = queue.current;
            if (!batch.length) return;
            queue.current = [];
            setMessages(prev => {
                const seen = new Set(prev.map(m => m.key + m.id));
                const fresh = batch.filter(m => !seen.has(m.key + m.id));
                if (!fresh.length) return prev;
                const next = prev.concat(fresh);
                return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
            });
        };
        const push = (m: ChatMsg) => {
            queue.current.push(m);
            if (timer.current == null) timer.current = window.setTimeout(flush, FLUSH_MS);
        };

        c.on('Message', (key: string, m: Raw) => push({ ...m, key }));
        c.on('History', (key: string, list: Raw[]) => {
            // Lo anterior de ese canal se reemplaza por el historial: así no se duplica al reconectar.
            setMessages(prev => {
                const kept = prev.filter(m => m.key !== key);
                const merged = kept.concat(list.map(m => ({ ...m, key })));
                merged.sort((a, b) => a.ts - b.ts);
                return merged.length > MAX_MESSAGES ? merged.slice(merged.length - MAX_MESSAGES) : merged;
            });
        });
        // El servidor avisa en qué canales puede moderar quien mira (según Twitch o Kick).
        c.on('Role', (key: string, role: string) => setRoles(prev => {
            const next = { ...prev };
            if (role === 'mod' || role === 'broadcaster') next[key] = role; else delete next[key];
            return next;
        }));
        c.on('Deleted', (key: string, id: string | null, user: string | null) => {
            setMessages(prev => prev.map(m => {
                if (m.key !== key || m.deleted) return m;
                if (id && m.id === id) return { ...m, deleted: true };
                // Sin id: se limpió el chat (user vacío) o se sancionó a una persona.
                if (!id && (user === '' || user === null || m.user.login === user)) return { ...m, deleted: true };
                return m;
            }));
        });

        const follow = () => c.invoke('Follow', keysRef.current, presentRef.current).catch(() => { /* se reintenta al reconectar */ });
        const loadMe = () => c.invoke<MeInfo>('Me').then(setMe).catch(() => { /* sin datos de cuenta: no se puede escribir */ });
        c.onreconnecting(() => setStatus('reconnecting'));
        c.onreconnected(() => { setStatus('live'); void follow(); void loadMe(); });
        c.onclose(() => setStatus('off'));

        let stopped = false;
        c.start().then(() => { if (stopped) return; setStatus('live'); void follow(); void loadMe(); }).catch(() => { if (!stopped) setStatus('off'); });

        return () => {
            stopped = true;
            if (timer.current != null) window.clearTimeout(timer.current);
            timer.current = null;
            queue.current = [];
            conn.current = null;
            void c.stop();
        };
    }, [enabled]);

    // Cambia la lista de canales: se avisa al servidor y se descartan los mensajes de los que ya no están.
    useEffect(() => {
        const c = conn.current;
        if (c && c.state === signalR.HubConnectionState.Connected) c.invoke('Follow', keys, presentRef.current).catch(() => { /* ya reconectará */ });
        setMessages(prev => {
            const next = prev.filter(m => keys.includes(m.key));
            return next.length === prev.length ? prev : next;
        });
        setRoles(prev => {
            const next = Object.fromEntries(Object.entries(prev).filter(([k]) => keys.includes(k))) as Record<string, Role>;
            return Object.keys(next).length === Object.keys(prev).length ? prev : next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyList]);

    // Cambiar el permiso de aparecer como conectado se aplica sin reconectar.
    useEffect(() => {
        const c = conn.current;
        if (c && c.state === signalR.HubConnectionState.Connected) c.invoke('Follow', keysRef.current, present).catch(() => { /* ya reconectará */ });
    }, [present]);

    const send = useCallback(async (key: string, text: string, replyTo?: string | null): Promise<SendResult> => {
        const c = conn.current;
        if (!c || c.state !== signalR.HubConnectionState.Connected) return { ok: false, code: 'offline' };
        try { return await c.invoke<SendResult>('Send', key, text, replyTo ?? null); }
        catch { return { ok: false, code: 'failed' }; }
    }, []);

    const moderate = useCallback(async (req: ModRequest): Promise<SendResult> => {
        const c = conn.current;
        if (!c || c.state !== signalR.HubConnectionState.Connected) return { ok: false, code: 'offline' };
        try { return await c.invoke<SendResult>('Moderate', req); }
        catch { return { ok: false, code: 'failed' }; }
    }, []);

    return { messages, status, me, send, roles, moderate };
}
