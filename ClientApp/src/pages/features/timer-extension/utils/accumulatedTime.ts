/**
 * Timer Extension - Tiempo acumulado en palabras
 *
 * Toma los segundos que lleva corriendo el timer y los escribe como
 * "1 año, 4 meses, 2 semanas" en vez de "11928:45:03", que es lo que muestra el
 * elemento "Transcurrido" y se vuelve ilegible apenas el subathon pasa de unos dias.
 *
 * Los meses y los años se cuentan POR CALENDARIO, no con un mes promedio de 30,44 dias:
 * del 31 de enero al 28 de febrero son 28 dias, no "1 mes". Para eso hace falta saber
 * en que zona horaria vive el canal, porque de eso depende en que dia cae cada instante.
 */

export type TimeUnit = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';

/** De mayor a menor. El orden manda: si hay semanas activas, se comen a los dias. */
export const TIME_UNIT_ORDER: TimeUnit[] = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'];

const UNIT_LABELS: Record<'es' | 'en', Record<TimeUnit, { one: string; many: string; short: string }>> = {
    es: {
        years:   { one: 'año',     many: 'años',     short: 'a' },
        months:  { one: 'mes',     many: 'meses',    short: 'mes' },
        weeks:   { one: 'semana',  many: 'semanas',  short: 'sem' },
        days:    { one: 'día',     many: 'días',     short: 'd' },
        hours:   { one: 'hora',    many: 'horas',    short: 'h' },
        minutes: { one: 'minuto',  many: 'minutos',  short: 'min' },
        seconds: { one: 'segundo', many: 'segundos', short: 's' },
    },
    en: {
        years:   { one: 'year',   many: 'years',   short: 'y' },
        months:  { one: 'month',  many: 'months',  short: 'mo' },
        weeks:   { one: 'week',   many: 'weeks',   short: 'w' },
        days:    { one: 'day',    many: 'days',    short: 'd' },
        hours:   { one: 'hour',   many: 'hours',   short: 'h' },
        minutes: { one: 'minute', many: 'minutes', short: 'min' },
        seconds: { one: 'second', many: 'seconds', short: 's' },
    }
};

interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number; second: number; }

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone?: string): Intl.DateTimeFormat | null => {
    if (!timeZone) return null;
    const cached = formatterCache.get(timeZone);
    if (cached) return cached;
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone, hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        fmt.format(new Date());
        formatterCache.set(timeZone, fmt);
        return fmt;
    } catch {
        return null; // Zona invalida: se cae a la del navegador.
    }
};

/** Descompone un instante en su hora de pared dentro de la zona indicada. */
const toZonedParts = (ms: number, timeZone?: string): ZonedParts => {
    const fmt = getFormatter(timeZone);
    if (!fmt) {
        const d = new Date(ms);
        return {
            year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
            hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds()
        };
    }
    const parts: Record<string, string> = {};
    for (const p of fmt.formatToParts(new Date(ms))) {
        if (p.type !== 'literal') parts[p.type] = p.value;
    }
    return {
        year: Number(parts.year),
        // Intl devuelve 24 para la medianoche en algunas plataformas.
        month: Number(parts.month), day: Number(parts.day),
        hour: Number(parts.hour) % 24, minute: Number(parts.minute), second: Number(parts.second)
    };
};

const partsToTimestamp = (p: ZonedParts): number =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

/** Diferencia entre la hora de pared en la zona y el instante real, en ms. */
const zoneOffset = (ms: number, timeZone?: string): number => partsToTimestamp(toZonedParts(ms, timeZone)) - ms;

/** Instante real que corresponde a una hora de pared dada en la zona. Itera por DST. */
const zonedPartsToMs = (p: ZonedParts, timeZone?: string): number => {
    const naive = partsToTimestamp(p);
    let guess = naive - zoneOffset(naive, timeZone);
    guess = naive - zoneOffset(guess, timeZone);
    return guess;
};

/** Suma meses respetando el calendario, recortando el día si el mes destino es más corto. */
const addMonths = (ms: number, months: number, timeZone?: string): number => {
    const p = toZonedParts(ms, timeZone);
    const total = (p.year * 12 + (p.month - 1)) + months;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    // 31 de enero + 1 mes = 28/29 de febrero, no 3 de marzo.
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return zonedPartsToMs({ ...p, year, month, day: Math.min(p.day, lastDay) }, timeZone);
};

/**
 * Suma días respetando el calendario de la zona.
 *
 * No es lo mismo que sumar 24 horas: en las zonas con horario de verano (Madrid,
 * Santiago) hay días de 23 y de 25 horas. Sin esto, dos veces al año al contador le
 * aparecía una hora fantasma que ya no se iba más ("2 semanas, 1 hora").
 */
