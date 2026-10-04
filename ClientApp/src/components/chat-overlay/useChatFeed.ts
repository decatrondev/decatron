import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMsg, ChatOverlayConfig } from './types';

export interface FeedItem {
    msg: ChatMsg;
    addedAt: number;
    /** Desde cuándo se está yendo (animación de salida); null mientras se ve normal */
    leavingAt: number | null;
}

const FLUSH_MS = 80;
const PRUNE_MS = 250;

/**
 * Los mensajes que se ven en el overlay. Los que llegan se juntan unos 80 ms y se agregan de una vez
 * (un chat rápido no debe provocar cien renders por segundo); los viejos se van por cantidad o, si
 * está configurado, por tiempo, con su animación de salida. Lo usan el overlay de OBS y la vista previa.
 */
export function useChatFeed(config: ChatOverlayConfig) {
    const [items, setItems] = useState<FeedItem[]>([]);
    const queue = useRef<ChatMsg[]>([]);
    const cfg = useRef(config);
    cfg.current = config;

    const exitMs = () => (cfg.current.animations.exit === 'none' ? 0 : cfg.current.animations.durationMs);

    useEffect(() => {
        const flush = window.setInterval(() => {
            if (queue.current.length === 0) return;
            const incoming = queue.current.splice(0);
            const now = Date.now();
            setItems(prev => {
                const known = new Set(prev.map(i => i.msg.id));
                const fresh = incoming.filter(m => !known.has(m.id)).map<FeedItem>(msg => ({ msg, addedAt: now, leavingAt: null }));
                return [...prev, ...fresh].slice(-cfg.current.display.maxMessages);
            });
        }, FLUSH_MS);

        const prune = window.setInterval(() => {
            const now = Date.now();
            const seconds = cfg.current.display.messageSeconds;
            setItems(prev => {
                let changed = false;
                const next: FeedItem[] = [];
                for (const item of prev) {
                    if (item.leavingAt !== null) {
                        if (now - item.leavingAt >= exitMs()) { changed = true; continue; }
                        next.push(item);
                    } else if (seconds > 0 && now - item.addedAt >= seconds * 1000) {
                        changed = true;
                        next.push(exitMs() === 0 ? { ...item, leavingAt: now - exitMs() } : { ...item, leavingAt: now });
                    } else {
                        next.push(item);
                    }
                }
                // Si cambió la cantidad máxima en la config, se recorta
                const trimmed = next.length > cfg.current.display.maxMessages ? next.slice(-cfg.current.display.maxMessages) : next;
                return changed || trimmed.length !== prev.length ? trimmed : prev;
            });
        }, PRUNE_MS);

        return () => { window.clearInterval(flush); window.clearInterval(prune); };
    }, []);

    const push = useCallback((msg: ChatMsg) => { queue.current.push(msg); }, []);
    const remove = useCallback((id: string) => {
        queue.current = queue.current.filter(m => m.id !== id);
        setItems(prev => prev.filter(i => i.msg.id !== id));
    }, []);
    /** Ban o timeout: se quitan los mensajes de esa persona que vinieron del propio canal */
    const removeUser = useCallback((login: string, channel: string) => {
        const drop = (m: ChatMsg) => m.user.login === login && (m.channel.login === channel || !m.channel.shared);
        queue.current = queue.current.filter(m => !drop(m));
        setItems(prev => prev.filter(i => !drop(i.msg)));
    }, []);
    const clear = useCallback(() => { queue.current = []; setItems([]); }, []);

    return { items, push, remove, removeUser, clear };
}
