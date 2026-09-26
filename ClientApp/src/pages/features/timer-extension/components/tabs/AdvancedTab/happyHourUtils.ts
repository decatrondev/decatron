// Happy Hour: horarios en la zona horaria del canal, con la misma regla que el servidor
// (TimerEventService.GetScheduledHappyHoursNowAsync): un horario que cruza la medianoche
// (22:00 → 02:00) pertenece al día en que empieza.

/** Claves de evento que entiende el servidor, en el orden en que se muestran. */
export const HH_EVENTS = ['sub', 'giftsub', 'bits', 'tip', 'raid', 'hypetrain', 'follow'] as const;
export type HHEvent = typeof HH_EVENTS[number];

/** Orden de los días en pantalla: lunes primero. Los índices son los del servidor (0 = domingo). */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = (min: number) => {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Día de la semana (0 = domingo), minuto del día y fecha, ahora, en una zona horaria. */
export function nowIn(tz?: string): { dow: number; minutes: number; seconds: number; y: number; mo: number; d: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz || undefined, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { dow, minutes: Number(get('hour')) * 60 + Number(get('minute')), seconds: Number(get('second')), y: Number(get('year')), mo: Number(get('month')), d: Number(get('day')) };
}

export interface HHSchedule { startTime: string; endTime: string; daysOfWeek: boolean[]; enabled?: boolean }

export const crossesMidnight = (s: HHSchedule) => toMinutes(s.endTime) < toMinutes(s.startTime);

/** ¿Está en curso ahora (en la hora del canal)? */
export function isActiveNow(s: HHSchedule, tz?: string): boolean {
    const { dow, minutes } = nowIn(tz);
    const start = toMinutes(s.startTime), end = toMinutes(s.endTime);
    const yesterday = (dow + 6) % 7;
    if (end > start) return !!s.daysOfWeek[dow] && minutes >= start && minutes <= end;
    if (end < start) return (!!s.daysOfWeek[dow] && minutes >= start) || (!!s.daysOfWeek[yesterday] && minutes <= end);
    return false;
}

/** Próximo inicio: cuántos días faltan (0 = hoy) y qué día de la semana es. */
export function nextStart(s: HHSchedule, tz?: string): { inDays: number; dow: number } | null {
    const { dow, minutes } = nowIn(tz);
    const start = toMinutes(s.startTime);
    for (let i = 0; i < 8; i++) {
        const day = (dow + i) % 7;
        if (!s.daysOfWeek[day]) continue;
        if (i === 0 && minutes >= start) continue;
        return { inDays: i, dow: day };
    }
    return null;
}

/** Minutos del día que ocupa en cada día de la semana, como tramos [inicio, fin) — para ver superposiciones. */
function spans(s: HHSchedule): { day: number; from: number; to: number }[] {
    const start = toMinutes(s.startTime), end = toMinutes(s.endTime) + 1;
    const out: { day: number; from: number; to: number }[] = [];
    s.daysOfWeek.forEach((on, day) => {
        if (!on) return;
        if (end > start) out.push({ day, from: start, to: end });
        else { out.push({ day, from: start, to: 1440 }); out.push({ day: (day + 1) % 7, from: 0, to: end }); }
    });
    return out;
}

export function overlaps(a: HHSchedule, b: HHSchedule): boolean {
    const sa = spans(a), sb = spans(b);
    return sa.some(x => sb.some(y => x.day === y.day && x.from < y.to && y.from < x.to));
}

/** Minutos desde ahora hasta la próxima vez que el reloj del canal marque esa hora (máximo 24 h). */
export function minutesUntil(hhmm: string, tz?: string): number {
    const { minutes, seconds } = nowIn(tz);
    let diff = toMinutes(hhmm) - minutes - seconds / 60;
    if (diff <= 0) diff += 1440;
    return Math.max(1, Math.round(diff));
}

/** Hora de un instante en una zona horaria ("17:25"). */
export function timeIn(date: Date, tz?: string): string {
    return new Intl.DateTimeFormat('es', { timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

/** "America/Santiago" → "Santiago". */
export const tzCity = (tz?: string) => (tz ? tz.split('/').pop()!.replace(/_/g, ' ') : '');

/** Nombre corto del navegador (la hora de quien está configurando). */
export const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