const addDays = (ms: number, days: number, timeZone?: string): number => {
    const p = toZonedParts(ms, timeZone);
    const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
    return zonedPartsToMs({
        ...p,
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate()
    }, timeZone);
};

const MS: Record<'hours' | 'minutes' | 'seconds', number> = {
    hours: 3600 * 1000,
    minutes: 60 * 1000,
    seconds: 1000
};

export interface UnitAmount { unit: TimeUnit; value: number; }

/**
 * Parte una duración en las unidades pedidas, de mayor a menor.
 * Las unidades que no se piden no existen: sin meses, el tiempo se acumula en semanas
 * o en días, según lo que haya activo.
 */
export const breakdownDuration = (totalSeconds: number, units: TimeUnit[], timeZone?: string, nowMs?: number): UnitAmount[] => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
    const end = nowMs ?? Date.now();
    let cursor = end - safeSeconds * 1000;

    const enabled = TIME_UNIT_ORDER.filter(u => units.includes(u));
    const result: UnitAmount[] = [];

    for (const unit of enabled) {
        if (unit === 'years' || unit === 'months') {
            const step = unit === 'years' ? 12 : 1;
            const a = toZonedParts(cursor, timeZone);
            const b = toZonedParts(end, timeZone);

            // Estimación por diferencia de calendario y ajuste de a uno.
            let count = Math.floor(((b.year * 12 + b.month) - (a.year * 12 + a.month)) / step);
            if (count < 0) count = 0;
            while (count > 0 && addMonths(cursor, count * step, timeZone) > end) count--;
            while (addMonths(cursor, (count + 1) * step, timeZone) <= end) count++;

            result.push({ unit, value: count });
            cursor = addMonths(cursor, count * step, timeZone);
        } else if (unit === 'weeks' || unit === 'days') {
            const step = unit === 'weeks' ? 7 : 1;

            let count = Math.floor((end - cursor) / (step * 24 * 3600 * 1000));
            if (count < 0) count = 0;
            while (count > 0 && addDays(cursor, count * step, timeZone) > end) count--;
            while (addDays(cursor, (count + 1) * step, timeZone) <= end) count++;

            result.push({ unit, value: count });
            cursor = addDays(cursor, count * step, timeZone);
        } else {
            const size = MS[unit];
            const count = Math.floor((end - cursor) / size);
            result.push({ unit, value: Math.max(0, count) });
            cursor += Math.max(0, count) * size;
        }
    }

    return result;
};

export interface AccumulatedTimeFormatOptions {
    units: TimeUnit[];
    hideZeroUnits?: boolean;
    /** Cuántas unidades como máximo se muestran. 0 = todas las activas. */
    maxUnits?: number;
    format?: 'long' | 'short';
    separator?: string;
    language?: 'es' | 'en';
    timeZone?: string;
    /** Instante contra el que se mide. Solo se pasa en las pruebas; por defecto es ahora. */
    nowMs?: number;
}

/** Arma la frase: "1 año, 4 meses, 2 semanas". */
export const formatAccumulatedTime = (totalSeconds: number, options: AccumulatedTimeFormatOptions): string => {
    const {
        units, hideZeroUnits = true, maxUnits = 3,
        format = 'long', separator = ', ', language = 'es', timeZone, nowMs
    } = options;

    if (!units || units.length === 0) return '';

    const parts = breakdownDuration(totalSeconds, units, timeZone, nowMs);

    // Se descartan TODAS las unidades en cero, no solo las del principio: si no,
    // quedan colas como "3 horas, 20 minutos, 0 segundos" que no aportan nada.
    let visible = hideZeroUnits ? parts.filter(p => p.value > 0) : parts;

    if (maxUnits > 0) visible = visible.slice(0, maxUnits);

    // Todo en cero: se muestra la unidad más chica activa para no dejar el widget vacío.
    if (visible.length === 0) {
        const smallest = parts[parts.length - 1];
        visible = smallest ? [smallest] : [];
    }

    const labels = UNIT_LABELS[language] ?? UNIT_LABELS.es;

    return visible
        .map(({ unit, value }) => {
            const l = labels[unit];
            return format === 'short'
                ? `${value}${l.short}`
                : `${value} ${value === 1 ? l.one : l.many}`;
        })
        .join(separator);
};

// ============================================================================
// FUENTES DEL TIEMPO Y PLANTILLA
// ============================================================================

