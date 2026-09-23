/**
 * La rejilla: todos los premios a la vista y un marco que salta entre ellos.
 *
 * Es la respuesta al caso que ni la rueda ni la tira resuelven: **muchos gajos**.
 * Con 24 premios la rueda es ilegible y la tira los muestra de a cinco; acá están
 * los 24 en pantalla todo el tiempo, quietos, y lo único que se mueve es el marco.
 * Es además la única de las tres que se lee bien en un formato vertical.
 *
 * El recorrido es en orden de lectura y no al azar. Que se pueda anticipar dónde
 * va a caer los últimos saltos no es un defecto: es la tensión de este formato,
 * igual que en un tablero de premios de la tele.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EASINGS, FONTS, type WheelVisual } from '../visualConfig';
import type { FaceSegment } from '../WheelFace';
import type { Presentation, PresentationProps } from './types';

/** Proporción de celda que mejor le sienta a una etiqueta corta. */
const CELDA_IDEAL = 1.7;

/** Tope de saltos. Con 48 gajos y 4 vueltas serían 192 ticks en cinco segundos. */
const MAX_SALTOS = 120;

const ASPECTO = 1.6;

/**
 * Cuántas columnas. Se prueban todas y gana la que deja las celdas más cerca de la
 * proporción ideal, con una multa por cada hueco que quede en la última fila: se
 * tolera un hueco si la forma mejora bastante, pero no cuatro.
 */
function columnasPara(n: number): number {
    let mejor = 1;
    let mejorPuntaje = Infinity;
    for (let cols = 1; cols <= n; cols++) {
        const filas = Math.ceil(n / cols);
        const proporcion = ASPECTO * filas / cols;
        const huecos = cols * filas - n;
        const puntaje = Math.abs(proporcion - CELDA_IDEAL) + huecos * 0.18;
        if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; mejor = cols; }
    }
    return mejor;
}

