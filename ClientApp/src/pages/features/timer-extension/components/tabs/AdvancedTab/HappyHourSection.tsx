/**
 * AdvancedTab - Happy Hour Section
 *
 * "Happy Hour ahora" (manual), la lista de Happy Hour programados y el formulario guiado para crearlos.
 * Todas las horas son las del canal (su zona horaria); si quien configura está en otra, se muestra también la suya.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Copy, Zap, Clock, AlertTriangle } from 'lucide-react';
import type { EventsConfig } from '../../../types';
import {
    HH_EVENTS, DAY_ORDER, type HHEvent, crossesMidnight, isActiveNow, nextStart, overlaps,
    minutesUntil, nowIn, timeIn, tzCity, localTz, fromMinutes,
} from './happyHourUtils';

export interface HappyHour {
    id: number;
    name: string;
    description: string | null;
    startTime: string;
    endTime: string;
    multiplier: number;
    daysOfWeek: string; // JSON string
    /** A qué eventos se aplica; null = a todos. */
    eventTypes: string[] | null;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface HappyHourFormData {
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    multiplier: number;
    daysOfWeek: boolean[];
    eventTypes: string[];
    enabled: boolean;
}

interface HappyHourSectionProps {
    happyHours: HappyHour[];
    loadingHappyHours: boolean;
    showCreateHappyHourModal: boolean;
    isEditingHappyHour: boolean;
    editingId: number | null;
    happyHourForm: HappyHourFormData;
    setHappyHourForm: (form: HappyHourFormData) => void;
    timeZone?: string;
    eventsConfig?: EventsConfig;

    // Happy Hour manual
    manualMultiplier: number;
    setManualMultiplier: (v: number) => void;
    manualDuration: number;
    setManualDuration: (v: number) => void;
    manualEvents: string[];
    setManualEvents: (v: string[]) => void;
    manualActive: boolean;
    manualExpiresAt: string | null;
    manualActiveEvents: string[] | null;
    manualActiveMultiplier: number;
    manualCountdown: string;
    onManualActivate: () => void;
    onManualDeactivate: () => void;

    // Handlers
    onPrepareCreate: () => void;
    onPrepareEdit: (hh: HappyHour) => void;
    onDuplicate: (hh: HappyHour) => void;
    onCreateHappyHour: () => void;
    onEditHappyHour: () => void;
    onDeleteHappyHour: (id: number) => void;
    onToggleHappyHour: (id: number, enabled: boolean) => void;
    onResetForm: () => void;
    onGoToGeneral: () => void;
}

const MULTIPLIERS = [1.5, 2, 3];
const DURATIONS = [30, 60, 120, 240, 480, 720];

const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg';
const label = 'text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2 block';
const chip = (active: boolean) => `px-3 py-2 rounded-xl text-sm font-bold border transition-all ${active
    ? 'bg-purple-500 border-purple-500 text-white shadow-md'
    : 'bg-white dark:bg-[#1a1a1a] border-[#e2e8f0] dark:border-[#374151] text-[#475569] dark:text-[#cbd5e1] hover:border-purple-300'}`;
const input = 'px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-xl bg-white dark:bg-[#1a1a1a] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-purple-500 focus:outline-none';

export const parseDays = (json: string): boolean[] => {
    try { const d = JSON.parse(json); return Array.isArray(d) && d.length === 7 ? d : [true, true, true, true, true, true, true]; } catch { return [true, true, true, true, true, true, true]; }
};

/** Nombre sugerido si el streamer no escribe uno: "Doble tiempo fines de semana". */
export function suggestHappyHourName(f: HappyHourFormData, t: (k: string, o?: any) => string): string {
    const mult = f.multiplier === 2 ? t('timerAdvanced.hh.name.double') : f.multiplier === 3 ? t('timerAdvanced.hh.name.triple') : t('timerAdvanced.hh.name.times', { m: f.multiplier });
    return `${mult} ${daysPhrase(f.daysOfWeek, t)}`.trim();
}

