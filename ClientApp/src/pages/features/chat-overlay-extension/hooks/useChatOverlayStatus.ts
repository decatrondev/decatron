import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';

export interface ChatOverlayStatus {
    total: number;
    all: number;
    twitch: number;
    kick: number;
    warnings: Array<'mixed' | 'repeated'>;
}

const EMPTY: ChatOverlayStatus = { total: 0, all: 0, twitch: 0, kick: 0, warnings: [] };

/** Qué fuentes de chat hay conectadas en OBS ahora. Se vuelve a preguntar cada pocos segundos mientras la pestaña está abierta */
export function useChatOverlayStatus(intervalMs = 5000) {
    const [status, setStatus] = useState<ChatOverlayStatus>(EMPTY);
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/chat-overlay/status');
            if (res.data?.success) {
                setStatus({
                    total: res.data.total ?? 0, all: res.data.all ?? 0, twitch: res.data.twitch ?? 0, kick: res.data.kick ?? 0,
                    warnings: res.data.warnings ?? [],
                });
                setLoaded(true);
            }
        } catch { /* se queda con el último estado */ }
    }, []);

    useEffect(() => {
        load();
        const id = window.setInterval(() => { if (!document.hidden) load(); }, intervalMs);
        return () => window.clearInterval(id);
    }, [load, intervalMs]);

    return { status, loaded, refresh: load };
}
