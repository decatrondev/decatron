/**
 * Timer Extension - Time Conversion Utilities
 *
 * Funciones helper para convertir y formatear tiempos.
 */

import type { TimeUnit } from '../types';

// ============================================================================
// CONSTANTES
// ============================================================================

export const TIME_UNITS = {
    seconds: { label: 'Segundos', multiplier: 1 },
    minutes: { label: 'Minutos', multiplier: 60 },
    hours: { label: 'Horas', multiplier: 3600 },
    days: { label: 'Días', multiplier: 86400 }
} as const;

// ============================================================================
// FUNCIONES DE CONVERSIÓN
// ============================================================================

/**
 * Convierte segundos a la unidad especificada
 * @param seconds - Cantidad de segundos
 * @param unit - Unidad de tiempo destino
 * @returns Valor convertido redondeado
 */
export const convertSecondsToUnit = (seconds: number, unit: TimeUnit): number => {
    return Math.round(seconds / TIME_UNITS[unit].multiplier);
};

/**
 * Convierte de la unidad especificada a segundos
 * @param value - Valor en la unidad especificada
 * @param unit - Unidad de tiempo origen
 * @returns Valor en segundos
 */
export const convertUnitToSeconds = (value: number, unit: TimeUnit): number => {
    return value * TIME_UNITS[unit].multiplier;
};

/**
 * Determina la mejor unidad para mostrar un valor en segundos
 * @param seconds - Cantidad de segundos
 * @returns Unidad más apropiada para mostrar
 */
export const getBestUnit = (seconds: number): TimeUnit => {
    if (seconds >= 86400 && seconds % 86400 === 0) return 'days';
    if (seconds >= 3600 && seconds % 3600 === 0) return 'hours';
    if (seconds >= 60 && seconds % 60 === 0) return 'minutes';
    return 'seconds';
};

/**
 * Formatea segundos a texto legible (ej: "1d 2h 30m 45s")
 * @param seconds - Cantidad de segundos
 * @returns String formateado
 */
export const formatTime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
};

/**
 * Formatea segundos para el preview del timer (HH:MM:SS o MM:SS)
 * @param seconds - Cantidad de segundos
 * @returns String formateado para preview
 */
export const formatPreviewTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Formatea segundos a texto profesional detallado (ej: "1 hora, 10 minutos, 5 segundos")
 * @param seconds - Cantidad de segundos (puede ser negativo)
 * @returns String formateado detallado
 */
export const formatTimeProfessional = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const sign = seconds < 0 ? '-' : '+';

    if (absSeconds === 0) return '+0 segundos';

    const years = Math.floor(absSeconds / (365 * 24 * 60 * 60));
    let remaining = absSeconds % (365 * 24 * 60 * 60);

    const months = Math.floor(remaining / (30 * 24 * 60 * 60));
    remaining %= (30 * 24 * 60 * 60);

    const weeks = Math.floor(remaining / (7 * 24 * 60 * 60));
    remaining %= (7 * 24 * 60 * 60);

    const days = Math.floor(remaining / (24 * 60 * 60));
    remaining %= (24 * 60 * 60);

    const hours = Math.floor(remaining / (60 * 60));
    remaining %= (60 * 60);

    const minutes = Math.floor(remaining / 60);
    const secs = remaining % 60;

    const parts: string[] = [];

    if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
    if (weeks > 0) parts.push(`${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
    if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
    if (secs > 0) parts.push(`${secs} ${secs === 1 ? 'segundo' : 'segundos'}`);

    return `${sign} ${parts.join(', ')}`;
};
