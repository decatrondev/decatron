import type { WheelVisual } from '../visualConfig';

/**
 * El tamaño de letra de una etiqueta dentro de una celda, sin partir palabras.
 *
 * Las celdas de la tira, la rejilla y la carta calculan la letra por el largo TOTAL de
 * la etiqueta y dejan que el navegador parta lo que no entre (`word-break`). Con una
 * celda angosta eso partía palabras cortas: "BETO" salía como "BET" / "O". Aca se mide
 * la palabra MAS LARGA y se achica la letra hasta que entre entera.
 *
 * Solo cuando ni achicada hasta un tamaño legible entra (un nombre de Twitch de 25
 * letras en una celda chica) se acepta partirla en dos renglones y se calcula la letra
 * para el medio nombre, que es mejor que una sola linea microscopica.
 *
 * El ancho por letra es una estimacion (una fuente ancha como Luckiest da mas): por eso
 * el CSS sigue teniendo `word-break` de red de seguridad.
 */
export function fitLabelFont(
    texto: string,
    anchoUtil: number,
    base: number,
    visual: WheelVisual,
    minimo: number,
): number {
    const factor = (visual.textUppercase ? 0.66 : 0.57) + visual.textOutline * 0.02;
    const palabra = Math.max(1, ...texto.split(/\s+/).map(p => p.length));

    const enUnaLinea = anchoUtil / (palabra * factor);
    if (enUnaLinea >= base) return base;
    if (enUnaLinea >= base * 0.6) return Math.max(minimo, enUnaLinea);

    const enDosLineas = anchoUtil / (Math.ceil(palabra / 2) * factor);
    return Math.max(minimo, Math.min(base, enDosLineas));
}
