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
