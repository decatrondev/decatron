import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Copy, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import OverlayCanvasEditor, { type Rect } from '../../../../../components/overlay-editor/OverlayCanvasEditor';
import { COLOR_THEMES, LAYOUT_PRESET_IDS, applyColorTheme, buildLayoutPreset } from '../../../../../components/event-alert-overlay/presets';
import { Card, ColorField, Field, NumberInput, Select, Slider, Toggle, inputClass, ScaledCanvas, CHECKER_BG } from '../../../../../components/overlay-editor/ui';
import EventAlertRenderer from '../../../../../components/event-alert-overlay/EventAlertRenderer';
import { EVENT_TYPES, TEXT_VARIABLES, step } from '../../../../../components/event-alert-overlay/defaults';
import type {
    AlertDesign, AlertEventType, AnimationStep, AnimationType, Direction, Easing, ElementAnimation, EventAlertData,
    EventAlertsDesign, HypeTrainLevelKey, TextElement, TextLine,
} from '../../../../../components/event-alert-overlay/types';

// Editor del diseño de Event Alerts (fase 2 del rediseño): el general, uno propio por evento y, en el hype train,
// uno propio por nivel. Todo lo que se edita acá es lo que sale en OBS (mismo renderer).

export type DesignTarget = 'general' | AlertEventType | `hype-${'1' | '2' | '3' | '4' | '5' | 'completed'}`;

export const HYPE_LEVELS: HypeTrainLevelKey[] = ['1', '2', '3', '4', '5', 'completed'];

/** Partes de la pestaña Diseño (en vez de todo apilado). */
type DesignSection = 'editor' | 'layouts' | 'colors' | 'animation';

const FONTS = ['Inter', 'Poppins', 'Roboto', 'Montserrat', 'Open Sans', 'Lato', 'Nunito', 'Rubik', 'Oswald', 'Raleway', 'Bebas Neue', 'Anton', 'Bangers', 'Press Start 2P', 'Orbitron', 'Russo One', 'Fredoka', 'Comfortaa', 'Pacifico', 'Permanent Marker'];

/** Primera familia de una pila CSS ("Inter, sans-serif" → "Inter"). */
export const firstFamily = (stack: string) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '');

const SHADOWS = [
    { id: 'none', css: '' },
    { id: 'soft', css: '0 4px 16px rgba(0,0,0,0.3)' },
    { id: 'default', css: '0 8px 32px rgba(0,0,0,0.5)' },
    { id: 'strong', css: '0 12px 40px rgba(0,0,0,0.75)' },
];

const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-ds-accent text-ds-on-accent' : 'text-ds-soft hover:bg-ds-raised '}`;
const btnGray = 'px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold transition-colors flex items-center gap-2 bg-ds-raised text-ds-soft hover:bg-ds-raised disabled:opacity-40';

/** El diseño propio de un destino, o null si usa otro (el general o el del hype train). */
export function ownDesign(design: EventAlertsDesign, target: DesignTarget): AlertDesign | null {
    if (target === 'general') return design.general;
    if (target.startsWith('hype-')) return design.events.hypeTrain?.levels?.[target.slice(5) as HypeTrainLevelKey] ?? null;
    return design.events[target as AlertEventType] ?? null;
}

/** El diseño que se ve en un destino (el propio o el que hereda). */
export function effectiveDesign(design: EventAlertsDesign, target: DesignTarget): AlertDesign {
    if (target === 'general') return design.general;
    if (target.startsWith('hype-')) return ownDesign(design, target) ?? design.events.hypeTrain ?? design.general;
    return design.events[target as AlertEventType] ?? design.general;
}

/** Evento de un destino (para los datos de ejemplo). */
export const targetEvent = (target: DesignTarget): AlertEventType =>
    target === 'general' ? 'follow' : target.startsWith('hype-') ? 'hypeTrain' : (target as AlertEventType);

function setOwn(design: EventAlertsDesign, target: DesignTarget, d: AlertDesign | null): EventAlertsDesign {
    if (target === 'general') return { ...design, general: d ?? design.general };
    if (target.startsWith('hype-')) {
        const train = design.events.hypeTrain;
        if (!train) return design;
        const levels = { ...(train.levels ?? {}) };
        const key = target.slice(5) as HypeTrainLevelKey;
        if (d) levels[key] = d; else delete levels[key];
        return { ...design, events: { ...design.events, hypeTrain: { ...train, levels } } };
    }
    const events = { ...design.events };
    const ev = target as AlertEventType;
    if (d) {
        // El hype train conserva sus niveles propios
        events[ev] = ev === 'hypeTrain' ? { ...d, levels: design.events.hypeTrain?.levels } : d;
    } else delete events[ev];
    return { ...design, events };
}