function Grid({ segments, visual, spin, phase, onSound, onFinished }: PresentationProps) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [ancho, setAncho] = useState(0);
    /** Dónde está el marco ahora, o null en reposo. */
    const [activo, setActivo] = useState<number | null>(null);
    const rafRef = useRef<number | null>(null);
    /** Dónde quedó el marco la vez pasada: el siguiente salto arranca de ahí. */
    const desdeRef = useRef(0);

    const ultimo = useRef({ spin, visual, segments, onSound, onFinished });
    ultimo.current = { spin, visual, segments, onSound, onFinished };

    const nonce = spin?.nonce ?? 0;

    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const medir = () => setAncho(el.clientWidth);
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!spin) setActivo(null);
    }, [spin]);

    useEffect(() => {
        const { spin: ev, visual: v, segments: segs, onSound: sonar, onFinished: terminado } = ultimo.current;
        if (!ev || segs.length === 0) return;

        const n = segs.length;
        const ganador = Math.min(Math.max(ev.segmentIndex, 0), n - 1);
        const desde = desdeRef.current % n;

        sonar('spin_start');

        // Los saltos que faltan para caer en el ganador, más las vueltas completas
        // que pida el streamer. "Vueltas" acá son recorridos enteros de la rejilla.
        const resto = ((ganador - desde) % n + n) % n;
        let vueltas = Math.max(1, v.turns);
        while (vueltas > 1 && vueltas * n + resto > MAX_SALTOS) vueltas--;
        const saltos = vueltas * n + resto;

        const duracion = v.spinSeconds;
        const ease = EASINGS[v.easing];
        const inicio = performance.now();
        let ultimoSalto = -1;

        const frame = (ahora: number) => {
            const t = Math.min(1, (ahora - inicio) / (duracion * 1000));
            const salto = Math.min(saltos, Math.floor(saltos * ease(t)));

            if (salto !== ultimoSalto) {
                ultimoSalto = salto;
                setActivo((desde + salto) % n);
                // El tick es el salto. Se espacian solos al frenar, porque la curva
                // avanza cada vez menos por frame — igual que los bordes de gajo.
                if (salto > 0) sonar('spin_tick');
            }

            if (t < 1) {
                rafRef.current = requestAnimationFrame(frame);
                return;
            }
            desdeRef.current = ganador;
            setActivo(ganador);
            terminado();
        };

        rafRef.current = requestAnimationFrame(frame);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [nonce]);

    if (segments.length === 0) return null;

    const n = segments.length;
    const cols = columnasPara(n);
    const filas = Math.ceil(n / cols);
    const enUltima = n - (filas - 1) * cols;
    // La última fila se centra en vez de quedar pegada a la izquierda: una fila
    // corta alineada a un lado se lee como un error de maquetación.
    const arranqueUltima = 1 + Math.floor((cols - enUltima) / 2);

    const anchoCelda = ancho > 0 ? ancho / cols : 0;
    const apagadas = phase === 'revealed' && activo != null;

    return (
        <div
            ref={rootRef}
            className="grid-root"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${filas}, 1fr)` }}
        >
            <style>{CSS}</style>

            {segments.map((seg, i) => (
                <Celda
                    key={seg.id}
                    seg={seg}
                    visual={visual}
                    color={seg.color || visual.palette[i % visual.palette.length]}
                    anchoPx={anchoCelda}
                    activa={activo === i}
                    dimmed={apagadas && activo !== i}
                    columna={i === n - enUltima ? arranqueUltima : undefined}
                />
            ))}
        </div>
    );
}

function Celda({ seg, visual, color, anchoPx, activa, dimmed, columna }: {
    seg: FaceSegment;
    visual: WheelVisual;
    color: string;
    anchoPx: number;
    activa: boolean;
    dimmed: boolean;
    /** Solo en la primera celda de la última fila, para centrarla. */
    columna?: number;
}) {
    const etiqueta = visual.textUppercase ? seg.label.toUpperCase() : seg.label;
    const texto = seg.icon ? `${seg.icon} ${etiqueta}` : etiqueta;

    const porLargo = texto.length > 16 ? 0.105 : texto.length > 10 ? 0.135 : 0.175;
    const fontSize = Math.max(7, anchoPx * porLargo * visual.textScale);

    const clases = ['grid-cell'];
    if (activa) clases.push('is-active');
    if (dimmed) clases.push('is-dimmed');

    return (
        <div
            className={clases.join(' ')}
            style={{
                background: color,
                borderColor: visual.ink,
                gridColumnStart: columna,
                // El marco de la rejilla es su visor. El grosor y el color salen del
                // puntero, igual que en la tira; `hidden` lo apaga entero.
                ...(activa && !visual.pointer.hidden
                    ? (() => {
                        const c = visual.pointer.color ?? visual.accent;
                        const g = visual.pointer.thickness;
                        return { boxShadow: `inset 0 0 0 ${g}px ${c}, 0 0 ${Math.round(g * 5.3)}px ${c}66` };
                    })()
                    : {}),
            }}
        >
            <span
                className="grid-label"
                style={{
                    fontFamily: FONTS[visual.font].stack,
                    fontWeight: visual.fontWeight,
                    fontSize,
                    color: visual.textColor ?? visual.ink,
                    ...(visual.textOutline > 0 ? {
                        WebkitTextStrokeWidth: `${visual.textOutline}px`,
                        WebkitTextStrokeColor: visual.textOutlineColor ?? visual.bone,
                        paintOrder: 'stroke fill',
                    } : {}),
                }}
            >
                {texto}
            </span>
        </div>
    );
}

const CSS = `
.grid-root {
    display: grid;
    width: 100%; height: 100%;
    gap: 2%;
}

.grid-cell {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    box-sizing: border-box;
    padding: 6% 5%;
    border: 2px solid;
    border-radius: 9px;
    overflow: hidden;
    /* El salto es instantáneo a propósito: una transición sobre el marco lo
       dejaría arrastrándose detrás del recorrido cuando va rápido. Lo que sí se
       anima es el apagado del final, que es lento. */
    transition: opacity 520ms ease, transform 120ms ease;
}
.grid-cell.is-active { transform: scale(1.05); z-index: 1; }
.grid-cell.is-dimmed { opacity: .26; transform: none; }

.grid-label {
    text-align: center;
    line-height: 1.1;
    letter-spacing: -0.01em;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
    overflow: hidden;
    word-break: break-word;
}
`;

export const gridPresentation: Presentation = {
    key: 'grid',
    aspect: ASPECTO,
    // Las tres siguen aplicando: la duración es la del recorrido, "vueltas" son
    // recorridos enteros de la rejilla y la curva es cómo desacelera el marco.
    motion: { spinSeconds: true, turns: true, easing: true },
    parts: { centerImage: false },
    pointer: 'viewer',
    sounds: ['spin_start', 'spin_tick', 'spin_slowdown'],
    Component: Grid,
};