/** "todos los días", "fines de semana", "de lunes a viernes" o "lun, mié y vie". */
function daysPhrase(days: boolean[], t: (k: string, o?: any) => string): string {
    const on = DAY_ORDER.filter(d => days[d]);
    if (on.length === 7) return t('timerAdvanced.hh.days.all');
    if (on.length === 2 && days[0] && days[6]) return t('timerAdvanced.hh.days.weekend');
    if (on.length === 5 && [1, 2, 3, 4, 5].every(d => days[d])) return t('timerAdvanced.hh.days.weekdays');
    const names = on.map(d => t(`timerAdvanced.hh.days.short.${d}`));
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('timerAdvanced.hh.and')} ${names[names.length - 1]}` : names[0] ?? '';
}

const capitalize = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function formatSeconds(sec: number, t: (k: string, o?: any) => string): string {
    const s = Math.round(sec);
    if (s < 60) return t('timerAdvanced.hh.sec', { n: s });
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return [h ? t('timerAdvanced.hh.hours', { n: h }) : '', m ? t('timerAdvanced.hh.min', { n: m }) : '', !h && r ? t('timerAdvanced.hh.sec', { n: r }) : ''].filter(Boolean).join(' ');
}

const formatDuration = (min: number, t: (k: string, o?: any) => string) => formatSeconds(min * 60, t);

/** Ejemplo con los números reales del timer: "un sub Tier 1 hoy suma 5 min; con x2 sumará 10 min". */
function example(events: string[], mult: number, cfg: EventsConfig | undefined, t: (k: string, o?: any) => string): string | null {
    if (!cfg) return null;
    const candidates: { ev: HHEvent; time?: number; what: string }[] = [
        { ev: 'sub', time: cfg.subTier1?.enabled ? cfg.subTier1.time : undefined, what: t('timerAdvanced.hh.example.sub') },
        { ev: 'giftsub', time: cfg.giftSub?.enabled ? cfg.giftSub.time : undefined, what: t('timerAdvanced.hh.example.giftsub') },
        { ev: 'bits', time: cfg.bits?.enabled ? cfg.bits.time : undefined, what: t('timerAdvanced.hh.example.bits', { n: cfg.bits?.perBits || 100 }) },
        { ev: 'tip', time: cfg.tips?.enabled ? cfg.tips.time : undefined, what: t('timerAdvanced.hh.example.tip', { n: cfg.tips?.perCurrency || 1, currency: cfg.tips?.currency || 'USD' }) },
        { ev: 'raid', time: cfg.raid?.enabled ? cfg.raid.time : undefined, what: t('timerAdvanced.hh.example.raid') },
        { ev: 'hypetrain', time: cfg.hypeTrain?.enabled ? cfg.hypeTrain.time : undefined, what: t('timerAdvanced.hh.example.hypetrain') },
        { ev: 'follow', time: cfg.follow?.enabled ? cfg.follow.time : undefined, what: t('timerAdvanced.hh.example.follow') },
    ];
    const c = candidates.find(x => events.includes(x.ev) && x.time && x.time > 0);
    if (!c) return null;
    return t('timerAdvanced.hh.example.text', { what: c.what, before: formatSeconds(c.time!, t), m: mult, after: formatSeconds(c.time! * mult, t) });
}

function EventPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    const { t } = useTranslation('features');
    const all = HH_EVENTS.every(e => value.includes(e));
    return (
        <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(all)} onClick={() => onChange([...HH_EVENTS])}>{t('timerAdvanced.hh.events.all')}</button>
            {HH_EVENTS.map(e => (
                <button
                    key={e}
                    type="button"
                    className={chip(!all && value.includes(e))}
                    onClick={() => {
                        // Con "todos" marcado, tocar uno deja solo ese; si no, se suma o se quita
                        if (all) return onChange([e]);
                        const next = value.includes(e) ? value.filter(x => x !== e) : [...value, e];
                        onChange(next.length ? next : [...HH_EVENTS]);
                    }}
                >
                    {t(`timerAdvanced.hh.events.${e}`)}
                </button>
            ))}
        </div>
    );
}

function MultiplierPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const { t } = useTranslation('features');
    const custom = !MULTIPLIERS.includes(value);
    return (
        <div className="flex flex-wrap items-center gap-2">
            {MULTIPLIERS.map(m => <button key={m} type="button" className={chip(value === m)} onClick={() => onChange(m)}>x{m}</button>)}
            <span className="flex items-center gap-2">
                <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('timerAdvanced.hh.other')}</span>
                <input type="number" min={1.1} max={10} step={0.5} value={custom ? value : ''} placeholder="x5"
                    onChange={e => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(Math.min(10, Math.max(1.1, v))); }}
                    className={`${input} w-24 ${custom ? 'ring-2 ring-purple-500' : ''}`} />
            </span>
        </div>
    );
}

const eventsText = (events: string[] | null, t: (k: string, o?: any) => string) =>
    !events || HH_EVENTS.every(e => events.includes(e)) ? t('timerAdvanced.hh.events.allLower') : events.map(e => t(`timerAdvanced.hh.events.${e}`).toLowerCase()).join(', ');

export const HappyHourSection: React.FC<HappyHourSectionProps> = (p) => {
    const { t } = useTranslation('features');
    const tz = p.timeZone;
    const myTz = localTz();
    const otherTz = !!tz && tz !== myTz;
    // Reloj que se actualiza cada 30 s: estados "activo ahora" y la hora del canal
    const [, setTick] = useState(0);
    useEffect(() => { const id = window.setInterval(() => setTick(x => x + 1), 30000); return () => window.clearInterval(id); }, []);

    const channelNow = nowIn(tz);
    const channelClock = fromMinutes(channelNow.minutes);
    const myClock = timeIn(new Date(), myTz);
    const f = p.happyHourForm;
    const setF = (patch: Partial<HappyHourFormData>) => p.setHappyHourForm({ ...f, ...patch });

    // Happy Hour manual: "hasta las…"
    const [untilMode, setUntilMode] = useState(false);
    const [untilTime, setUntilTime] = useState(() => fromMinutes(channelNow.minutes + 120));
    const manualMinutes = untilMode ? minutesUntil(untilTime, tz) : p.manualDuration;
    useEffect(() => { if (untilMode) p.setManualDuration(minutesUntil(untilTime, tz)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [untilMode, untilTime, tz]);
    const manualEnd = new Date(Date.now() + manualMinutes * 60000);

    const overlapping = useMemo(() => p.happyHours.filter(h => h.enabled && h.id !== p.editingId
        && overlaps({ startTime: f.startTime, endTime: f.endTime, daysOfWeek: f.daysOfWeek }, { startTime: h.startTime, endTime: h.endTime, daysOfWeek: parseDays(h.daysOfWeek) })), [p.happyHours, p.editingId, f]);

    const sameTime = f.startTime === f.endTime;
    const noDays = !f.daysOfWeek.some(Boolean);
    const next = !noDays && !sameTime ? nextStart(f, tz) : null;
    const nextText = next ? (next.inDays === 0 ? t('timerAdvanced.hh.today') : next.inDays === 1 ? t('timerAdvanced.hh.tomorrow') : t(`timerAdvanced.hh.days.long.${next.dow}`)) : '';
    const ex = example(f.eventTypes, f.multiplier, p.eventsConfig, t);

    const tzLine = (
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {t('timerAdvanced.hh.channelClock', { city: tzCity(tz), time: channelClock })}
            {otherTz && <span>· {t('timerAdvanced.hh.yourClock', { time: myClock })}</span>}
        </p>
    );

    return (
        <div className="space-y-6">
            {!tz && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>{t('timerAdvanced.hh.noTimezone')} <button className="underline font-bold" onClick={p.onGoToGeneral}>{t('timerAdvanced.hh.goGeneral')}</button></div>
                </div>
            )}

            {/* ── Happy Hour ahora ─────────────────────────────────────────── */}
            <div className={card}>
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                    <div>
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2"><Zap className="w-5 h-5 text-orange-500" /> {t('timerAdvanced.hh.nowTitle')}</h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">{t('timerAdvanced.hh.nowDescription')}</p>
                    </div>
                    {tz && tzLine}
                </div>

                {p.manualActive ? (
                    <div className="p-4 rounded-xl border-2 border-orange-400 bg-orange-50 dark:bg-orange-900/20 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <p className="font-black text-orange-700 dark:text-orange-300">🔥 {t('timerAdvanced.hh.activeNow', { m: p.manualActiveMultiplier, events: eventsText(p.manualActiveEvents, t) })}</p>
                            <p className="text-sm text-orange-700/80 dark:text-orange-300/80 mt-1">
                                {p.manualExpiresAt && t('timerAdvanced.hh.endsAt', { time: timeIn(new Date(p.manualExpiresAt), tz), city: tzCity(tz) })}
                                {otherTz && p.manualExpiresAt && ` (${t('timerAdvanced.hh.yourTime', { time: timeIn(new Date(p.manualExpiresAt), myTz) })})`}
                                {p.manualCountdown && ` · ${t('timerAdvanced.hh.remaining', { time: p.manualCountdown })}`}
                            </p>
                        </div>
                        <button onClick={p.onManualDeactivate} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm">{t('timerAdvanced.deactivate')}</button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div>
                            <span className={label}>{t('timerAdvanced.hh.q.howMuch')}</span>
                            <MultiplierPicker value={p.manualMultiplier} onChange={p.setManualMultiplier} />
                        </div>
                        <div>
                            <span className={label}>{t('timerAdvanced.hh.q.howLong')}</span>
                            <div className="flex flex-wrap items-center gap-2">
                                {DURATIONS.map(d => (
                                    <button key={d} type="button" className={chip(!untilMode && p.manualDuration === d)} onClick={() => { setUntilMode(false); p.setManualDuration(d); }}>
                                        {formatDuration(d, t)}
                                    </button>
                                ))}
                                <span className="flex items-center gap-2">
                                    <button type="button" className={chip(untilMode)} onClick={() => setUntilMode(true)}>{t('timerAdvanced.hh.until')}</button>
                                    <input type="time" value={untilTime} onChange={e => { setUntilTime(e.target.value); setUntilMode(true); }} className={`${input} ${untilMode ? 'ring-2 ring-purple-500' : ''}`} />
                                </span>
                            </div>
                        </div>
                        <div>
                            <span className={label}>{t('timerAdvanced.hh.q.whichEvents')}</span>
                            <EventPicker value={p.manualEvents} onChange={p.setManualEvents} />
                        </div>
                        <div className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-xl bg-[#f8fafc] dark:bg-[#262626]">
                            <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                {t('timerAdvanced.hh.manualSummary', { m: p.manualMultiplier, events: eventsText(p.manualEvents, t), duration: formatDuration(manualMinutes, t), time: timeIn(manualEnd, tz) })}
                                {otherTz && ` (${t('timerAdvanced.hh.yourTime', { time: timeIn(manualEnd, myTz) })})`}
                            </p>
                            <button onClick={p.onManualActivate} className="px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-xl font-bold shadow-md">
                                {t('timerAdvanced.hh.activateNow')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Programados ──────────────────────────────────────────────── */}
            <div className={card}>
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                    <div>
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.happyHourMultiplier')}</h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">{t('timerAdvanced.hh.scheduledDescription')}</p>
                    </div>
                    {!p.showCreateHappyHourModal && (
                        <button onClick={p.onPrepareCreate} disabled={!tz} className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md">
                            <Plus className="w-4 h-4" /> {t('timerAdvanced.newHappyHour')}
                        </button>
                    )}
                </div>

                {p.showCreateHappyHourModal && (
                    <div className="mb-6 rounded-2xl border-2 border-purple-500/30 bg-[#f8fafc] dark:bg-[#262626] p-5 space-y-6">
                        <div className="flex items-center justify-between gap-3">
                            <h4 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">{p.isEditingHappyHour ? t('timerAdvanced.hh.editTitle') : t('timerAdvanced.hh.newTitle')}</h4>
                            {tzLine}
                        </div>

                        <div>
                            <span className={label}>1. {t('timerAdvanced.hh.q.howMuch')}</span>
                            <MultiplierPicker value={f.multiplier} onChange={v => setF({ multiplier: v })} />
                            {ex && <p className="text-sm text-purple-700 dark:text-purple-300 mt-2">{ex}</p>}
                        </div>

                        <div>
                            <span className={label}>2. {t('timerAdvanced.hh.q.whichEvents')}</span>
                            <EventPicker value={f.eventTypes} onChange={v => setF({ eventTypes: v })} />
                        </div>

                        <div className="space-y-3">
                            <span className={label}>3. {t('timerAdvanced.hh.q.when')}</span>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { key: 'all', days: [true, true, true, true, true, true, true] },
                                    { key: 'weekdays', days: [false, true, true, true, true, true, false] },
                                    { key: 'weekend', days: [true, false, false, false, false, false, true] },
                                ].map(s => (
                                    <button key={s.key} type="button" className={chip(s.days.every((d, i) => d === f.daysOfWeek[i]))} onClick={() => setF({ daysOfWeek: s.days })}>
                                        {t(`timerAdvanced.hh.days.${s.key}Cap`)}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {DAY_ORDER.map(d => (
                                    <button key={d} type="button" className={chip(f.daysOfWeek[d])}
                                        onClick={() => { const days = [...f.daysOfWeek]; days[d] = !days[d]; setF({ daysOfWeek: days }); }}>
                                        {t(`timerAdvanced.hh.days.short.${d}`)}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {[
                                    { key: 'allDay', start: '00:00', end: '23:59' },
                                    { key: 'afternoon', start: '14:00', end: '20:00' },
                                    { key: 'night', start: '20:00', end: '00:00' },
                                ].map(s => (
                                    <button key={s.key} type="button" className={chip(f.startTime === s.start && f.endTime === s.end)} onClick={() => setF({ startTime: s.start, endTime: s.end })}>
                                        {t(`timerAdvanced.hh.ranges.${s.key}`)}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('timerAdvanced.hh.from')}</label>
                                <input type="time" value={f.startTime} onChange={e => setF({ startTime: e.target.value })} className={input} />
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('timerAdvanced.hh.to')}</label>
                                <input type="time" value={f.endTime} onChange={e => setF({ endTime: e.target.value })} className={input} />
                            </div>
                            {crossesMidnight(f) && !sameTime && (
                                <p className="text-sm text-blue-700 dark:text-blue-300">🌙 {t('timerAdvanced.hh.crossesMidnight', { time: f.endTime })}</p>
                            )}
                        </div>

                        <div>
                            <span className={label}>4. {t('timerAdvanced.hh.q.name')}</span>
                            <input type="text" value={f.name} onChange={e => setF({ name: e.target.value })} placeholder={suggestHappyHourName(f, t)} className={`${input} w-full`} maxLength={100} />
                            <p className="text-xs text-[#94a3b8] mt-1">{t('timerAdvanced.hh.nameHint')}</p>
                        </div>

                        {/* Resumen y avisos */}
                        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 space-y-2">
                            {sameTime ? (
                                <p className="text-sm font-bold text-red-600 dark:text-red-400">{t('timerAdvanced.hh.errorSameTime')}</p>
                            ) : noDays ? (
                                <p className="text-sm font-bold text-red-600 dark:text-red-400">{t('timerAdvanced.hh.errorNoDays')}</p>
                            ) : (
                                <>
                                    <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                        {t('timerAdvanced.hh.summary', { days: capitalize(daysPhrase(f.daysOfWeek, t)), start: f.startTime, end: f.endTime, city: tzCity(tz), events: eventsText(f.eventTypes, t), m: f.multiplier })}
                                    </p>
                                    {next && <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{isActiveNow(f, tz) ? t('timerAdvanced.hh.wouldBeActive') : t('timerAdvanced.hh.nextStart', { day: nextText, time: f.startTime })}</p>}
                                </>
                            )}
                            {overlapping.length > 0 && (
                                <p className="text-sm text-amber-700 dark:text-amber-300">⚠️ {t('timerAdvanced.hh.overlap', { names: overlapping.map(h => h.name).join(', ') })}</p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <button onClick={p.onResetForm} className="px-4 py-2.5 rounded-xl font-bold text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]">{t('timerAdvanced.cancel')}</button>
                            <button onClick={p.isEditingHappyHour ? p.onEditHappyHour : p.onCreateHappyHour} disabled={sameTime || noDays}
                                className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md">
                                {p.isEditingHappyHour ? t('timerAdvanced.saveChanges') : t('timerAdvanced.hh.create')}
                            </button>
                        </div>
                    </div>
                )}

                {p.loadingHappyHours ? (
                    <p className="text-sm text-[#94a3b8]">{t('timerAdvanced.loadingSchedules')}</p>
                ) : p.happyHours.length === 0 ? (
                    !p.showCreateHappyHourModal && (
                        <div className="text-center py-10 rounded-xl border-2 border-dashed border-[#e2e8f0] dark:border-[#374151]">
                            <p className="text-4xl mb-2">🎉</p>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('timerAdvanced.hh.empty')}</p>
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {p.happyHours.map(h => {
                            const days = parseDays(h.daysOfWeek);
                            const sched = { startTime: h.startTime, endTime: h.endTime, daysOfWeek: days };
                            const active = h.enabled && isActiveNow(sched, tz);
                            const n = h.enabled && !active ? nextStart(sched, tz) : null;
                            const nText = n ? (n.inDays === 0 ? t('timerAdvanced.hh.today') : n.inDays === 1 ? t('timerAdvanced.hh.tomorrow') : t(`timerAdvanced.hh.days.long.${n.dow}`)) : '';
                            return (
                                <div key={h.id} className={`p-4 rounded-xl border ${active ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20' : 'border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]'} ${h.enabled ? '' : 'opacity-60'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{h.name}</p>
                                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                                <span className="font-black text-purple-600 dark:text-purple-400">x{h.multiplier}</span> · {daysPhrase(days, t)} · {h.startTime}–{h.endTime}{crossesMidnight(sched) ? ` (${t('timerAdvanced.hh.nextDay')})` : ''}
                                            </p>
                                            <p className="text-xs text-[#94a3b8] mt-0.5">{eventsText(h.eventTypes, t)}</p>
                                        </div>
                                        <button
                                            onClick={() => p.onToggleHappyHour(h.id, !h.enabled)}
                                            title={h.enabled ? t('timerAdvanced.deactivate') : t('timerAdvanced.hh.turnOn')}
                                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${h.enabled ? 'bg-purple-500' : 'bg-[#cbd5e1] dark:bg-[#374151]'}`}
                                        >
                                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${h.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${active ? 'bg-purple-500 text-white' : 'bg-[#e2e8f0] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8]'}`}>
                                            {!h.enabled ? t('timerAdvanced.inactive') : active ? `🔥 ${t('timerAdvanced.hh.statusActive')}` : n ? t('timerAdvanced.hh.statusNext', { day: nText, time: h.startTime }) : '—'}
                                        </span>
                                        <div className="flex gap-1">
                                            <button onClick={() => p.onPrepareEdit(h)} className="p-2 rounded-lg hover:bg-[#e2e8f0] dark:hover:bg-[#374151] text-[#64748b]" title={t('timerAdvanced.hh.edit')}><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => p.onDuplicate(h)} className="p-2 rounded-lg hover:bg-[#e2e8f0] dark:hover:bg-[#374151] text-[#64748b]" title={t('timerAdvanced.hh.duplicate')}><Copy className="w-4 h-4" /></button>
                                            <button onClick={() => p.onDeleteHappyHour(h.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title={t('timerAdvanced.hh.delete')}><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
