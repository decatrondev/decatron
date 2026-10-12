import { useEffect, useMemo, useState } from 'react';
import type { Slot } from './types';

// Modo lurk: el player embebido de /multi NO suma puntos de canal ni rachas para Twitch (verificado con cuenta real). Lo que sí
// cuenta es una pestaña normal de twitch.tv, aunque esté silenciada y en segundo plano. La extensión de Decatron abre esas pestañas
// (silenciadas, en calidad mínima, en una ventana aparte) por los canales de Twitch de esta página, según lo que elija quien mira:
//   streak → la pestaña se abre una vez por directo y se cierra cuando la racha sube (la extensión la lee del menú de puntos)
//            o a los 30 minutos si no la ve subir
//   full   → la pestaña queda abierta mientras el canal esté en vivo y en /multi (puntos, cofres y racha)
// La página y la extensión hablan con eventos del DOM con texto JSON (viven en mundos de JavaScript separados).

export type LurkMode = 'streak' | 'full';
export type LurkChannelMode = 'default' | 'off' | LurkMode;
/** off: el canal no tiene lurk · offline: no está en vivo · queued: espera turno · open: pestaña abierta · done: la racha subió en este
 *  directo · timeout: se cerró por tiempo sin ver subir la racha · closed: la persona cerró la pestaña */
export type LurkStatus = 'off' | 'offline' | 'queued' | 'open' | 'done' | 'timeout' | 'closed';
/** Lo que ve la pestaña de Twitch: arrancando (la ventana se muestra hasta que arranca el video), el video avanza, Twitch lo dejó
 *  pausado, no arrancó a tiempo o no hay sesión de Twitch en el navegador */
export type LurkHealth = 'starting' | 'playing' | 'paused' | 'stalled' | 'nosession' | null;

export interface LurkChannel {
    mode: LurkChannelMode;
    effective: 'off' | LurkMode;
    status: LurkStatus;
    openedAt?: number;
    streak?: { have: number; need: number } | null;
    health?: LurkHealth;
}

/** Una línea del historial. `code` se traduce con lurk.log.<code>; `p` son sus datos (minutos, racha, motivo…). */
export interface LurkLogEntry { at: number; login: string; code: string; p: Record<string, string | number | boolean | null | { have: number; need: number }> }

export interface LurkState {
    enabled: boolean;
    mode: LurkMode;
    channels: Record<string, LurkChannel>;
    log?: LurkLogEntry[];
    maxMinutes?: number;
}

const extVersion = () => document.documentElement.dataset.decatronExt || null;
const extHasLurk = () => document.documentElement.dataset.decatronLurk === '1';

export function clearLurkLog() {
    window.dispatchEvent(new CustomEvent('decatron-lurk-clear-log'));
}

export function sendLurk(patch: { enabled?: boolean; mode?: LurkMode; login?: string; channelMode?: LurkChannelMode }) {
    window.dispatchEvent(new CustomEvent('decatron-lurk-set', { detail: JSON.stringify(patch) }));
}

/** Estado del modo lurk que informa la extensión; `ext` es la versión instalada (null sin extensión) y `supported` si ya trae el modo lurk. */
export function useLurk(slots: Slot[]) {
    const [ext, setExt] = useState<string | null>(extVersion);
    const [supported, setSupported] = useState(extHasLurk);
    const [state, setState] = useState<LurkState | null>(null);
    const channels = useMemo(() => slots.filter(s => s.platform === 'twitch').map(s => s.channel), [slots]);
    const list = channels.join(',');

    // La extensión marca la página al cargar (su script corre después que React a veces): se mira un rato
    useEffect(() => {
        let n = 0;
        const id = window.setInterval(() => {
            setExt(extVersion()); setSupported(extHasLurk());
            if (++n >= 10 || extVersion()) window.clearInterval(id);
        }, 500);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        const on = (e: Event) => { try { setState(JSON.parse(String((e as CustomEvent).detail)) as LurkState); } catch { /* mal formado */ } };
        window.addEventListener('decatron-lurk-state', on);
        return () => window.removeEventListener('decatron-lurk-state', on);
    }, []);

    // Los canales de Twitch abiertos; la extensión los repite cada pocos segundos a su service worker
    useEffect(() => {
        if (!supported) return;
        window.dispatchEvent(new CustomEvent('decatron-lurk-sync', { detail: JSON.stringify({ channels: list ? list.split(',') : [] }) }));
    }, [list, supported]);

    return { ext, supported, state };
}