/** La caja que ocupan los elementos visibles de un diseño, con margen y proporción 16:9 como mínimo de alto. */
function contentBox(d: AlertDesign): { x: number; y: number; width: number; height: number } {
    const rects = [d.card, d.media, ...d.texts].filter(r => r.enabled);
    if (!rects.length) return { x: 0, y: 0, width: d.canvas.width, height: d.canvas.height };
    const m = 30;
    const x = Math.max(0, Math.min(...rects.map(r => r.x)) - m), y = Math.max(0, Math.min(...rects.map(r => r.y)) - m);
    const r = Math.min(d.canvas.width, Math.max(...rects.map(r => r.x + r.width)) + m), b = Math.min(d.canvas.height, Math.max(...rects.map(r => r.y + r.height)) + m);
    const width = Math.max(1, r - x);
    // Las miniaturas quedan del mismo alto aunque el diseño sea una franja
    const height = Math.max(b - y, Math.round(width * 9 / 16));
    return { x, y: Math.max(0, Math.min(y, d.canvas.height - height)), width, height: Math.min(height, d.canvas.height) };
}

// ── Animaciones ──────────────────────────────────────────────────────────────

const ANIM_TYPES: AnimationType[] = ['event', 'none', 'fade', 'slide', 'slide-bounce', 'bounce', 'zoom', 'rotate', 'flip', 'glitch'];
const WITH_DIRECTION: AnimationType[] = ['slide', 'slide-bounce', 'flip'];
const DIRECTIONS: Direction[] = ['left', 'right', 'top', 'bottom'];
const EASINGS: Easing[] = ['ease', 'ease-out', 'ease-in', 'ease-in-out', 'linear'];

function StepEditor({ label, value, onChange }: { label: string; value: AnimationStep; onChange: (s: AnimationStep) => void }) {
    const { t } = useTranslation('overlays');
    const set = (patch: Partial<AnimationStep>) => onChange({ ...value, ...patch });
    return (
        <div className="space-y-3">
            <p className="text-xs 3xl:text-sm font-bold uppercase text-ds-soft">{label}</p>
            <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-ds-bg w-fit">
                {ANIM_TYPES.map(a => <button key={a} className={seg(value.type === a)} onClick={() => set({ type: a })}>{t(`eventAlertsView.design.anim.${a}`)}</button>)}
            </div>
            {value.type !== 'none' && value.type !== 'event' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {WITH_DIRECTION.includes(value.type) && (
                        <Field label={t('eventAlertsView.design.anim.direction')}>
                            <Select value={value.direction} onChange={v => set({ direction: v })} options={DIRECTIONS.map(d => ({ value: d, label: t(`eventAlertsView.design.anim.directions.${d}`) }))} />
                        </Field>
                    )}
                    <Field label={t('eventAlertsView.design.anim.easing')}>
                        <Select value={value.easing} onChange={v => set({ easing: v })} options={EASINGS.map(e => ({ value: e, label: t(`eventAlertsView.design.anim.easings.${e}`) }))} />
                    </Field>
                    <Field label={t('eventAlertsView.design.anim.duration')}><Slider value={value.durationMs} min={100} max={3000} step={50} onChange={v => set({ durationMs: v })} suffix="ms" /></Field>
                    <Field label={t('eventAlertsView.design.anim.delay')}><Slider value={value.delayMs} min={0} max={3000} step={50} onChange={v => set({ delayMs: v })} suffix="ms" /></Field>
                </div>
            )}
            {value.type === 'event' && <p className="text-xs 3xl:text-sm text-ds-soft">{t('eventAlertsView.design.anim.eventHint')}</p>}
        </div>
    );
}

