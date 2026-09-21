/**
 * Plantillas visuales: un aspecto entero de un clic.
 *
 * Tres decisiones que conviene no volver a discutir:
 *
 * 1. **Una plantilla NO es una entidad guardada.** Aplicarla escribe en el aspecto
 *    de la rueda y ahi se acaba: no hay tabla, ni endpoint, ni "rueda ligada a la
 *    plantilla X". Lo que el streamer edita despues es suyo y no se le va a
 *    desactualizar cuando cambiemos la plantilla. Y como el aspecto no se guarda
 *    hasta pulsar Guardar, probarse una y salir de la pestana no deja rastro.
 *
 * 2. **Ninguna plantilla toca el `layout`.** Colocar las piezas es una decision del
 *    streamer y pasar de "reparto automatico" a coordenadas fijas trae consigo la
 *    exigencia sobre el tamano de la fuente en OBS. Un boton de estilo no puede
 *    hacer eso a la espalda de nadie.
 *
 * 3. **Tampoco tocan la `presentation`.** Elegir rueda, tira, rejilla o carta es
 *    una decision de como se lee el sorteo —cuantos gajos tienes, cuanto dura, si
 *    los giros vienen encadenados—, no de estetica. Una plantilla que la cambiara
 *    convertiria "probar un color" en "cambiarme el formato del directo".
 *
 * Cada plantilla se lleva los colores, la tipografia, el puntero y la celebracion,
 * que es exactamente lo que se ve distinto entre una y otra.
 */
import { DEFAULT_PALETTE, DEFAULT_POINTER, DEFAULT_VISUAL, type WheelVisual } from './visualConfig';

/** Lo que una plantilla escribe. El resto del aspecto se queda como estaba. */
export type TemplatePatch = Pick<WheelVisual,
    | 'palette' | 'ink' | 'accent' | 'bone'
    | 'font' | 'fontWeight' | 'textColor' | 'textOutline' | 'textOutlineColor' | 'textUppercase' | 'textScale'
    | 'celebration'
> & { pointer: WheelVisual['pointer'] };

export interface WheelTemplate {
    key: string;
    patch: TemplatePatch;
}

export const TEMPLATES: WheelTemplate[] = [
    {
        // La de fabrica. Existe para poder volver: sin ella, probarse otra seria un
        // camino de ida a menos que el streamer recordara seis colores de memoria.
        key: 'decatron',
        patch: {
            palette: DEFAULT_PALETTE,
            ink: DEFAULT_VISUAL.ink,
            accent: DEFAULT_VISUAL.accent,
            bone: DEFAULT_VISUAL.bone,
            font: DEFAULT_VISUAL.font,
            fontWeight: DEFAULT_VISUAL.fontWeight,
            textScale: DEFAULT_VISUAL.textScale,
            textColor: DEFAULT_VISUAL.textColor,
            textOutline: DEFAULT_VISUAL.textOutline,
            textOutlineColor: DEFAULT_VISUAL.textOutlineColor,
            textUppercase: DEFAULT_VISUAL.textUppercase,
            celebration: DEFAULT_VISUAL.celebration,
            pointer: DEFAULT_VISUAL.pointer,
        },
    },
    {
        key: 'neon',
        patch: {
            palette: ['#00E5FF', '#FF2D95', '#7C4DFF', '#00FFA3', '#FFD400', '#FF6D00'],
            ink: '#080B14', accent: '#00E5FF', bone: '#EAF6FF',
            font: 'chakra', fontWeight: 700, textScale: 1,
            textColor: '#080B14', textOutline: 0, textOutlineColor: null, textUppercase: true,
            celebration: 'flash',
            pointer: { ...DEFAULT_POINTER, shape: 'arrow', size: 1.15, thickness: 4 },
        },
    },
    {
        key: 'arcade',
        patch: {
            palette: ['#FF4136', '#FFDC00', '#2ECC40', '#0074D9', '#B10DC9', '#FF851B'],
            ink: '#10121A', accent: '#FFDC00', bone: '#FFFFFF',
            // Press Start 2P solo existe en 400 y es ancha: la escala baja para que
            // las etiquetas largas sigan cabiendo en la cuna.
            font: 'press', fontWeight: 400, textScale: 0.72,
            textColor: '#10121A', textOutline: 0, textOutlineColor: null, textUppercase: true,
            celebration: 'confetti',
            pointer: { ...DEFAULT_POINTER, shape: 'bar', size: 1.1, thickness: 5 },
        },
    },
    {
        key: 'pastel',
        patch: {
            palette: ['#FFB5A7', '#FCD5CE', '#B8E0D2', '#A9D6E5', '#D6C1E8', '#FFE5A5'],
            ink: '#4A4453', accent: '#F4A6C0', bone: '#FFF7F2',
            font: 'fredoka', fontWeight: 600, textScale: 1,
            textColor: '#4A4453', textOutline: 0, textOutlineColor: null, textUppercase: false,
            celebration: 'confetti',
            pointer: { ...DEFAULT_POINTER, shape: 'drop', size: 1.1, thickness: 3 },
        },
    },
    {
        key: 'elegante',
        patch: {
            palette: ['#C9A227', '#E8D5A3', '#8C6D1F', '#3A3A3A', '#6B6B6B', '#D9C89E'],
            ink: '#0E0E10', accent: '#C9A227', bone: '#F3EDE0',
            font: 'outfit', fontWeight: 600, textScale: 1,
            textColor: '#0E0E10', textOutline: 0, textOutlineColor: null, textUppercase: true,
            // Sin confeti: es lo que separa a esta de las demas. Una rueda sobria
            // que termina lanzando papelitos deja de ser sobria.
            celebration: 'none',
            pointer: { ...DEFAULT_POINTER, shape: 'bar', size: 0.9, thickness: 2 },
        },
    },
    {
        key: 'chicle',
        patch: {
            palette: ['#FF5FA2', '#FFC1E3', '#7BDFF2', '#B2F7EF', '#F7D6E0', '#FFA69E'],
            ink: '#2B1B2E', accent: '#FF5FA2', bone: '#FFF0F7',
            font: 'luckiest', fontWeight: 400, textScale: 0.95,
            textColor: '#FFF0F7', textOutline: 3, textOutlineColor: '#2B1B2E', textUppercase: false,
            celebration: 'confetti',
            pointer: { ...DEFAULT_POINTER, shape: 'drop', size: 1.25, thickness: 4 },
        },
    },
];

/** El aspecto de la rueda con una plantilla aplicada encima. */
export function applyTemplate(visual: WheelVisual, tpl: WheelTemplate): WheelVisual {
    return { ...visual, ...tpl.patch, pointer: { ...tpl.patch.pointer } };
}
