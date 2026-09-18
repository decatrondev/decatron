/**
 * Timer Overlay - Medición del tamaño real de los widgets
 *
 * El editor visual dibujaba cada widget como un rectángulo de tamaño fijo (el de Happy
 * Hour era siempre 320x30) mientras que en el overlay el tamaño depende de la fuente,
 * del relleno y de si se muestran el multiplicador y el contador. Con fuentes grandes
 * la diferencia es enorme y lo que posicionabas no coincidía con lo que se veía.
 *
 * Acá se calcula el tamaño aproximado que va a tener de verdad, replicando el mismo
 * marcado que arma TimerOverlay.
 */

/** Alto de línea de un texto sin line-height explícito, que es como se renderiza el widget. */
const LINE_HEIGHT_FACTOR = 1.2;

let measureCanvas: HTMLCanvasElement | null = null;

/** Mide el ancho de un texto en px con la tipografía indicada. */
const measureText = (text: string, fontSize: number, fontWeight: string, fontFamily: string): number => {
    try {
        if (!measureCanvas) measureCanvas = document.createElement('canvas');
        const ctx = measureCanvas.getContext('2d');
        if (!ctx) return text.length * fontSize * 0.55;
        ctx.font = `${fontWeight || 'bold'} ${fontSize}px ${fontFamily || 'Inter'}, sans-serif`;
        return ctx.measureText(text).width;
    } catch {
        // Sin canvas (SSR, navegador raro): estimación por cantidad de caracteres.
        return text.length * fontSize * 0.55;
    }
};

export interface WidgetSize {
    width: number;
    height: number;
}

/**
 * Tamaño de un widget de stats o del uptime.
 * Marcado real: [etiqueta a 0.75em] + 6px + [valor a 1em], dentro de un bloque con
 * relleno vertical `padding` y horizontal `padding * 2`.
 */
export const measureStatWidget = (widget: any, sampleValue: string): WidgetSize => {
    const fontSize = widget?.fontSize || 18;
    const padding = widget?.padding ?? 0;
    const fontWeight = widget?.fontWeight || 'bold';
    const fontFamily = widget?.fontFamily || 'Inter';
    const label = widget?.label || '';

    const labelWidth = measureText(label, fontSize * 0.75, fontWeight, fontFamily);
    const valueWidth = measureText(sampleValue, fontSize, fontWeight, fontFamily);

    return {
        width: Math.round(labelWidth + 6 + valueWidth + padding * 4),
        height: Math.round(fontSize * LINE_HEIGHT_FACTOR + padding * 2)
    };
};

/**
 * Tamaño del indicador de Happy Hour.
 * Marcado real: "🔥 ETIQUETA" + (x2) + (| Termina en 39:57), separados por 8px,
 * dentro de un bloque con relleno vertical `padding` y horizontal `padding * 2`.
 */
export const measureHappyHourWidget = (widget: any): WidgetSize => {
    const fontSize = widget?.fontSize || 16;
    const padding = widget?.padding ?? 8;
    const fontWeight = widget?.fontWeight || 'bold';
    const fontFamily = widget?.fontFamily || 'Inter';
    const label = widget?.label || 'HAPPY HOUR';

    const parts = [measureText(`🔥 ${label}`, fontSize, fontWeight, fontFamily)];
    if (widget?.showMultiplier) parts.push(measureText('x2', fontSize, fontWeight, fontFamily));
    if (widget?.showCountdown) parts.push(measureText('| Termina en 39:57', fontSize * 0.85, fontWeight, fontFamily));

    const gaps = (parts.length - 1) * 8;

    return {
        width: Math.round(parts.reduce((a, b) => a + b, 0) + gaps + padding * 4),
        height: Math.round(fontSize * LINE_HEIGHT_FACTOR + padding * 2)
    };
};

/**
 * Tamaño del widget de tiempo acumulado.
 * El texto sale de la plantilla del streamer, así que se mide el texto ya armado.
 */
export const measureAccumulatedWidget = (widget: any, renderedText: string): WidgetSize => {
    const fontSize = widget?.fontSize || 20;
    const padding = widget?.padding ?? 0;

    return {
        width: Math.round(
            measureText(renderedText, fontSize, widget?.fontWeight || 'bold', widget?.fontFamily || 'Inter') + padding * 4
        ),
        height: Math.round(fontSize * LINE_HEIGHT_FACTOR + padding * 2)
    };
};
