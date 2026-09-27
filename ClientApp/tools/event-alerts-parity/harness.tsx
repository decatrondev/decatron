// Página del banco de paridad: dibuja una alerta con el overlay viejo (EventAlertsOverlay tal cual, con SignalR
// simulado) o con el renderer nuevo. La maneja run.mjs con window.__parityRender y window.__parityFreeze.

import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import EventAlertsOverlay from '../../src/pages/EventAlertsOverlay';
import EventAlertsOverlayLegacy from './legacy/EventAlertsOverlayLegacy';
import EventAlertRenderer, { type Phase } from '../../src/components/event-alert-overlay/EventAlertRenderer';
import { normalizeEventAlertsDesign, resolveAlertDesign } from '../../src/components/event-alert-overlay/convertLegacy';

type Mode = 'old' | 'new' | 'new-config';

interface RenderArgs {
    mode: Mode;
    phase: Phase;
    config: any;
    payload: any;
    /** El `style` del evento, nivel o variante tal como está en la config (para new-config). */
    partialStyle?: any;
    background: string;
}

// Los temporizadores largos del overlay viejo (la duración de la alerta y los 600 ms antes de sacarla) se
// congelan: así la alerta queda en pantalla, en la entrada o en la salida, el tiempo que haga falta.
const realSetTimeout = window.setTimeout.bind(window);
let holdTimers = false;
(window as any).setTimeout = (fn: TimerHandler, ms?: number, ...args: any[]) =>
    holdTimers && (ms ?? 0) >= 600 ? 0 : realSetTimeout(fn, ms, ...args);

const sleep = (ms: number) => new Promise(r => realSetTimeout(r, ms));
const root = createRoot(document.getElementById('root')!);
let renderCount = 0;

async function settle() {
    await sleep(80);
    await Promise.all(Array.from(document.images).map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
    await document.fonts.ready;
    await sleep(30);
}

(window as any).__parityRender = async ({ mode, phase, config, payload, partialStyle, background }: RenderArgs) => {
    document.body.style.background = background;
    holdTimers = false;
    root.render(null);
    await sleep(20);
    (window as any).__parityResetHub();
    const key = ++renderCount;

    if (mode === 'old' || mode === 'new') {
        // old: el overlay de OBS anterior al rediseño; new: el overlay de OBS actual (cola incluida). Los dos reciben
        // la misma alerta por el SignalR simulado
        const Overlay = mode === 'old' ? EventAlertsOverlayLegacy : EventAlertsOverlay;
        root.render(
            <MemoryRouter key={key} initialEntries={['/overlay/event-alerts?channel=paridad']}>
                <Overlay />
            </MemoryRouter>,
        );
        await sleep(50);
        holdTimers = true;
        // Duración 0: pasa directo a la salida; larga: se queda en la entrada
        (window as any).__parityEmit('ShowEventAlert', { ...payload, duration: phase === 'exit' ? 0 : 3_600_000 });
    } else {
        // new-config: el renderer solo, con el diseño convertido de la config y el `style` parcial de la config
        const design = normalizeEventAlertsDesign(config);
        const resolved = resolveAlertDesign(design, payload, partialStyle);
        root.render(
            <div key={key} style={{ position: 'absolute', left: 0, top: 0 }}>
                <EventAlertRenderer design={resolved} data={payload} phase={phase} fixed />
            </div>,
        );
    }
    await settle();
};

/** Pausa todas las animaciones en el mismo instante (ms desde que empezaron). */
(window as any).__parityFreeze = (t: number) => {
    for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = t;
    }
};

/** La entrada terminada de verdad, dejándola correr (una animación en pausa o terminada a mano deja la capa aparte y
 * cambia el suavizado del texto). Los efectos, que no terminan nunca, se pausan en ese instante. */
(window as any).__parityRest = async (t: number) => {
    await sleep(t + 250);
    for (const a of document.getAnimations()) {
        if (a.effect?.getComputedTiming().iterations === Infinity) {
            a.pause();
            a.currentTime = t;
        }
    }
    await sleep(50);
};
