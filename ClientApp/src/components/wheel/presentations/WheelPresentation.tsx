/**
 * La presentación clásica: el disco que gira y una aguja fija arriba.
 *
 * Todo esto vivía dentro de `WheelOverlay.tsx`. Se mudó acá sin cambiarle la
 * matemática: es la primera implementación del contrato y sirve de referencia
 * para las que vengan (tira horizontal, carrete, rejilla).
 */
import { useEffect, useRef, useState } from 'react';
import WheelFace from '../WheelFace';
import { EASINGS, SIDE_ANGLE, type NeedleShape } from '../visualConfig';
import type { Presentation, PresentationProps } from './types';

function CircularWheel({ segments, visual, spin, phase, onSound, onFinished }: PresentationProps) {
    const [rotation, setRotation] = useState(0);
    /** Dónde quedó el disco. Persiste entre giros: si se reiniciara a 0, la rueda
     *  pegaría un salto al empezar el siguiente. */
    const rotationRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    /**
     * Lo último que nos pasaron, para leerlo desde dentro de la animación sin
     * meterlo en las dependencias del efecto. Si `visual` y los callbacks
     * estuvieran en las deps, un cambio de configuración a mitad de giro
     * reiniciaría la animación desde cero en pleno directo.
     */
    const ultimo = useRef({ spin, visual, onSound, onFinished });
    ultimo.current = { spin, visual, onSound, onFinished };

    const nonce = spin?.nonce ?? 0;

    useEffect(() => {
        const { spin: ev, visual: v, onSound: sonar, onFinished: terminado } = ultimo.current;
        if (!ev) return;

        const count = ev.segmentCount;
        if (count <= 0) return;

        sonar('spin_start');

        const slice = 360 / count;
        const duracion = v.spinSeconds;
        const ease = EASINGS[v.easing];
        // Un poco fuera del centro exacto del gajo: caer siempre clavado en el
        // medio delata que el resultado venía dado.
        const jitter = (Math.random() - 0.5) * slice * 0.6;
        const from = rotationRef.current;
        // Una vuelta extra al azar para que dos giros seguidos no se vean calcados.
        const vueltas = v.turns + Math.floor(Math.random() * 2);
        // `SIDE_ANGLE` es lo que hace que mover la aguja no sea solo CSS: si el
        // puntero se va a la derecha, el disco tiene que parar 90 grados corrido o
        // la aguja senalaria el gajo de al lado. Con `top` vale 0 y esta linea es
        // exactamente la de siempre.
        const target = 360 * vueltas + (from - (from % 360))
            - (ev.segmentIndex + 0.5) * slice + jitter + SIDE_ANGLE[v.pointer.side];
        const total = target - from;

        const start = performance.now();
        let ticksSonados = Math.floor(from / slice);
        let frenoSonado = false;

        const frame = (now: number) => {
            const t = Math.min(1, (now - start) / (duracion * 1000));
            const angle = from + total * ease(t);

            rotationRef.current = angle;
            setRotation(angle);

            // Un tick por cada borde de gajo que cruza el puntero. Al frenar se
            // espacian solos, porque el ángulo avanza cada vez menos por frame.
            const cruzados = Math.floor(angle / slice);
            if (cruzados > ticksSonados) {
                ticksSonados = cruzados;
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

    // Se resalta por índice y no por id de gajo: el índice es lo único que el
    // sorteo y los premios comparten. En modo Sorteo los gajos se fabrican al
    // vuelo desde el evento y sus ids no son los de ninguna tabla.
    const ganador = phase === 'revealed' && spin ? segments[spin.segmentIndex]?.id ?? null : null;

    return (
        <div className="wheel-presentation">
            <style>{CSS}</style>
            <WheelFace segments={segments} visual={visual} rotation={rotation} highlightId={ganador} />
            {/* La aguja. Va en porcentajes y no en pixeles para que se encoja igual
                que la rueda en el preview del panel. El lado no es decorativo: el
                disco para corrido esos mismos grados (ver `SIDE_ANGLE` arriba). */}
            {!visual.pointer.hidden && (
                <div
                    className="wheel-needle"
                    data-side={visual.pointer.side}
                    style={{
                        background: visual.pointer.color ?? visual.accent,
                        clipPath: NEEDLE_CLIP[visual.pointer.shape],
                        // El tamano multiplica el de fabrica en los dos ejes, asi
                        // que una aguja mas grande sigue siendo la misma aguja.
                        width: `${5.8 * visual.pointer.size}%`,
                        height: `${8.9 * visual.pointer.size}%`,
                        borderRadius: visual.pointer.shape === 'bar' ? '999px' : undefined,
                    }}
                />
            )}
        </div>
    );
}

const CSS = `
.wheel-presentation { position: relative; width: 100%; height: 100%; }
/* El tamano del dibujo lo resuelve WheelFace, que se ajusta a su contenedor.
   Esta regla estaba aqui, sin acotar, y era de quien dependian las miniaturas de
   las plantillas del panel: con otra presentacion no se montaba y salian a 520px. */

.slice { transition: opacity 520ms ease; }
.slice.is-dimmed { opacity: .28; }

.wheel-needle {
    position: absolute;
    filter: drop-shadow(0 3px 5px rgba(0,0,0,.6));
}
/* La punta mira SIEMPRE al centro del disco. Rotar la caja entera y no dibujar
   cuatro recortes distintos es lo que deja que la forma y el lado se elijan por
   separado: cuatro formas por cuatro lados serian dieciseis recortes. */
.wheel-needle[data-side="top"]    { top: -2.3%; left: 50%; transform: translateX(-50%); }
.wheel-needle[data-side="bottom"] { bottom: -2.3%; left: 50%; transform: translateX(-50%) rotate(180deg); }
.wheel-needle[data-side="left"]   { left: -2.3%; top: 50%; transform: translateY(-50%) rotate(-90deg); }
.wheel-needle[data-side="right"]  { right: -2.3%; top: 50%; transform: translateY(-50%) rotate(90deg); }
`;

/**
 * Las cuatro formas de aguja, todas apuntando hacia abajo (hacia el centro del
 * disco cuando esta arriba). El lado lo resuelve la rotacion del CSS.
 */
const NEEDLE_CLIP: Record<NeedleShape, string | undefined> = {
    triangle: 'polygon(50% 100%, 0 0, 100% 0)',
    arrow: 'polygon(50% 100%, 0 42%, 30% 42%, 30% 0, 70% 0, 70% 42%, 100% 42%)',
    drop: 'polygon(50% 100%, 18% 52%, 18% 22%, 50% 0, 82% 22%, 82% 52%)',
    // Una barra: sin recorte, y el borde redondeado lo pone el estilo en linea.
    bar: undefined,
};

export const wheelPresentation: Presentation = {
    key: 'wheel',
    aspect: 1,
    motion: { spinSeconds: true, turns: true, easing: true },
    parts: { centerImage: true },
    pointer: 'needle',
    sounds: ['spin_start', 'spin_tick', 'spin_slowdown'],
    Component: CircularWheel,
};
