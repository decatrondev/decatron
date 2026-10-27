import { useTranslation } from 'react-i18next';
import { Field, Select, Slider } from '../../../../components/overlay-editor/ui';
import { LOOP_TYPES } from '../../../../components/promo-overlay/defaults';
import type { AnimationStep, AnimationType, Direction, Easing, Loop, LoopType } from '../../../../components/promo-overlay/types';

// Los mismos tipos de animación, direcciones y curvas que Event Alerts (sus textos ya están traducidos en el namespace overlays).
const ANIM_TYPES: AnimationType[] = ['none', 'fade', 'slide', 'slide-bounce', 'bounce', 'zoom', 'rotate', 'flip', 'glitch'];
const WITH_DIRECTION: AnimationType[] = ['slide', 'slide-bounce', 'flip'];
const DIRECTIONS: Direction[] = ['left', 'right', 'top', 'bottom'];
const EASINGS: Easing[] = ['ease', 'ease-out', 'ease-in', 'ease-in-out', 'linear'];
const A = 'overlays:eventAlertsView.design.anim';

/** Una animación de entrada o de salida. */
export function StepFields({ label, value, onChange }: { label: string; value: AnimationStep; onChange: (s: AnimationStep) => void }) {
    const { t } = useTranslation(['promo', 'overlays']);
    const set = (patch: Partial<AnimationStep>) => onChange({ ...value, ...patch });
    return (
        <div className="space-y-2">
            <p className="text-xs 3xl:text-sm font-bold uppercase text-ds-soft">{label}</p>
            <Select value={value.type} onChange={v => set({ type: v })} options={ANIM_TYPES.map(a => ({ value: a, label: t(`${A}.${a}`) }))} />
            {value.type !== 'none' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {WITH_DIRECTION.includes(value.type) && (
                        <Field label={t(`${A}.direction`)}>
                            <Select value={value.direction} onChange={v => set({ direction: v })} options={DIRECTIONS.map(d => ({ value: d, label: t(`${A}.directions.${d}`) }))} />
                        </Field>
                    )}
                    <Field label={t(`${A}.easing`)}>
                        <Select value={value.easing} onChange={v => set({ easing: v })} options={EASINGS.map(e => ({ value: e, label: t(`${A}.easings.${e}`) }))} />
                    </Field>
                    <Field label={t(`${A}.duration`)}><Slider value={value.durationMs} min={100} max={3000} step={50} onChange={v => set({ durationMs: v })} suffix="ms" /></Field>
                    <Field label={t(`${A}.delay`)}><Slider value={value.delayMs} min={0} max={3000} step={50} onChange={v => set({ delayMs: v })} suffix="ms" /></Field>
                </div>
            )}
        </div>
    );
}

/** La animación continua de un elemento (pulso, flotar, brillo…). */
export function LoopFields({ value, onChange }: { value: Loop; onChange: (l: Loop) => void }) {
    const { t } = useTranslation('promo');
    const set = (patch: Partial<Loop>) => onChange({ ...value, ...patch });
    return (
        <div className="space-y-2">
            <p className="text-xs 3xl:text-sm font-bold uppercase text-ds-soft">{t('admin.design.loop.title')}</p>
            <Select value={value.type} onChange={(v: LoopType) => set({ type: v })} options={LOOP_TYPES.map(l => ({ value: l, label: t(`admin.design.loop.${l}`) }))} />
            {value.type !== 'none' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={t('admin.design.loop.duration')}><Slider value={value.durationMs} min={300} max={10000} step={100} onChange={v => set({ durationMs: v })} suffix="ms" /></Field>
                    <Field label={t('admin.design.loop.delay')}><Slider value={value.delayMs} min={0} max={5000} step={100} onChange={v => set({ delayMs: v })} suffix="ms" /></Field>
                </div>
            )}
        </div>
    );
}