function AnimationEditor({ value, onChange, collapsible }: { value: ElementAnimation; onChange: (a: ElementAnimation) => void; collapsible?: boolean }) {
    const { t } = useTranslation('overlays');
    const body = (
        <div className="space-y-4 pt-4">
            <StepEditor label={t('eventAlertsView.design.anim.enter')} value={value.enter} onChange={enter => onChange({ ...value, enter })} />
            <StepEditor label={t('eventAlertsView.design.anim.exit')} value={value.exit} onChange={exit => onChange({ ...value, exit })} />
        </div>
    );
    if (!collapsible) return <div className="border-t border-ds-border">{body}</div>;
    // En el panel del elemento va plegada: casi siempre se usa la del evento
    return (
        <details className="border-t border-ds-border pt-3 group">
            <summary className="cursor-pointer text-sm 3xl:text-base font-bold text-ds-text select-none">
                ✨ {t('eventAlertsView.design.elementAnim')} <span className="font-normal text-xs 3xl:text-sm text-ds-soft">({t(`eventAlertsView.design.anim.${value.enter.type}`)})</span>
            </summary>
            {body}
        </details>
    );
}

// ── Propiedades de cada elemento ──────────────────────────────────────────────

function CardProps({ d, set }: { d: AlertDesign; set: (patch: Partial<AlertDesign['card']>) => void }) {
    const { t } = useTranslation('overlays');
    const c = d.card;
    const bg = c.background;
    const shadowId = SHADOWS.find(s => s.css === c.shadow)?.id ?? 'custom';
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-ds-bg w-fit">
                {(['color', 'gradient', 'image', 'transparent'] as const).map(ty => (
                    <button key={ty} className={seg(bg.type === ty)} onClick={() => set({ background: { ...bg, type: ty } })}>{t(`eventAlertsView.design.bg.${ty}`)}</button>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-3">
                {bg.type === 'color' && <ColorField label={t('eventAlertsView.design.color')} value={bg.color} onChange={v => set({ background: { ...bg, color: v } })} />}
                {bg.type === 'gradient' && (
                    <>
                        <ColorField label={t('eventAlertsView.design.color1')} value={bg.gradient.color1} onChange={v => set({ background: { ...bg, gradient: { ...bg.gradient, color1: v } } })} />
                        <ColorField label={t('eventAlertsView.design.color2')} value={bg.gradient.color2} onChange={v => set({ background: { ...bg, gradient: { ...bg.gradient, color2: v } } })} />
                        <Field label={t('eventAlertsView.design.angle')}><Slider value={bg.gradient.angle} min={0} max={360} onChange={v => set({ background: { ...bg, gradient: { ...bg.gradient, angle: v } } })} suffix="°" /></Field>
                    </>
                )}
                {bg.type === 'image' && (
                    <Field label={t('eventAlertsView.design.imageUrl')} hint={t('eventAlertsView.design.imageUrlHint')}>
                        <input className={inputClass} value={bg.image} onChange={e => set({ background: { ...bg, image: e.target.value } })} placeholder="https://…" />
                    </Field>
                )}
                <Field label={t('eventAlertsView.design.opacity')}><Slider value={c.opacity} min={0} max={100} onChange={v => set({ opacity: v })} suffix="%" /></Field>
                <Field label={t('eventAlertsView.design.radius')}><Slider value={c.radius} min={0} max={120} onChange={v => set({ radius: v })} suffix="px" /></Field>
                <Field label={t('eventAlertsView.design.shadow')}>
                    <Select value={shadowId} onChange={v => { const s = SHADOWS.find(x => x.id === v); if (s) set({ shadow: s.css }); }}
                        options={[...SHADOWS.map(s => ({ value: s.id, label: t(`eventAlertsView.design.shadows.${s.id}`) })), ...(shadowId === 'custom' ? [{ value: 'custom', label: t('eventAlertsView.design.shadows.custom') }] : [])]} />
                </Field>
                <Toggle checked={c.border.enabled} onChange={v => set({ border: { ...c.border, enabled: v } })} label={t('eventAlertsView.design.border')} />
                {c.border.enabled && (
                    <>
                        <ColorField label={t('eventAlertsView.design.borderColor')} value={c.border.color} onChange={v => set({ border: { ...c.border, color: v } })} />
                        <Field label={t('eventAlertsView.design.borderWidth')}><Slider value={c.border.width} min={1} max={16} onChange={v => set({ border: { ...c.border, width: v } })} suffix="px" /></Field>
                    </>
                )}
            </div>
        </div>
    );
}

function MediaProps({ d, set }: { d: AlertDesign; set: (patch: Partial<AlertDesign['media']>) => void }) {
    const { t } = useTranslation('overlays');
    const m = d.media;
    return (
        <div className="grid grid-cols-1 gap-3">
            <Field label={t('eventAlertsView.design.fit')} hint={t('eventAlertsView.design.fitHint')}>
                <Select value={m.fit} onChange={v => set({ fit: v })} options={(['contain', 'cover', 'fill'] as const).map(f => ({ value: f, label: t(`eventAlertsView.design.fits.${f}`) }))} />
            </Field>
            <Field label={t('eventAlertsView.design.opacity')}><Slider value={m.opacity} min={0} max={100} onChange={v => set({ opacity: v })} suffix="%" /></Field>
            <Field label={t('eventAlertsView.design.radius')}><Slider value={m.radius} min={0} max={120} onChange={v => set({ radius: v })} suffix="px" /></Field>
        </div>
    );
}

function TextProps({ text, set, onRemove }: { text: TextElement; set: (patch: Partial<TextElement>) => void; onRemove: () => void }) {
    const { t } = useTranslation('overlays');
    const focused = useRef<number | null>(null);
    const setLine = (i: number, patch: Partial<TextLine>) => set({ lines: text.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
    const move = (i: number, dir: -1 | 1) => {
        const lines = [...text.lines];
        const j = i + dir;
        if (j < 0 || j >= lines.length) return;
        [lines[i], lines[j]] = [lines[j], lines[i]];
        set({ lines });
    };
    const insert = (v: string) => {
        const i = focused.current ?? text.lines.length - 1;
        if (i < 0 || !text.lines[i]) return;
        setLine(i, { template: `${text.lines[i].template}{${v}}` });
    };
    const family = firstFamily(text.fontFamily);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
                {TEXT_VARIABLES.map(v => (
                    <button key={v} onMouseDown={e => e.preventDefault()} onClick={() => insert(v)} title={t(`eventAlertsView.design.vars.${v}`)}
                        className="ds-btn ds-btn--secondary ds-btn--sm">{`{${v}}`}</button>
                ))}
            </div>
            <div className="space-y-2">
                {text.lines.map((l, i) => (
                    <div key={i} className="p-3 rounded-lg border border-ds-border bg-ds-bg space-y-2">
                        <div className="flex items-center gap-1">
                            <input className={inputClass} value={l.template} maxLength={300} onFocus={() => { focused.current = i; }} onChange={e => setLine(i, { template: e.target.value })} placeholder={t('eventAlertsView.design.linePlaceholder')} />
                            <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-ds-soft disabled:opacity-30" title={t('eventAlertsView.design.moveUp')}><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => move(i, 1)} disabled={i === text.lines.length - 1} className="p-1 text-ds-soft disabled:opacity-30" title={t('eventAlertsView.design.moveDown')}><ChevronDown className="w-4 h-4" /></button>
                            <button onClick={() => set({ lines: text.lines.filter((_, j) => j !== i) })} disabled={text.lines.length <= 1} className="p-1 text-ds-soft hover:text-ds-danger disabled:opacity-30" title={t('eventAlertsView.design.removeLine')}><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label={t('eventAlertsView.design.size')}><NumberInput value={l.fontSize} min={8} max={200} onChange={v => setLine(i, { fontSize: v })} /></Field>
                            <Field label={t('eventAlertsView.design.weight')}>
                                <Select value={l.fontWeight ?? 'inherit'} onChange={v => setLine(i, { fontWeight: v === 'inherit' ? undefined : v })}
                                    options={[{ value: 'inherit', label: t('eventAlertsView.design.weights.inherit') }, ...['400', '500', '600', 'bold', '800', '900'].map(w => ({ value: w, label: t(`eventAlertsView.design.weights.${w}`) })), ...(l.fontWeight && !['400', '500', '600', 'bold', '800', '900'].includes(l.fontWeight) ? [{ value: l.fontWeight, label: l.fontWeight }] : [])]} />
                            </Field>
                            <Field label={t('eventAlertsView.design.lineOpacity')}><Slider value={l.opacity} min={10} max={100} onChange={v => setLine(i, { opacity: v })} suffix="%" /></Field>
                            <Field label={t('eventAlertsView.design.marginTop')}><Slider value={l.marginTop} min={0} max={60} onChange={v => setLine(i, { marginTop: v })} suffix="px" /></Field>
                        </div>
                    </div>
                ))}
                <button className={btnGray} onClick={() => set({ lines: [...text.lines, { template: '', fontSize: text.lines.at(-1)?.fontSize ?? 24, lineHeight: 1.3, opacity: 100, marginTop: 4 }] })}>
                    <Plus className="w-4 h-4" /> {t('eventAlertsView.design.addLine')}
                </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
                <Field label={t('eventAlertsView.design.font')}>
                    <select className={inputClass} value={family} onChange={e => set({ fontFamily: `'${e.target.value}', sans-serif` })}>
                        {[...new Set([family, ...FONTS])].map(f => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
                    </select>
                </Field>
                <ColorField label={t('eventAlertsView.design.textColor')} value={text.color} onChange={v => set({ color: v })} />
                <Field label={t('eventAlertsView.design.align')}>
                    <div className="flex gap-1 p-1 rounded-lg bg-ds-bg w-fit">
                        {(['left', 'center', 'right'] as const).map(a => <button key={a} className={seg(text.align === a)} onClick={() => set({ align: a })}>{t(`eventAlertsView.design.aligns.${a}`)}</button>)}
                    </div>
                </Field>
                <Field label={t('eventAlertsView.design.vAlign')}>
                    <div className="flex gap-1 p-1 rounded-lg bg-ds-bg w-fit">
                        {(['top', 'center', 'bottom'] as const).map(a => <button key={a} className={seg(text.verticalAlign === a)} onClick={() => set({ verticalAlign: a })}>{t(`eventAlertsView.design.vAligns.${a}`)}</button>)}
                    </div>
                </Field>
                <Field label={t('eventAlertsView.design.textShadow')}>
                    <Select value={text.shadow} onChange={v => set({ shadow: v })} options={(['none', 'normal', 'strong', 'glow'] as const).map(s => ({ value: s, label: t(`eventAlertsView.design.textShadows.${s}`) }))} />
                </Field>
                <ColorField label={t('eventAlertsView.design.textBackground')} value={text.background === 'transparent' ? '#00000000' : text.background} onChange={v => set({ background: v })} />
                <Field label={t('eventAlertsView.design.padding')}><Slider value={text.padding} min={0} max={80} onChange={v => set({ padding: v })} suffix="px" /></Field>
                <Field label={t('eventAlertsView.design.radius')}><Slider value={text.radius} min={0} max={80} onChange={v => set({ radius: v })} suffix="px" /></Field>
            </div>
            <button className={`${btnGray} !text-ds-danger`} onClick={onRemove}><Trash2 className="w-4 h-4" /> {t('eventAlertsView.design.removeText')}</button>
        </div>
    );
}

// ── Pestaña ──────────────────────────────────────────────────────────────────

interface Props {
    design: EventAlertsDesign;
    onChange: (d: EventAlertsDesign) => void;
    canvas: { width: number; height: number };
    onCanvasChange: (size: { width: number; height: number }) => void;
    /** Datos de ejemplo por evento (con la media real que tiene configurada). */
    samples: Record<AlertEventType, EventAlertData>;
    target: DesignTarget;
    onTargetChange: (t: DesignTarget) => void;
    /** "Posición por defecto" de General: donde se ubican los diseños prearmados. */
    anchor?: { x: number; y: number };
}

export default function DesignTab({ design, onChange, canvas, onCanvasChange, samples, target, onTargetChange, anchor }: Props) {
    const { t } = useTranslation('overlays');
    const designRef = useRef(design);
    designRef.current = design;
    const [copyTo, setCopyTo] = useState<AlertEventType | ''>('');
    const [section, setSection] = useState<DesignSection>('editor');

    const own = ownDesign(design, target);
    const shown = effectiveDesign(design, target);
    const isHypeLevel = target.startsWith('hype-');
    const inherits = !own;

    /** Cambia el diseño propio del destino. Editar deja de seguir el estilo viejo de la alerta: manda el diseño. */
    const update = useCallback((fn: (d: AlertDesign) => AlertDesign) => {
        const cur = ownDesign(designRef.current, target);
        if (!cur) return;
        onChange(setOwn(designRef.current, target, { ...fn(cur), followAlertStyle: false }));
    }, [onChange, target]);

    const onRectChange = useCallback((id: string, patch: Partial<Rect>) => update(d => {
        if (id === 'card') return { ...d, card: { ...d.card, ...patch } };
        if (id === 'media') return { ...d, media: { ...d.media, ...patch } };
        return { ...d, texts: d.texts.map(x => (`text:${x.id}` === id ? { ...x, ...patch } : x)) };
    }), [update]);

    const onToggle = useCallback((id: string, enabled: boolean) => onRectChange(id, { enabled } as Partial<Rect>), [onRectChange]);

    const createOwn = () => {
        const base = isHypeLevel ? (design.events.hypeTrain ?? design.general) : design.general;
        onChange(setOwn(design, target, structuredClone({ ...base, levels: undefined } as AlertDesign)));
    };
    const removeOwn = () => {
        if (!window.confirm(t(isHypeLevel ? 'eventAlertsView.design.useTrainConfirm' : 'eventAlertsView.design.useGeneralConfirm'))) return;
        onChange(setOwn(design, target, null));
    };
    const doCopy = () => {
        if (!copyTo || !own) return;
        if (!window.confirm(t('eventAlertsView.design.copyConfirm', { event: t(`eventAlertsView.events.${copyTo}`) }))) return;
        onChange(setOwn(design, copyTo, structuredClone({ ...own, levels: undefined } as AlertDesign)));
        setCopyTo('');
    };
    const addText = () => update(d => ({
        ...d,
        texts: [...d.texts, {
            id: `t${Date.now().toString(36)}`, x: d.card.x + 20, y: d.card.y + 20, width: Math.max(200, d.card.width - 40), height: 60, enabled: true,
            lines: [{ template: '{username}', fontSize: 28, fontWeight: 'bold', lineHeight: 1.3, opacity: 100, marginTop: 0 }],
            fontFamily: d.texts[0]?.fontFamily ?? 'Inter, sans-serif', color: d.texts[0]?.color ?? '#ffffff', align: 'center', verticalAlign: 'center',
            shadow: d.texts[0]?.shadow ?? 'normal', background: 'transparent', padding: 0, radius: 0,
            animation: { enter: step({ type: 'event' }), exit: step({ type: 'event' }) },
        }],
    }));

    const textLabel = (x: TextElement, i: number) => {
        const first = x.lines[0]?.template?.trim();
        return first ? `${t('eventAlertsView.design.text', { n: i + 1 })} · ${first.slice(0, 24)}` : t('eventAlertsView.design.text', { n: i + 1 });
    };

    const elements = useMemo(() => [
        { id: 'card', label: t('eventAlertsView.design.card'), x: shown.card.x, y: shown.card.y, width: shown.card.width, height: shown.card.height, enabled: shown.card.enabled, zIndex: 1 },
        { id: 'media', label: t('eventAlertsView.design.media'), x: shown.media.x, y: shown.media.y, width: shown.media.width, height: shown.media.height, enabled: shown.media.enabled, zIndex: 5 },
        ...shown.texts.map((x, i) => ({ id: `text:${x.id}`, label: textLabel(x, i), x: x.x, y: x.y, width: x.width, height: x.height, enabled: x.enabled, zIndex: 10 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [shown, t]);

    const selectedExtra = (id: string): ReactNode => {
        if (inherits) return null;
        if (id === 'card') return (
            <div className="space-y-4">
                <CardProps d={shown} set={patch => update(d => ({ ...d, card: { ...d.card, ...patch } }))} />
                <AnimationEditor collapsible value={shown.card.animation} onChange={a => update(d => ({ ...d, card: { ...d.card, animation: a } }))} />
            </div>
        );
        if (id === 'media') return (
            <div className="space-y-4">
                <MediaProps d={shown} set={patch => update(d => ({ ...d, media: { ...d.media, ...patch } }))} />
                <AnimationEditor collapsible value={shown.media.animation} onChange={a => update(d => ({ ...d, media: { ...d.media, animation: a } }))} />
            </div>
        );
        const text = shown.texts.find(x => `text:${x.id}` === id);
        if (!text) return null;
        const setText = (patch: Partial<TextElement>) => update(d => ({ ...d, texts: d.texts.map(x => (x.id === text.id ? { ...x, ...patch } : x)) }));
        return (
            <div className="space-y-4">
                <TextProps text={text} set={setText} onRemove={() => { if (window.confirm(t('eventAlertsView.design.removeTextConfirm'))) update(d => ({ ...d, texts: d.texts.filter(x => x.id !== text.id) })); }} />
                <AnimationEditor collapsible value={text.animation} onChange={a => setText({ animation: a })} />
            </div>
        );
    };

    const sample = samples[targetEvent(target)];
    const hypeKey = isHypeLevel ? target.slice(5) : '';
    const sampleData = isHypeLevel
        ? (hypeKey === 'completed' ? { ...sample, level: 5, amount: 5, hypeTrainCompleted: true } : { ...sample, level: Number(hypeKey), amount: Number(hypeKey) })
        : sample;
    const trainTarget = target === 'hypeTrain' || isHypeLevel;
    const subTabs: { id: DesignSection; icon: string }[] = [
        { id: 'editor', icon: '🖥️' }, { id: 'layouts', icon: '🧩' }, { id: 'colors', icon: '🎨' }, { id: 'animation', icon: '✨' },
    ];
    const status = (tg: DesignTarget) => (tg === 'general' ? '' : ownDesign(design, tg) ? ` · ${t('eventAlertsView.design.own')}` : ` · ${t('eventAlertsView.design.inherits')}`);

    return (
        <div className="space-y-4">
            {/* Qué se edita y sus acciones, en una sola barra */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                    <label className="flex-1 min-w-0">
                        <span className="block text-xs 3xl:text-sm font-bold uppercase text-ds-soft mb-1">{t('eventAlertsView.design.targetTitle')}</span>
                        <select className={inputClass} value={isHypeLevel ? 'hypeTrain' : target} onChange={e => onTargetChange(e.target.value as DesignTarget)}>
                            {(['general', ...EVENT_TYPES] as DesignTarget[]).map(tg => <option key={tg} value={tg}>{t(`eventAlertsView.events.${tg}`)}{status(tg)}</option>)}
                        </select>
                    </label>
                    {trainTarget && design.events.hypeTrain && (
                        <label className="lg:w-56">
                            <span className="block text-xs 3xl:text-sm font-bold uppercase text-ds-soft mb-1">{t('eventAlertsView.design.hypeLevels')}</span>
                            <select className={inputClass} value={target} onChange={e => onTargetChange(e.target.value as DesignTarget)}>
                                <option value="hypeTrain">{t('eventAlertsView.design.allLevels')}</option>
                                {HYPE_LEVELS.map(l => <option key={l} value={`hype-${l}`}>{l === 'completed' ? t('eventAlertsView.design.completed') : t('eventAlertsView.design.level', { n: l })}{status(`hype-${l}` as DesignTarget)}</option>)}
                            </select>
                        </label>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        {inherits ? (
                            <button className="ds-btn ds-btn--primary" onClick={createOwn}>{t('eventAlertsView.design.createOwn')}</button>
                        ) : (
                            <>
                                {target !== 'general' && (
                                    <button className={btnGray} onClick={removeOwn}><RotateCcw className="w-4 h-4" /> {isHypeLevel ? t('eventAlertsView.design.useTrain') : t('eventAlertsView.design.useGeneral')}</button>
                                )}
                                {!isHypeLevel && (
                                    <>
                                        <select className={`${inputClass} !w-auto`} value={copyTo} onChange={e => setCopyTo(e.target.value as AlertEventType)} aria-label={t('eventAlertsView.design.copyTo')}>
                                            <option value="">{t('eventAlertsView.design.copyTo')}</option>
                                            {EVENT_TYPES.filter(e => e !== target).map(e => <option key={e} value={e}>{t(`eventAlertsView.events.${e}`)}</option>)}
                                        </select>
                                        <button className={btnGray} onClick={doCopy} disabled={!copyTo}><Copy className="w-4 h-4" /> {t('eventAlertsView.design.copy')}</button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
                {inherits && (
                    <p className="text-sm 3xl:text-base text-ds-accent-text bg-ds-accent/10 rounded-lg px-3 py-2">
                        {isHypeLevel ? t('eventAlertsView.design.inheritsTrain') : t('eventAlertsView.design.inheritsGeneral', { event: t(`eventAlertsView.events.${target}`) })}
                    </p>
                )}
                {!inherits && (
                    <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-ds-bg w-fit">
                        {subTabs.map(st => <button key={st.id} className={seg(section === st.id)} onClick={() => setSection(st.id)}>{st.icon} {t(`eventAlertsView.design.sections.${st.id}`)}</button>)}
                    </div>
                )}
            </div>

            {!inherits && section === 'layouts' && (
                <Card title={t('eventAlertsView.design.presetsTitle')} description={t('eventAlertsView.design.presetsDescription')}>
                    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
                        {LAYOUT_PRESET_IDS.map(id => {
                            const preview = buildLayoutPreset(id, { ...shown, canvas }, anchor);
                            const b = contentBox(preview);
                            return (
                                <button key={id} className="p-2 rounded-lg border border-ds-border hover:border-ds-accent transition-all text-left"
                                    onClick={() => { if (window.confirm(t('eventAlertsView.design.presetConfirm'))) { update(d => buildLayoutPreset(id, { ...d, canvas }, anchor)); setSection('editor'); } }}>
                                    {/* Encuadrada en la alerta (en la escena entera se vería diminuta) */}
                                    <div className="rounded-lg overflow-hidden pointer-events-none" style={{ background: CHECKER_BG }}>
                                        <ScaledCanvas width={b.width} height={b.height}>
                                            <div style={{ position: 'absolute', left: -b.x, top: -b.y }}>
                                                <EventAlertRenderer design={preview} data={sampleData} phase="static" preview />
                                            </div>
                                        </ScaledCanvas>
                                    </div>
                                    <p className="text-sm 3xl:text-base font-bold text-ds-text mt-2">{t(`eventAlertsView.design.presets.${id}`)}</p>
                                    <p className="text-xs 3xl:text-sm text-ds-soft">{t(`eventAlertsView.design.presetsHint.${id}`)}</p>
                                </button>
                            );
                        })}
                    </div>
                </Card>
            )}

            {!inherits && section === 'colors' && (
                <Card title={t('eventAlertsView.design.themesTitle')} description={t('eventAlertsView.design.themesDescription')}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-7 gap-3">
                        {COLOR_THEMES.map(c => (
                            <button key={c.id} onClick={() => update(d => applyColorTheme(d, c))} className="text-left p-3 rounded-lg border border-ds-border hover:border-ds-accent transition-all">
                                <div className="flex h-8 rounded-lg overflow-hidden mb-2 border border-ds-border/10">
                                    {c.swatch.map((sw, i) => <span key={i} className="flex-1" style={{ background: sw === '#00000000' ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 10px 10px' : sw }} />)}
                                </div>
                                <p className="text-sm 3xl:text-base font-bold text-ds-text">{t(`eventAlertsView.design.themes.${c.id}`)}</p>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs 3xl:text-sm text-ds-soft mt-3">{t('eventAlertsView.design.themesHint')}</p>
                </Card>
            )}

            {!inherits && section === 'animation' && (
                <Card title={t('eventAlertsView.design.alertAnimTitle')} description={t('eventAlertsView.design.alertAnimDescription')}>
                    <AnimationEditor value={shown.animation} onChange={a => update(d => ({ ...d, animation: a }))} />
                    <p className="text-xs 3xl:text-sm text-ds-soft mt-3">{t('eventAlertsView.design.elementAnimHint')}</p>
                </Card>
            )}

            {(inherits || section === 'editor') && (
                <div className={inherits ? 'opacity-60 pointer-events-none select-none' : ''}>
                    <OverlayCanvasEditor
                        key={target}
                        canvas={canvas}
                        elements={elements}
                        onRectChange={onRectChange}
                        onToggle={inherits ? undefined : onToggle}
                        title={t('eventAlertsView.design.editorTitle')}
                        description={t('eventAlertsView.design.editorDescription')}
                        initialSelected={shown.texts[0] ? `text:${shown.texts[0].id}` : 'card'}
                        selectedExtra={selectedExtra}
                        layersActions={inherits ? undefined : <button className={btnGray} onClick={addText}><Plus className="w-4 h-4" /> {t('eventAlertsView.design.addText')}</button>}
                        onCanvasChange={inherits ? undefined : onCanvasChange}
                    >
                        <EventAlertRenderer design={{ ...shown, canvas }} data={sampleData} phase="static" preview />
                    </OverlayCanvasEditor>
                </div>
            )}
        </div>
    );
}
