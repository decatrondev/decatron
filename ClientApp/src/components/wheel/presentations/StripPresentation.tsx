/**
 * La tira y el carrete: los premios desfilan y frenan bajo una marca fija.
 *
 * Son **la misma presentación con el eje cambiado**, no dos. La tira horizontal
 * resuelve las etiquetas largas (en la rueda salen tumbadas y encogidas; acá van
 * derechas y enteras) y ocupa una banda ancha y baja que estorba menos en la
 * escena. El carrete vertical resuelve el espacio: cabe en una columna al costado.
 *
 * Dos reglas que no son de estilo:
 *
 * 1. **La lista va barajada, no ponderada.** Se llena con índices al azar
 *    uniformes y solo la celda de aterrizaje es el ganador. Si se llenara según
 *    el peso de cada premio, cualquiera contaría apariciones y leería la tabla de
 *    probabilidades del cable. Es la misma decisión por la que la rueda dibuja
 *    todos los gajos del mismo tamaño.
 * 2. **El servidor ya eligió.** Acá solo se calcula a qué desplazamiento hay que
 *    llegar para que esa celda quede bajo la marca.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { EASINGS, FONTS, type WheelVisual } from '../visualConfig';
import type { FaceSegment } from '../WheelFace';
import type { Presentation, PresentationProps } from './types';

type Axis = 'x' | 'y';

/** Cuántas celdas se ven a la vez. La tira muestra más porque es ancha. */
const VISIBLES: Record<Axis, number> = { x: 5, y: 3 };

/**
 * Tope de celdas en el DOM. Con un pool de 48 gajos y 4 vueltas saldrían más de
 * doscientas; el recorrido se acorta antes que llenar la escena de nodos, porque
 * lo que se percibe es la velocidad, no cuántas pasaron.
 */
const MAX_CELDAS = 140;

interface Medidas { w: number; h: number; }

