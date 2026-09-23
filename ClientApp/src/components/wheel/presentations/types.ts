/**
 * El contrato de una presentación de la Rueda de la Suerte.
 *
 * Una presentación es **cómo se dibuja el resultado**, no cómo se decide. El
 * servidor ya eligió el índice ganador antes de mandar el evento: la tira
 * horizontal, el carrete y la rejilla van a recibir exactamente el mismo dato
 * que la rueda circular y solo van a animar otra cosa hasta llegar a él.
 *
 * El reparto de responsabilidades es el que hace que agregar una presentación
 * sea un archivo suelto:
 *
 *   La presentación   anima hasta el ganador, dispara sus propios sonidos de
 *                     movimiento y avisa cuando llegó.
 *   El overlay        la cola de giros, la tarjeta del ganador, la celebración,
 *                     el sonido de revelado y cuánto dura en pantalla.
 *
 * Por eso `onFinished` existe: la presentación no sabe qué pasa después de que
 * la aguja para, y no tiene por qué saberlo.
 */
import type { ReactElement } from 'react';
import type { FaceSegment } from '../WheelFace';
import type { PointerKind, PresentationKey, SoundKey, WheelVisual } from '../visualConfig';

export type SpinPhase = 'idle' | 'spinning' | 'revealed';

export interface ActiveSpin {
    /**
     * Un valor nuevo significa un giro nuevo. Es un contador y no un booleano
     * por lo mismo que la celebración: dos giros seguidos al mismo gajo tienen
     * que animarse dos veces, y con un booleano el segundo no cambiaría nada.
     */
    nonce: number;
    segmentIndex: number;
    /**
     * Cuántos gajos consideró el servidor al sortear. Puede no coincidir con
     * `segments.length` — en modo Sorteo la lista viaja dentro del evento — y
     * el que manda para calcular dónde parar es este.
     */
    segmentCount: number;
}

export interface PresentationProps {
    segments: FaceSegment[];
    visual: WheelVisual;
    /** El giro a animar, o `null` en reposo (el panel dibuja siempre así). */
    spin: ActiveSpin | null;
    phase: SpinPhase;
    /**
     * Los sonidos de movimiento. Los de revelado los dispara el overlay, y la
     * frenada tambien: la programa el overlay para que TERMINE cuando la
     * presentacion se detiene, y para eso hace falta saber cuanto dura el audio,
     * que es algo que solo sabe quien lo cargo.
     */
    onSound: (key: SoundKey) => void;
    /** La animación llegó al ganador. */
    onFinished: () => void;
}

export interface Presentation {
    key: PresentationKey;
    /**
     * Ancho / alto del lienzo que necesita. La rueda es cuadrada (1); una tira
     * horizontal pedirá algo como 4, y un carrete vertical algo como 0.4. Lo
     * declara la presentación porque es quien sabe qué forma tiene, y el
     * overlay y el preview del panel dimensionan con esto.
     */
    aspect: number;
    /**
     * Qué ajustes de movimiento usa **de verdad**. El panel esconde los que no:
     * "vueltas" no significa nada en una rejilla, y un control que no hace nada
     * es peor que un control que falta.
     */
    motion: { spinSeconds: boolean; turns: boolean; easing: boolean };
    /** Qué partes del aspecto dibuja. Una tira no tiene cubo central. */
    parts: { centerImage: boolean };
    /**
     * Qué clase de puntero tiene. `needle` es una aguja que señala (la rueda),
     * `viewer` un marco alrededor de la casilla ganadora (tira, carrete, rejilla)
     * y `none` significa que no hay nada que apuntar — la bola es su propia marca
     * y la carta no sortea a la vista.
     *
     * Va acá y no en el lienzo por lo mismo que `motion`: el panel ofrece forma y
     * lado solo a quien tiene aguja, y grosor y puntas solo a quien tiene visor.
     * Un elemento del lienzo habría dejado controles muertos en cinco de seis.
     */
    pointer: PointerKind;
    /**
     * Los sonidos que usa esta presentación. `reveal` y `win_celebration` NO van
     * acá: los dispara el overlay y existen en todas. `spin_slowdown` sí va, pero
     * la presentación no lo dispara: declararlo es pedirle al overlay que lo
     * programe para que acabe justo cuando ella termina de moverse.
     */
    sounds: SoundKey[];
    Component: (props: PresentationProps) => ReactElement | null;
}
