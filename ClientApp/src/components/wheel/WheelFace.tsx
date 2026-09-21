/**
 * La cara de la rueda: el disco, los gajos, el aro, el cubo y la aguja.
 *
 * Un solo componente para el overlay de OBS y para el preview del panel — es lo
 * que exige la sección 8.1 del plan y lo que evita el problema real que había:
 * el overlay y el panel dibujaban cada uno su propia rueda, así que un cambio de
 * aspecto en uno dejaba al otro mostrando algo distinto de lo que iba a salir en
 * pantalla. El preview solo vale si es el mismo dibujo.
 *
 * No sabe girar ni sonar: recibe la rotación ya calculada. Quién anima es de quien
 * lo usa, porque el overlay anima contra un resultado del servidor y el panel no
 * anima en absoluto.
 */
import { useEffect } from 'react';
import { ensureFont, FONTS, type WheelVisual } from './visualConfig';

export interface FaceSegment {
    id: number;
    label: string;
    color: string | null;
    icon: string | null;
}

const SIZE = 520;
const R = 236;

export default function WheelFace({
    segments,
    visual,
    rotation = 0,
    highlightId = null,
    size,
}: {
    segments: FaceSegment[];
    visual: WheelVisual;
    rotation?: number;
    /** Al revelar, todo lo que no sea el ganador se apaga. */
    highlightId?: number | null;
    /**
     * Un tamano fijo en pixeles. Sin el, el dibujo **se ajusta a su contenedor**,
     * que es lo que quiere todo el mundo salvo quien necesite un tamano exacto.
     *
     * Antes el defecto eran 520 px clavados y lo que lo encogia era una regla CSS
     * suelta (`.wheel-svg`) declarada dentro del `<style>` de la rueda circular. Con
     * cualquier otra presentacion ese componente no se monta, la regla no existe y
     * las miniaturas de las plantillas salian a 520 px por encima de la pagina.
     * Un dibujo no puede depender de que otro componente este en pantalla.
     */
    size?: number;
}) {
    // La familia se pide aca y no en quien nos usa: el que dibuja la rueda es el
    // que sabe que fuente necesita, y asi el panel y el overlay no pueden olvidarse
    // uno de los dos y mostrar tipografias distintas.
    useEffect(() => { ensureFont(visual.font); }, [visual.font]);

    if (segments.length === 0) return null;

    const slice = 360 / segments.length;
    const c = SIZE / 2;

    return (
        <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={size ?? '100%'}
            height={size ?? '100%'}
            className="wheel-svg"
            aria-hidden="true"
            // La fuente va en el propio SVG y no heredada del contenedor: el panel
            // tiene su tipografia y el overlay la suya, y el preview solo sirve si
            // dibuja con la misma letra que va a salir en OBS.
            style={{ fontFamily: FONTS[visual.font].stack, display: 'block' }}
        >
            <defs>
                <filter id="wheelShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000" floodOpacity="0.55" />
                </filter>
                {visual.centerImage && (
                    <clipPath id="wheelHubClip">
                        <circle cx={c} cy={c} r={visual.centerImageSize} />
                    </clipPath>
                )}
            </defs>

            <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${c}px ${c}px` }}>
                <circle cx={c} cy={c} r={R + 12} fill={visual.ink} filter="url(#wheelShadow)" />

                {segments.map((seg, i) => (
                    <Slice
                        key={`${seg.id}-${i}`}
                        index={i}
                        slice={slice}
                        color={seg.color || visual.palette[i % visual.palette.length]}
                        visual={visual}
                        label={seg.label}
                        icon={seg.icon}
                        dimmed={highlightId != null && highlightId !== seg.id}
                    />
                ))}

                <circle cx={c} cy={c} r={R + 12} fill="none" stroke={visual.accent} strokeWidth="5" />
            </g>

            {/* Cubo fijo: no gira con la rueda, así el brillo no marea. El aro crece
                con la imagen para que siga siendo su marco y no quede por debajo. */}
            <circle
                cx={c} cy={c}
                r={visual.centerImage ? visual.centerImageSize + 2 : 42}
                fill={visual.ink} stroke={visual.accent} strokeWidth="4"
            />

            {visual.centerImage ? (
                <image
                    href={visual.centerImage}
                    x={c - visual.centerImageSize}
                    y={c - visual.centerImageSize}
                    width={visual.centerImageSize * 2}
                    height={visual.centerImageSize * 2}
                    clipPath="url(#wheelHubClip)"
                    // `meet` y no `slice`: recortar una ilustracion por los bordes para
                    // llenar el circulo le corta la cabeza al dibujo. Asi entra entera
                    // y lo que sobra deja ver la tinta del cubo, que es el marco.
                    preserveAspectRatio="xMidYMid meet"
                />
            ) : (
                <circle cx={c} cy={c} r="12" fill={visual.accent} />
            )}
        </svg>
    );
}

/** Un gajo: la cuña, su borde y el texto tumbado hacia afuera. */
function Slice({ index, slice, color, visual, label, icon, dimmed }: {
    index: number; slice: number; color: string; visual: WheelVisual;
    label: string; icon: string | null; dimmed: boolean;
}) {
    const ink = visual.ink;
    const c = SIZE / 2;
    const a0 = (index * slice - 90) * Math.PI / 180;
    const a1 = ((index + 1) * slice - 90) * Math.PI / 180;
    const large = slice > 180 ? 1 : 0;

    const d = [
        `M ${c} ${c}`,
        `L ${c + R * Math.cos(a0)} ${c + R * Math.sin(a0)}`,
        `A ${R} ${R} 0 ${large} 1 ${c + R * Math.cos(a1)} ${c + R * Math.sin(a1)}`,
        'Z',
    ].join(' ');

    const mid = (index + 0.5) * slice - 90;
    const etiqueta = visual.textUppercase ? label.toUpperCase() : label;
    const texto = icon ? `${icon} ${etiqueta}` : etiqueta;

    // El texto se tumba hacia afuera siguiendo el angulo del gajo, pero en la mitad
    // izquierda de la rueda ese mismo angulo lo deja cabeza abajo. Ahi se gira 180°
    // y se dibuja al otro lado del centro, de modo que siempre se lee de izquierda a
    // derecha. Se nota sobre todo con pocos gajos, donde cada cuna es enorme.
    const cabezaAbajo = ((mid % 360) + 360) % 360 > 90 && ((mid % 360) + 360) % 360 < 270;
    const rot = cabezaAbajo ? mid + 180 : mid;
    const tx = cabezaAbajo ? c - R * 0.62 : c + R * 0.62;

    // Etiqueta larga = letra más chica, para que no se desborde de la cuña. Con
    // muchos gajos la cuña además es más angosta, así que también encoge por ahí.
    // El ajuste automatico manda y la escala del streamer lo multiplica: si fuera al
    // reves, subir el tamano desbordaria la cuna con las etiquetas largas, que es
    // justo lo que este calculo existe para evitar.
    const porLargo = texto.length > 16 ? 15 : texto.length > 10 ? 18 : 21;
    const porAncho = slice < 12 ? 11 : slice < 20 ? 14 : 21;
    const fontSize = Math.max(6, Math.round(Math.min(porLargo, porAncho) * visual.textScale));

    const colorTexto = visual.textColor ?? ink;
    // El contorno se dibuja DEBAJO del relleno (`paint-order`). Al reves se comeria
    // la mitad del trazo de cada letra desde adentro y el texto quedaria mas fino
    // cuanto mas grueso el contorno, que es lo contrario de lo que se pidio.
    const colorContorno = visual.textOutlineColor ?? visual.bone;

    return (
        <g className={dimmed ? 'slice is-dimmed' : 'slice'}>
            <path d={d} fill={color} stroke={ink} strokeWidth="2.5" />
            <text
                x={tx}
                y={c}
                fill={colorTexto}
                fontSize={fontSize}
                fontWeight={visual.fontWeight}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${rot} ${c} ${c})`}
                stroke={visual.textOutline > 0 ? colorContorno : undefined}
                strokeWidth={visual.textOutline > 0 ? visual.textOutline : undefined}
                strokeLinejoin="round"
                style={{ letterSpacing: '-0.01em', paintOrder: 'stroke fill' }}
            >
                {texto.length > 22 ? `${texto.slice(0, 21)}…` : texto}
            </text>
        </g>
    );
}
