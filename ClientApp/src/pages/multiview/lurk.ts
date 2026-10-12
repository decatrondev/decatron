import { useEffect, useMemo, useState } from 'react';
import type { Slot } from './types';

// Modo lurk: el player embebido de /multi NO suma puntos de canal ni rachas para Twitch (verificado con cuenta real). Lo que sí
// cuenta es una pestaña normal de twitch.tv, aunque esté silenciada y en segundo plano. La extensión de Decatron abre esas pestañas
// (silenciadas, en calidad mínima, en una ventana aparte) por los canales de Twitch de esta página, según lo que elija quien mira:
//   streak → la pestaña se abre una vez por directo unos minutos (para la racha) y se cierra sola
//   full   → la pestaña queda abierta mientras el canal esté en vivo y en /multi (puntos, cofres y racha)
// La página y la extensión hablan con eventos del DOM con texto JSON (viven en mundos de JavaScript separados).

export type LurkMode = 'streak' | 'full';
export type LurkChannelMode = 'default' | 'off' | LurkMode;
/** off: el canal no tiene lurk · offline: no está en vivo · queued: espera turno · open: pestaña abierta · done: racha cubierta en este directo · closed: la persona cerró la pestaña */
export type LurkStatus = 'off' | 'offline' | 'queued' | 'open' | 'done' | 'closed';

export interface LurkState {
    enabled: boolean;
    mode: LurkMode;
    channels: Record<string, { mode: LurkChannelMode; effective: 'off' | LurkMode; status: LurkStatus; openedAt?: number }>;
}

const extVersion = () => document.documentElement.dataset.decatronExt || null;
const extHasLurk = () => document.documentElement.dataset.decatronLurk === '1';

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