function crearStrip(axis: Axis) {
    const visibles = VISIBLES[axis];
    /** Tamaño de una celda, en porcentaje del lado largo del contenedor. */
    const celda = 100 / visibles;

    function Strip({ segments, visual, spin, phase, onSound, onFinished }: PresentationProps) {
        const rootRef = useRef<HTMLDivElement | null>(null);
        const [medidas, setMedidas] = useState<Medidas>({ w: 0, h: 0 });

        /** Índices del pool, uno por celda. */
        const [lista, setLista] = useState<number[]>(() => enReposo(segments.length, visibles));
        /** Desplazamiento en unidades del contenedor (0 = la lista sin correr). */
        const [offset, setOffset] = useState(0);
        /** Qué celda quedó bajo la marca. */
        const [ganadora, setGanadora] = useState<number | null>(null);

        const rafRef = useRef<number | null>(null);

        // Igual que en la rueda: lo último que nos pasaron se lee de un ref para
        // que un cambio de configuración a mitad de giro no reinicie la animación.
        const ultimo = useRef({ spin, visual, segments, onSound, onFinished });
        ultimo.current = { spin, visual, segments, onSound, onFinished };

        const nonce = spin?.nonce ?? 0;

        // El tamaño se mide, no se pide en unidades de contenedor (`cqw`/`cqh`):
        // OBS 29 todavía trae un Chromium anterior a las container queries y el
        // texto se quedaría sin tamaño, en silencio, solo en el directo.
        useLayoutEffect(() => {
            const el = rootRef.current;
            if (!el) return;
            const medir = () => setMedidas({ w: el.clientWidth, h: el.clientHeight });
            medir();
            const ro = new ResizeObserver(medir);
            ro.observe(el);
            return () => ro.disconnect();
        }, []);

        // En reposo se muestra el pool barajado, lo justo para llenar el hueco.
        useEffect(() => {
            if (spin) return;
            setLista(enReposo(segments.length, visibles));
            setOffset(0);
            setGanadora(null);
        }, [spin, segments.length]);

        useEffect(() => {
            const { spin: ev, visual: v, segments: segs, onSound: sonar, onFinished: terminado } = ultimo.current;
            if (!ev || segs.length === 0) return;

            sonar('spin_start');

            const pool = segs.length;
            const ganador = Math.min(Math.max(ev.segmentIndex, 0), pool - 1);

            // "Vueltas" acá significa cuántas veces desfila el pool entero. Es la
            // traducción honesta del mismo ajuste: en la rueda son vueltas del
            // disco, y en la tira son pasadas de la lista.
            const pasos = Math.max(
                visibles * 2,
                Math.min(MAX_CELDAS - visibles * 2, Math.round(v.turns * pool)),
            );

            const aterriza = Math.floor(visibles / 2) + pasos;
            const largo = aterriza + visibles;

            const nueva: number[] = [];
            for (let i = 0; i < largo; i++) nueva.push(Math.floor(Math.random() * pool));
            nueva[aterriza] = ganador;
            setLista(nueva);
            setGanadora(null);

            // Un poco fuera del centro exacto de la celda, por lo mismo que la
            // rueda: parar siempre clavado delata que el resultado venia dado.
            //
            // Pero mucho menos que en la rueda. Ahi el puntero es una aguja fina y
            // un desvio grande no se nota; aca el visor es un marco, y una celda
            // que queda un cuarto afuera no se lee como azar sino como un error de
            // alineacion. Se vio en la captura.
            const jitter = (Math.random() - 0.5) * celda * 0.24;
            const destino = (aterriza + 0.5) * celda - 50 + jitter;

            const duracion = v.spinSeconds;
            const ease = EASINGS[v.easing];
            const inicio = performance.now();
            let cruzadas = Math.floor(50 / celda);
            let frenoSonado = false;

            const frame = (ahora: number) => {
                const t = Math.min(1, (ahora - inicio) / (duracion * 1000));
                const off = destino * ease(t);
                setOffset(off);

                // Un tick por cada celda que cruza la marca. Al frenar se espacian
                // solos, porque el desplazamiento avanza cada vez menos por frame.
                const pasadas = Math.floor((off + 50) / celda);
                if (pasadas > cruzadas) {
                    cruzadas = pasadas;
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
                setGanadora(aterriza);
                terminado();
            };

            rafRef.current = requestAnimationFrame(frame);
            return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
        }, [nonce]);

        if (segments.length === 0) return null;

        const apagadas = phase === 'revealed' && ganadora != null;
        const ejeX = axis === 'x';
        const eje = axis === 'x' ? 'left' : 'top';
        const largoProp = axis === 'x' ? 'width' : 'height';
        // Lo que limita al texto es el ancho de la celda: la tira reparte el ancho
        // del contenedor entre las celdas y el carrete se lo da entero a cada una.
        const anchoCelda = axis === 'x' ? medidas.w / visibles : medidas.w;

        return (
            <div ref={rootRef} className="strip-root" data-axis={axis}>
                <style>{CSS}</style>

                <div
                    className="strip-track"
                    style={{
                        transform: axis === 'x' ? `translateX(${-offset}%)` : `translateY(${-offset}%)`,
                    }}
                >
                    {lista.map((idx, i) => {
                        const seg = segments[idx % segments.length];
                        if (!seg) return null;
                        return (
                            <Celda
                                key={i}
                                seg={seg}
                                visual={visual}
                                // El color sale del indice en el pool y no de la
                                // posicion en la lista: el mismo premio tiene que
                                // verse igual cada vez que vuelve a pasar.
                                color={seg.color || visual.palette[idx % visual.palette.length]}
                                anchoPx={anchoCelda}
                                dimmed={apagadas && ganadora !== i}
                                style={{ [eje]: `${i * celda}%`, [largoProp]: `${celda}%` }}
                            />
                        );
                    })}
                </div>

                {/* El visor: el equivalente de la aguja. Lo que quede dentro cuando la
                    lista frene es el premio.

                    Es un marco alrededor de la celda del centro y no una raya que la
                    cruza: la primera version era una linea de punta a punta y pasaba
                    justo por encima del texto del ganador — el unico momento en que
                    ese texto importa. Solo se vio en la captura. */}
                {!visual.pointer.hidden && (
                    <>
                        <div
                            className="strip-visor"
                            style={{
                                borderColor: visual.pointer.color ?? visual.accent,
                                borderWidth: `${visual.pointer.thickness}px`,
                                [largoProp]: `${celda}%`,
                            }}
                        />
                        {/* Las puntas son lo que hace que se lea como una mira y no
                            como un recuadro cualquiera. Se pueden quitar. */}
                        {visual.pointer.caps && (['is-start', 'is-end'] as const).map(donde => (
                            <div
                                key={donde}
                                className={`strip-mark-cap ${donde}`}
                                style={{
                                    background: visual.pointer.color ?? visual.accent,
                                    [ejeX ? 'width' : 'height']: `${4.5 * visual.pointer.size}%`,
                                    [ejeX ? 'height' : 'width']: `${9 * visual.pointer.size}%`,
                                }}
                            />
                        ))}
                    </>
                )}
            </div>
        );
    }

    return Strip;
}

/** Una celda de la tira: el color del premio y su etiqueta, siempre derecha. */
function Celda({ seg, visual, color, anchoPx, dimmed, style }: {
    seg: FaceSegment;
    visual: WheelVisual;
    color: string;
    /** Ancho util de la celda, ya en pixeles. */
    anchoPx: number;
    dimmed: boolean;
    style: CSSProperties;
}) {
    const etiqueta = visual.textUppercase ? seg.label.toUpperCase() : seg.label;
    const texto = seg.icon ? `${seg.icon} ${etiqueta}` : etiqueta;

    // Etiqueta larga, letra mas chica — el mismo criterio que la rueda, y por lo
    // mismo: que no se desborde de su celda. La escala del streamer multiplica.
    const porLargo = texto.length > 16 ? 0.115 : texto.length > 10 ? 0.145 : 0.185;
    const fontSize = Math.max(8, anchoPx * porLargo * visual.textScale);

    return (
        <div
            className={dimmed ? 'strip-cell is-dimmed' : 'strip-cell'}
            style={{ ...style, background: color, borderColor: visual.ink }}
        >
            <span
                className="strip-label"
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

/** La lista de reposo: lo justo para tapar el hueco, más un margen a cada lado. */
function enReposo(pool: number, visibles: number): number[] {
    if (pool <= 0) return [];
    const largo = visibles + 2;
    return Array.from({ length: largo }, (_, i) => i % pool);
}

const CSS = `
.strip-root {
    position: relative; width: 100%; height: 100%;
    overflow: hidden;
    border-radius: 12px;
    /* Los bordes se desvanecen para que las celdas no aparezcan de golpe. */
    -webkit-mask-image: linear-gradient(to right, transparent, #000 9%, #000 91%, transparent);
    mask-image: linear-gradient(to right, transparent, #000 9%, #000 91%, transparent);
}
.strip-root[data-axis="y"] {
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 9%, #000 91%, transparent);
    mask-image: linear-gradient(to bottom, transparent, #000 9%, #000 91%, transparent);
}

.strip-track { position: absolute; inset: 0; will-change: transform; }

.strip-cell {
    position: absolute;
    display: flex; align-items: center; justify-content: center;
    box-sizing: border-box;
    padding: 4% 3%;
    border-style: solid; border-width: 0;
    transition: opacity 520ms ease;
    overflow: hidden;
}
.strip-root[data-axis="x"] .strip-cell { top: 0; bottom: 0; border-left-width: 2px; border-right-width: 2px; }
.strip-root[data-axis="y"] .strip-cell { left: 0; right: 0; border-top-width: 2px; border-bottom-width: 2px; }
.strip-cell.is-dimmed { opacity: .28; }

.strip-label {
    text-align: center;
    line-height: 1.1;
    letter-spacing: -0.01em;
    /* Dos renglones como mucho: una etiqueta que no entra se corta antes de
       empujar a las demás fuera de la celda. */
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
    overflow: hidden;
    word-break: break-word;
}

.strip-visor {
    position: absolute; box-sizing: border-box;
    border-style: solid; border-radius: 7px;
    box-shadow: 0 0 14px rgba(0,0,0,.65), inset 0 0 14px rgba(0,0,0,.3);
    pointer-events: none;
}
.strip-root[data-axis="x"] .strip-visor { left: 50%; top: 0; bottom: 0; transform: translateX(-50%); }
.strip-root[data-axis="y"] .strip-visor { top: 50%; left: 0; right: 0; transform: translateY(-50%); }

/* Las dos puntas de la marca, para que se lea como un visor y no como una raya.
   En porcentajes, igual que la aguja de la rueda, para que encojan en el preview. */
.strip-mark-cap { position: absolute; filter: drop-shadow(0 0 4px rgba(0,0,0,.8)); }

.strip-root[data-axis="x"] .strip-mark-cap { left: 50%; width: 4.5%; height: 9%; }
.strip-root[data-axis="x"] .strip-mark-cap.is-start { top: 0; transform: translateX(-50%); clip-path: polygon(50% 100%, 0 0, 100% 0); }
.strip-root[data-axis="x"] .strip-mark-cap.is-end { bottom: 0; transform: translateX(-50%); clip-path: polygon(50% 0, 0 100%, 100% 100%); }

.strip-root[data-axis="y"] .strip-mark-cap { top: 50%; width: 9%; height: 4.5%; }
.strip-root[data-axis="y"] .strip-mark-cap.is-start { left: 0; transform: translateY(-50%); clip-path: polygon(100% 50%, 0 0, 0 100%); }
.strip-root[data-axis="y"] .strip-mark-cap.is-end { right: 0; transform: translateY(-50%); clip-path: polygon(0 50%, 100% 0, 100% 100%); }
`;

export const stripPresentation: Presentation = {
    key: 'strip',
    aspect: 3.4,
    motion: { spinSeconds: true, turns: true, easing: true },
    parts: { centerImage: false },
    pointer: 'viewer',
    sounds: ['spin_start', 'spin_tick', 'spin_slowdown'],
    Component: crearStrip('x'),
};

export const reelPresentation: Presentation = {
    key: 'reel',
    // 0.42 dejaba una columna demasiado angosta para su alto y las etiquetas
    // partidas en dos renglones casi siempre. 0.5 sigue cabiendo al costado.
    aspect: 0.5,
    motion: { spinSeconds: true, turns: true, easing: true },
    parts: { centerImage: false },
    pointer: 'viewer',
    sounds: ['spin_start', 'spin_tick', 'spin_slowdown'],
    Component: crearStrip('y'),
};
