/**
 * La bola de casino: el disco se queda quieto y lo que gira es la bola.
 *
 * Reusa `WheelFace` entera — es el mismo dibujo de la rueda, con la rotación en
 * cero — así que de las cuatro presentaciones es la más barata y la que menos
 * aporta: es la rueda con otra estética, no otra respuesta a otro problema. Está
 * porque con el disco quieto las etiquetas no se mueven y se leen mejor mientras
 * dura el suspenso.
 */
import { useEffect, useRef, useState } from 'react';
import WheelFace from '../WheelFace';
import { EASINGS } from '../visualConfig';
import type { Presentation, PresentationProps } from './types';

/** Radios en porcentaje del lienzo. El disco de `WheelFace` llega al 45.4%. */
const PISTA = 47.5;
const CASILLA = 35;
const BOLA = 4.6;

function Ball({ segments, visual, spin, phase, onSound, onFinished }: PresentationProps) {
    const [angulo, setAngulo] = useState(-90);
    const [radio, setRadio] = useState(PISTA);
    const anguloRef = useRef(-90);
    const rafRef = useRef<number | null>(null);

    const ultimo = useRef({ spin, visual, segments, onSound, onFinished });
    ultimo.current = { spin, visual, segments, onSound, onFinished };

    const nonce = spin?.nonce ?? 0;

    useEffect(() => {
        const { spin: ev, visual: v, onSound: sonar, onFinished: terminado } = ultimo.current;
        if (!ev) return;

        const count = ev.segmentCount;
        if (count <= 0) return;

        sonar('spin_start');

        const slice = 360 / count;
        // El mismo convenio de ángulos que `WheelFace`: el gajo 0 arranca arriba.
        const destinoBase = (ev.segmentIndex + 0.5) * slice - 90;
        const jitter = (Math.random() - 0.5) * slice * 0.5;

        const desde = anguloRef.current;
        const vueltas = v.turns + Math.floor(Math.random() * 2);
        // Se avanza siempre hacia adelante, nunca por el camino corto: una bola que
        // retrocede para acomodarse delata que el resultado venía dado.
        const delta = ((destinoBase + jitter - desde) % 360 + 360) % 360;
        const total = 360 * vueltas + delta;

        const duracion = v.spinSeconds;
        const ease = EASINGS[v.easing];
        const inicio = performance.now();
        let cruzados = Math.floor(desde / slice);
        let frenoSonado = false;

        const frame = (ahora: number) => {
            const t = Math.min(1, (ahora - inicio) / (duracion * 1000));
            const a = desde + total * ease(t);

            anguloRef.current = a;
            setAngulo(a);

            // La bola cae de la pista a la casilla sobre el último tercio, que es
            // cuando ya perdió la velocidad que la mantenía pegada al borde.
            const caida = t < 0.62 ? 0 : (t - 0.62) / 0.38;
            setRadio(PISTA - (PISTA - CASILLA) * caida * caida);

            const pasados = Math.floor(a / slice);
            if (pasados > cruzados) {
                cruzados = pasados;
                sonar('spin_tick');
            }

            if (!frenoSonado && t > 0.72) {
                frenoSonado = true;
                sonar('spin_slowdown');
            }

            if (t < 1) {
                rafRef.current = requestAnimationFrame(frame);
                return;
            }
            terminado();
        };

        rafRef.current = requestAnimationFrame(frame);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [nonce]);

    if (segments.length === 0) return null;

    const ganador = phase === 'revealed' && spin ? segments[spin.segmentIndex]?.id ?? null : null;
    const rad = angulo * Math.PI / 180;

    return (
        <div className="ball-root">
            <style>{CSS}</style>
            <WheelFace segments={segments} visual={visual} rotation={0} highlightId={ganador} />
            <div
                className="ball-piece"
                style={{
                    left: `${50 + radio * Math.cos(rad)}%`,
                    top: `${50 + radio * Math.sin(rad)}%`,
                    background: visual.bone,
                    borderColor: visual.accent,
                }}
            />
        </div>
    );
}

const CSS = `
.ball-root { position: relative; width: 100%; height: 100%; }

.ball-root .slice { transition: opacity 520ms ease; }
.ball-root .slice.is-dimmed { opacity: .28; }

.ball-piece {
    position: absolute;
    width: ${BOLA}%; aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 2px solid;
    box-shadow: 0 2px 6px rgba(0,0,0,.7), inset -2px -2px 4px rgba(0,0,0,.35);
}
`;

export const ballPresentation: Presentation = {
    key: 'ball',
    aspect: 1,
    motion: { spinSeconds: true, turns: true, easing: true },
    parts: { centerImage: true },
    // La bola ES la marca: una aguja ademas seria decir dos veces lo mismo.
    pointer: 'none',
    sounds: ['spin_start', 'spin_tick', 'spin_slowdown'],
    Component: Ball,
};