/**
 * De donde sale el numero que se muestra. Son preguntas distintas:
 *
 *  - 'wallclock': hace cuanto arranco el subathon, contando de corrido aunque el
 *    timer este pausado o el stream apagado. Es lo que pregunta el chat
 *    ("¿cuantos dias llevas?") y lo que el streamer no sabe contestar.
 *  - 'active': cuanto tiempo estuvo el timer efectivamente corriendo. Es el mismo
 *    numero que el elemento "Transcurrido".
 *  - 'customDate': desde una fecha que escribe el streamer, para cuando reseteo el
 *    timer sin querer o vino migrado desde otra herramienta.
 *
 * Caso real medido: un subathon con 20 dias de reloj de pared tenia solo 5 dias de
 * tiempo activo, porque estuvo casi 15 dias pausado. Cuatro veces de diferencia.
 */
export type AccumulatedSource = 'wallclock' | 'active' | 'customDate';

export interface AccumulatedTimeSources {
    /** Segundos desde que arranco la sesion del timer. null si no hay sesion activa. */
    wallclockSeconds: number | null;
    /** Segundos que el timer estuvo corriendo, con el tiempo base incluido. */
    activeSeconds: number;
    /** Segundos desde la fecha manual. null si no hay fecha o es invalida. */
    customSeconds: number | null;
}

export interface AccumulatedTimeConfigLike extends Omit<AccumulatedTimeFormatOptions, 'units'> {
    units: Record<TimeUnit, boolean> | TimeUnit[];
    source?: AccumulatedSource;
    template?: string;
}

const unitsToList = (units: Record<TimeUnit, boolean> | TimeUnit[]): TimeUnit[] =>
    Array.isArray(units) ? TIME_UNIT_ORDER.filter(u => units.includes(u)) : TIME_UNIT_ORDER.filter(u => units?.[u]);

/**
 * Convierte la fecha manual (formato del input, "2026-08-28T18:33") en un instante,
 * interpretandola en la zona horaria del canal y no en la del navegador: el streamer
 * escribe la hora de su reloj, no la del que mira.
 */
export const parseLocalDateTimeInZone = (value: string | undefined | null, timeZone?: string): number | null => {
    if (!value) return null;
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;

    const ms = zonedPartsToMs({
        year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
        hour: Number(m[4] ?? 0), minute: Number(m[5] ?? 0), second: Number(m[6] ?? 0)
    }, timeZone);

    return Number.isFinite(ms) ? ms : null;
};

/** Segundos transcurridos desde un instante hasta ahora. Nunca negativo. */
export const secondsSince = (startMs: number | null | undefined, nowMs?: number): number | null => {
    if (startMs == null || !Number.isFinite(startMs)) return null;
    return Math.max(0, Math.floor(((nowMs ?? Date.now()) - startMs) / 1000));
};

/**
 * Arma el texto final del widget reemplazando las variables de la plantilla.
 *
 *   {tiempo}     -> la fuente elegida en la configuracion
 *   {calendario} -> siempre el reloj de pared desde que arranco el subathon
 *   {activo}     -> siempre el tiempo que el timer estuvo corriendo
 *
 * Las dos ultimas existen para poder mostrar ambas de una:
 * "20 dias de subathon · 5 dias de timer".
 */
export const renderAccumulatedTime = (
    cfg: AccumulatedTimeConfigLike,
    sources: AccumulatedTimeSources
): string => {
    const units = unitsToList(cfg.units);
    const base = {
        units,
        hideZeroUnits: cfg.hideZeroUnits,
        maxUnits: cfg.maxUnits,
        format: cfg.format,
        separator: cfg.separator,
        language: cfg.language,
        timeZone: cfg.timeZone,
        nowMs: cfg.nowMs
    };

    const source: AccumulatedSource = cfg.source ?? 'wallclock';
    // Si la fuente elegida no tiene dato (sin sesion, fecha vacia), se cae al tiempo
    // activo, que siempre existe. Mejor un numero util que un widget vacio.
    const chosen =
        source === 'active' ? sources.activeSeconds
        : source === 'customDate' ? (sources.customSeconds ?? sources.activeSeconds)
        : (sources.wallclockSeconds ?? sources.activeSeconds);

    const template = cfg.template || '{tiempo}';

    return template
        .replace(/\{tiempo\}/g, formatAccumulatedTime(chosen, base))
        .replace(/\{calendario\}/g, formatAccumulatedTime(sources.wallclockSeconds ?? 0, base))
        .replace(/\{activo\}/g, formatAccumulatedTime(sources.activeSeconds, base));
};
