/**
 * Timer Extension - Color Helper Utilities
 *
 * Funciones helper para manipulación de colores.
 */

/**
 * Convierte color hexadecimal a RGBA con alpha especificado
 * @param hex - Color en formato hexadecimal (#RRGGBB)
 * @param alpha - Valor de transparencia (0-1)
 * @returns String en formato rgba(r, g, b, a)
 */
export const hexToRgba = (hex: string, alpha: number): string => {
    // Remover el # si existe
    const cleanHex = hex.replace('#', '');

    // Convertir hex a RGB
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Descompone cualquier color de fondo guardado en hex + opacidad (0-100).
 *
 * Acepta lo que ya hay guardado en produccion: rgba(), rgb(), #rrggbb, #rrggbbaa,
 * 'transparent', vacio o basura escrita a mano. Nunca tira: ante la duda devuelve
 * negro transparente, que es lo mas parecido a "sin fondo".
 */
export const parseColorWithAlpha = (value: string | undefined | null): { hex: string; alpha: number } => {
    const fallback = { hex: '#000000', alpha: 0 };
    if (!value) return fallback;

    const v = value.trim().toLowerCase();
    if (v === 'transparent' || v === 'none') return fallback;

    const rgbaMatch = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (rgbaMatch) {
        const toHex = (n: string) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0');
        const alpha = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1;
        return {
            hex: `#${toHex(rgbaMatch[1])}${toHex(rgbaMatch[2])}${toHex(rgbaMatch[3])}`,
            alpha: Math.round(Math.max(0, Math.min(1, alpha)) * 100)
        };
    }

    const hexMatch = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
    if (hexMatch) {
        return {
            hex: `#${hexMatch[1]}`,
            alpha: hexMatch[2] !== undefined ? Math.round((parseInt(hexMatch[2], 16) / 255) * 100) : 100
        };
    }

    return fallback;
};

/** Arma el string rgba() que se guarda, a partir de hex + opacidad 0-100. */
export const buildRgba = (hex: string, alphaPercent: number): string =>
    hexToRgba(hex, Math.round(Math.max(0, Math.min(100, alphaPercent))) / 100);
