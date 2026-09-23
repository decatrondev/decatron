/**
 * La carta: sin sorteo visible. Aparece boca abajo, tiembla un momento y se da
 * vuelta.
 *
 * No es una estética, es el **modo rápido**. Si el disparador son los bits, pueden
 * llegar cinco aportes en veinte segundos y las otras presentaciones los encolan a
 * cinco segundos cada uno: al quinto espectador la rueda va tres giros atrasada.
 * Esta se resuelve en segundo y medio.
 *
 * Es la primera presentación que **no** usa todos los ajustes de movimiento: no
 * hay vueltas que dar ni curva de frenada que elegir, así que el panel esconde
 * esos dos controles y deja solo la duración. No tiene frenada, pero sí tick: el
 * temblor va con un redoble que se acelera hasta que la carta se da vuelta. Sin él,
 * el suspenso era un segundo de silencio entre el arranque y el revelado.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FONTS } from '../visualConfig';
import type { Presentation, PresentationProps } from './types';

/** Qué parte de la duración se va en el temblor, antes de dar vuelta la carta. */
const SUSPENSO = 0.55;

/** Separacion entre golpes del redoble al empezar y al llegar al volteo, en ms. */
const REDOBLE_LENTO = 210;
const REDOBLE_RAPIDO = 60;

function Card({ segments, visual, spin, phase, onSound, onFinished }: PresentationProps) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [lado, setLado] = useState(0);
    const [volteada, setVolteada] = useState(false);
    const [temblando, setTemblando] = useState(false);

    // Medido, no en unidades de contenedor, por lo mismo que la tira: OBS 29 trae
    // un Chromium sin container queries y ahi `cqmin` no cae en un tamano parecido
    // sino en el del viewport, que es enorme. Fallaria solo en el directo.
    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const medir = () => setLado(Math.min(el.clientWidth, el.clientHeight));
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const ultimo = useRef({ spin, visual, segments, onSound, onFinished });
    ultimo.current = { spin, visual, segments, onSound, onFinished };

    const nonce = spin?.nonce ?? 0;

    useEffect(() => {
        if (!spin) { setVolteada(false); setTemblando(false); }
    }, [spin]);

    useEffect(() => {
        const { spin: ev, visual: v, onSound: sonar, onFinished: terminado } = ultimo.current;
        if (!ev) return;

        sonar('spin_start');
        setVolteada(false);
        setTemblando(true);

        const total = v.spinSeconds * 1000;
        const suspenso = total * SUSPENSO;
        const giro = window.setTimeout(() => { setTemblando(false); setVolteada(true); }, suspenso);

        // El redoble: golpes cada vez mas juntos, de REDOBLE_LENTO a REDOBLE_RAPIDO,
        // hasta el momento del volteo. Se programa entero de antemano porque cada
        // golpe depende solo del tiempo, no de nada que pase en pantalla.
        const golpes: number[] = [];
        for (let en = 90; en < suspenso - 40;) {
            golpes.push(window.setTimeout(() => sonar('spin_tick'), en));
            const avance = en / suspenso;
            en += REDOBLE_LENTO + (REDOBLE_RAPIDO - REDOBLE_LENTO) * avance;
        }
        // El aviso llega cuando la carta terminó de girar, no cuando empezó: la
        // tarjeta del ganador del overlay no puede adelantarse a la revelación.
        const fin = window.setTimeout(terminado, total);

        return () => { window.clearTimeout(giro); window.clearTimeout(fin); golpes.forEach(window.clearTimeout); };
    }, [nonce]);

    if (segments.length === 0) return null;

    const idx = spin ? Math.min(Math.max(spin.segmentIndex, 0), segments.length - 1) : 0;
    const seg = segments[idx];
    const color = seg?.color || visual.palette[idx % visual.palette.length];
    const etiqueta = visual.textUppercase ? (seg?.label ?? '').toUpperCase() : (seg?.label ?? '');
    const texto = seg?.icon ? `${seg.icon} ${etiqueta}` : etiqueta;

    const clases = ['card-inner'];
    if (volteada) clases.push('is-flipped');
    if (temblando) clases.push('is-shaking');

    const tipografia = {
        fontFamily: FONTS[visual.font].stack,
        fontWeight: visual.fontWeight,
        fontSize: Math.max(9, lado * (texto.length > 18 ? 0.10 : texto.length > 10 ? 0.125 : 0.16) * visual.textScale),
        color: visual.textColor ?? visual.ink,
        ...(visual.textOutline > 0 ? {
            WebkitTextStrokeWidth: `${visual.textOutline}px`,
            WebkitTextStrokeColor: visual.textOutlineColor ?? visual.bone,
            paintOrder: 'stroke fill',
        } : {}),
    } as const;

    return (
        <div ref={rootRef} className="card-root">
            <style>{CSS}</style>
            <div className={clases.join(' ')}>
                {/* El dorso. Lleva la imagen del cubo si el streamer puso una: es el
                    único lugar de esta presentación donde una marca tiene sentido. */}
                <div className="card-face card-back" style={{ background: visual.ink, borderColor: visual.accent }}>
                    {visual.centerImage
                        ? <img src={visual.centerImage} alt="" className="card-art" />
                        : <span className="card-mark" style={{ color: visual.accent, fontSize: lado * 0.46 }}>?</span>}
                </div>

                <div className="card-face card-front" style={{ background: color, borderColor: visual.ink }}>
                    <span className="card-label" style={tipografia}>{texto}</span>
                </div>
            </div>
        </div>
    );
}

const CSS = `
.card-root {
    position: relative; width: 100%; height: 100%;
    perspective: 1200px;
}

.card-inner {
    position: absolute; inset: 0;
    transform-style: preserve-3d;
    transition: transform 420ms cubic-bezier(.34,1.2,.4,1);
}
.card-inner.is-flipped { transform: rotateY(180deg); }
.card-inner.is-shaking { animation: card-shake 340ms ease-in-out infinite; }

@keyframes card-shake {
    0%, 100% { transform: rotate(-1.6deg) translateY(0); }
    50%      { transform: rotate(1.6deg) translateY(-2.5%); }
}

.card-face {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    box-sizing: border-box;
    padding: 8%;
    border: 4px solid;
    border-radius: 7%;
    box-shadow: 0 10px 30px rgba(0,0,0,.6);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    overflow: hidden;
}
.card-front { transform: rotateY(180deg); }

.card-art { max-width: 76%; max-height: 76%; object-fit: contain; }
.card-mark { font-weight: 900; line-height: 1; }

.card-label {
    text-align: center;
    line-height: 1.1;
    letter-spacing: -0.01em;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4;
    overflow: hidden;
    word-break: break-word;
}
`;

export const cardPresentation: Presentation = {
    key: 'card',
    /** Proporción de una carta de baraja. */
    aspect: 0.7,
    motion: { spinSeconds: true, turns: false, easing: false },
    parts: { centerImage: true },
    // La carta se da vuelta y ya: no hay sorteo a la vista que senalar.
    pointer: 'none',
    sounds: ['spin_start', 'spin_tick'],
    Component: Card,
};
