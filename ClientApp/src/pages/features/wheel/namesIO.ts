/**
 * Importar y exportar nombres: la lista de gajos de una rueda de Premios y el pool de un
 * Sorteo. Todo ocurre en el navegador: importar solo rellena la lista (o llama a los mismos
 * endpoints de alta de siempre) y exportar baja lo que el panel ya tiene cargado.
 */

/** Largo maximo de la etiqueta de un gajo: la columna `label` de la base es VARCHAR(60). */
export const MAX_LABEL = 60;

export interface ParsedName {
    name: string;
    /** Solo si la linea traia un peso valido. */
    weight?: number;
}

const NUM = /^\d+(?:[.,]\d+)?$/;

/**
 * Un nombre por linea. El peso es opcional y va despues de `;`, de un tabulador (lo que
 * llega al pegar desde una hoja de calculo) o de la ultima coma: "Premio grande;3",
 * "Premio grande, 3". Una coma dentro del nombre ("Hola, mundo") sigue siendo del nombre
 * mientras lo que va despues no sea un numero. La linea de titulos que escribe
 * `exportGajos` se salta, para que exportar y volver a importar de lo mismo.
 */
export function parseGajos(text: string): ParsedName[] {
    const out: ParsedName[] = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (/^(nombre|name)\s*[;\t]\s*(peso|weight)\b/i.test(line)) continue;

        let name = line;
        let weight: number | undefined;

        const parts = line.split(/[;\t]/);
        if (parts.length > 1) {
            name = parts[0].trim();
            const w = parts[1].trim();
            if (NUM.test(w)) weight = Number(w.replace(',', '.'));
        } else {
            const i = line.lastIndexOf(',');
            if (i > 0 && NUM.test(line.slice(i + 1).trim())) {
                name = line.slice(0, i).trim();
                weight = Number(line.slice(i + 1).trim().replace(',', '.'));
            }
        }

        name = name.slice(0, MAX_LABEL).trim();
        if (!name) continue;
        out.push({ name, weight: weight !== undefined && weight > 0 ? weight : undefined });
    }
    return out;
}

/**
 * Los nombres de un sorteo: sin arroba y sin repetidos (da igual mayusculas). Separan los
 * saltos de linea, las comas, los `;`, los tabuladores y los espacios: un nombre de usuario
 * no lleva espacios, asi que "ana beto carla" en una linea son tres nombres.
 */
export function parseViewers(text: string): string[] {
    const vistos = new Set<string>();
    const out: string[] = [];
    for (const raw of text.split(/[\s,;]+/)) {
        const nombre = raw.trim().replace(/^@/, '');
        if (!nombre || nombre.length > 40) continue;
        const k = nombre.toLowerCase();
        if (vistos.has(k)) continue;
        vistos.add(k);
        out.push(nombre);
    }
    return out;
}

/** Una celda de CSV con `;`: sin el separador ni saltos de linea, que romperian la fila. */
const celda = (s: string) => s.replace(/[;\r\n]+/g, ' ').trim();

export const CSV_HEADER_GAJOS = 'nombre;peso;premio';

export function exportGajos(rows: { label: string; weight: number; prize: string }[]): string {
    return [CSV_HEADER_GAJOS, ...rows.map(r => `${celda(r.label)};${r.weight};${celda(r.prize)}`)].join('\n');
}

/** Baja un texto como archivo. El BOM hace que Excel lea bien las tildes. */
export function downloadText(filename: string, text: string) {
    const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
