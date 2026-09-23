/**
 * El registro de presentaciones.
 *
 * Para agregar una (tira horizontal, carrete vertical, rejilla, bola de casino):
 *
 *   1. Sumar su clave a `PresentationKey`, en `visualConfig.ts`.
 *   2. Escribir su archivo, exportando un `Presentation`.
 *   3. Registrarlo acá.
 *
 * El paso 3 no se puede olvidar: `PRESENTATIONS` está tipado como un
 * `Record<PresentationKey, …>`, así que agregar la clave sin registrar el
 * componente **no compila**. Es a propósito — una clave que el panel ofrece y
 * el overlay no sabe dibujar es una rueda en negro en mitad de un directo.
 */
import { RAFFLE_SOUND_FOR, SOUND_KEYS, type PresentationKey, type SoundKey, type WheelVisual } from '../visualConfig';
import { wheelPresentation } from './WheelPresentation';
import { reelPresentation, stripPresentation } from './StripPresentation';
import { gridPresentation } from './GridPresentation';
import { ballPresentation } from './BallPresentation';
import { cardPresentation } from './CardPresentation';
import type { Presentation } from './types';

export * from './types';

export const PRESENTATIONS: Record<PresentationKey, Presentation> = {
    wheel: wheelPresentation,
    strip: stripPresentation,
    reel: reelPresentation,
    grid: gridPresentation,
    ball: ballPresentation,
    card: cardPresentation,
};

/**
 * Los sonidos que existen en todas las presentaciones porque no los dispara la
 * presentación sino el overlay, cuando revela al ganador.
 */
export const UNIVERSAL_SOUNDS: SoundKey[] = ['reveal', 'win_celebration'];

/** La presentación de una rueda, con la circular como reserva. */
export function presentationOf(visual: WheelVisual): Presentation {
    return PRESENTATIONS[visual.presentation] ?? PRESENTATIONS.wheel;
}

/**
 * Qué sonidos tiene sentido configurar en esta presentación y este modo, en el
 * orden de siempre. Una que no mueva nada no ofrece tick ni frenada, y una rueda
 * de Sorteo ofrece los suyos en el lugar de arranque y celebración: mostrar los
 * dos juegos haría creer que suenan los cuatro.
 */
export function soundsFor(p: Presentation, mode: string = 'prizes'): SoundKey[] {
    const propios = SOUND_KEYS.filter(k => p.sounds.includes(k) || UNIVERSAL_SOUNDS.includes(k));
    if (mode !== 'raffle') return propios;
    return propios.map(k => RAFFLE_SOUND_FOR[k] ?? k);
}

/** El sonido que de verdad suena para un evento, según el modo del giro. */
export function soundForMode(key: SoundKey, mode: string | undefined): SoundKey {
    return mode === 'raffle' ? RAFFLE_SOUND_FOR[key] ?? key : key;
}
