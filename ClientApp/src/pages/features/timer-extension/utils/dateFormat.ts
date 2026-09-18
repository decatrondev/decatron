/**
 * Timer Extension - Formato de fechas
 *
 * El backend envía las fechas en ISO-8601 con zona explícita (UTC).
 * Estas utilidades las muestran en la zona horaria que configuró el streamer,
 * no en la del navegador ni en la del servidor (que está en Perú).
 */

/** Valida una zona IANA; devuelve undefined si no es usable (cae a la del navegador). */
export const resolveTimeZone = (timeZone?: string): string | undefined => {
    if (!timeZone) return undefined;
    try {
        new Intl.DateTimeFormat('es', { timeZone }).format(new Date());
        return timeZone;
    } catch {
        return undefined;
    }
};

/** Nombre de la zona que se está usando para mostrar, para mostrarlo en pantalla. */
export const timeZoneLabel = (timeZone?: string): string =>
    resolveTimeZone(timeZone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

const parse = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
};

/** Fecha y hora completas. Ej: 17/9/2026, 21:42:05 */
export const formatDateTimeIn = (value: string | null | undefined, timeZone?: string): string => {
    const d = parse(value);
    return d ? d.toLocaleString('es', { timeZone: resolveTimeZone(timeZone) }) : '—';
};

/** Solo la hora. Ej: 21:42:05 */
export const formatTimeOnlyIn = (value: string | null | undefined, timeZone?: string): string => {
    const d = parse(value);
    return d ? d.toLocaleTimeString('es', { timeZone: resolveTimeZone(timeZone) }) : '—';
};

/** Solo la fecha. Ej: 17/9/2026 */
export const formatDateOnlyIn = (value: string | null | undefined, timeZone?: string): string => {
    const d = parse(value);
    return d ? d.toLocaleDateString('es', { timeZone: resolveTimeZone(timeZone) }) : '—';
};

/** Compacto para listas desplegables. Ej: 17/9 21:42 */
export const formatShortDateTimeIn = (value: string | null | undefined, timeZone?: string): string => {
    const d = parse(value);
    if (!d) return '—';
    return d.toLocaleString('es', {
        timeZone: resolveTimeZone(timeZone),
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
