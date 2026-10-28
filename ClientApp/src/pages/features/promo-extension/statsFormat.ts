export interface DayStat { day: string; views: number; seconds: number; clicks: number }
export interface ItemStat { id: number; views: number; seconds: number; clicks: number }

/** Tiempo en pantalla legible: «45 s», «12 min», «3 h 20 min». */
export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)} s`;
    const min = Math.round(seconds / 60);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
}

export const formatNumber = (n: number, lang: string) => new Intl.NumberFormat(lang).format(n);

/** «mié 28 oct» a partir de `2026-10-28` (UTC, igual que el conteo del servidor). */
export function formatDay(day: string, lang: string, withWeekday = true): string {
    const d = new Date(`${day}T00:00:00Z`);
    return new Intl.DateTimeFormat(lang, { timeZone: 'UTC', day: 'numeric', month: 'short', ...(withWeekday ? { weekday: 'short' } : {}) }).format(d);
}
