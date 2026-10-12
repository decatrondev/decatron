import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import type { KickStatus, Slot } from './types';

const DEFAULT_MAX = 4;

/** Casillas permitidas según el plan de quien mira (sin sesión, el gratis). */
export function useSlotLimit() {
    const [state, setState] = useState<{ maxSlots: number; tier: string }>({ maxSlots: DEFAULT_MAX, tier: 'free' });
    useEffect(() => {
        let alive = true;
        api.get('/public/multiview/limits')
            .then(r => { if (alive && typeof r.data?.maxSlots === 'number') setState({ maxSlots: r.data.maxSlots, tier: r.data.tier ?? 'free' }); })
            .catch(() => { /* se queda con el límite gratis */ });
        return () => { alive = false; };
    }, []);
    return state;
}

/** Estado de los canales de Kick abiertos (en vivo, espectadores). Se repite cada minuto. */
export function useKickStatus(slots: Slot[]) {
    const [byChannel, setByChannel] = useState<Record<string, KickStatus>>({});
    const list = useMemo(() => slots.filter(s => s.platform === 'kick').map(s => s.channel).join(','), [slots]);

    useEffect(() => {
        if (!list) return;
        let alive = true;
        const load = () => api.get('/public/multiview/kick-status', { params: { kick: list } })
            .then(r => {
                if (!alive) return;
                const next: Record<string, KickStatus> = {};
                for (const it of (r.data?.items ?? []) as KickStatus[]) next[it.slug] = it;
                setByChannel(next);
            })
            .catch(() => { /* sin estado: la casilla se muestra igual */ });
        load();
        const id = window.setInterval(load, 60_000);
        return () => { alive = false; window.clearInterval(id); };
    }, [list]);

    return byChannel;
}

/**
 * Detecta si la página va entrecortada: mide el intervalo entre cuadros durante ventanas de 8 s y, si más de la
 * cuarta parte pasa de 50 ms (menos de 20 fps) en dos ventanas seguidas, avisa. Es una señal aproximada: no ve lo
 * que pasa dentro de los iframes de video, solo el hilo principal de la página. Se calibra con las mediciones de
 * la Fase 0 (punto de rendimiento).
 */
export function useStruggling(active: boolean) {
    const [struggling, setStruggling] = useState(false);
    const bad = useRef(0);

    useEffect(() => {
        if (!active) { setStruggling(false); bad.current = 0; return; }
        let raf = 0;
        let last = performance.now();
        let frames = 0;
        let slow = 0;
        let windowStart = last;
        const tick = (now: number) => {
            if (!document.hidden) {
                frames += 1;
                if (now - last > 50) slow += 1;
                if (now - windowStart >= 8000) {
                    bad.current = frames > 20 && slow / frames > 0.25 ? bad.current + 1 : 0;
                    if (bad.current >= 2) setStruggling(true);
                    frames = 0; slow = 0; windowStart = now;
                }
            } else {
                windowStart = now; frames = 0; slow = 0;
            }
            last = now;
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [active]);

    return [struggling, () => { setStruggling(false); bad.current = 0; }] as const;
}

export interface LiveAlert { id: number; channel: string }

/**
 * Avisa cuando un canal que estaba sin conexión empieza a transmitir: una etiqueta en la página y, si la persona lo
 * activó y el navegador lo permitió, una notificación del sistema (sirve con la pestaña en segundo plano). Solo se
 * avisa del paso de «sin conexión» a «en vivo»: un canal que ya estaba en vivo al abrir la página no avisa.
 */
export function useLiveAlerts(slots: Slot[], liveOf: (s: Slot) => boolean | null, browserNotify: boolean, text: (channel: string) => string) {
    const [alerts, setAlerts] = useState<LiveAlert[]>([]);
    const prev = useRef<Record<string, boolean | null>>({});
    const counter = useRef(0);
    const state = slots.map(s => `${s.id}=${liveOf(s)}`).join('|');
    const textRef = useRef(text);
    textRef.current = text;

    useEffect(() => {
        const next: Record<string, boolean | null> = {};
        for (const s of slots) {
            const now = liveOf(s);
            next[s.id] = now;
            if (prev.current[s.id] === false && now === true) {
                const id = ++counter.current;
                setAlerts(a => [...a, { id, channel: s.channel }]);
                window.setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 9000);
                try {
                    if (browserNotify && 'Notification' in window && Notification.permission === 'granted') new Notification(textRef.current(s.channel));
                } catch { /* el navegador no deja notificar */ }
            }
        }
        prev.current = next;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, browserNotify]);

    return [alerts, (id: number) => setAlerts(a => a.filter(x => x.id !== id))] as const;
}
