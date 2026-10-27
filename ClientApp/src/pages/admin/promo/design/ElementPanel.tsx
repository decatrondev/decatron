import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, ChevronUp, Copy, Image as ImageIcon, Trash2 } from 'lucide-react';
import { ColorField, Field, NumberInput, Select, Slider, Toggle, inputClass } from '../../../../components/overlay-editor/ui';
import { useBrand } from '../../../../brand/BrandContext';
import { AssetPicker } from '../../brand/BrandLibrary';
import { BOX_SHADOWS, SHAPE_CUTS, TEXT_SHADOWS } from '../../../../components/promo-overlay/defaults';
import { PROMO_FONTS, fontByFamily, nearestWeight } from '../../../../components/promo-overlay/fonts';
import type { Border, Fill, Glow, PromoElement } from '../../../../components/promo-overlay/types';
import { PROMO_ICONS } from '../../../../components/promo/icons';
import { LoopFields, StepFields } from './AnimationFields';

type Patch = (patch: Record<string, unknown>) => void;

/** Un grupo de controles que se pliega, para que el panel de un elemento no sea una pared de campos. */
function Group({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-lg border border-ds-border">
            <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm 3xl:text-base font-bold text-ds-text">
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{title}
            </button>
            {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
        </div>
    );
}

function FillFields({ label, value, onChange }: { label: string; value: Fill; onChange: (f: Fill) => void }) {
    const { t } = useTranslation('promo');
    const set = (patch: Partial<Fill>) => onChange({ ...value, ...patch });
    return (
        <div className="space-y-2">
            <Field label={label}>
                <Select value={value.type} onChange={v => set({ type: v })} options={(['color', 'gradient', 'transparent'] as const).map(x => ({ value: x, label: t(`admin.design.fill.${x}`) }))} />
            </Field>
            {value.type === 'color' && <ColorField label={t('admin.design.fill.color')} value={value.color} onChange={v => set({ color: v, gradient: { ...value.gradient, color1: v } })} />}
            {value.type === 'gradient' && (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                        <ColorField label={t('admin.design.fill.color1')} value={value.gradient.color1} onChange={v => set({ gradient: { ...value.gradient, color1: v } })} />
                        <ColorField label={t('admin.design.fill.color2')} value={value.gradient.color2} onChange={v => set({ gradient: { ...value.gradient, color2: v } })} />
                    </div>
                    <Field label={t('admin.design.fill.angle')}><Slider value={value.gradient.angle} min={0} max={360} step={5} suffix="°" onChange={v => set({ gradient: { ...value.gradient, angle: v } })} /></Field>
                </div>
            )}
        </div>
    );
}

function BorderFields({ value, onChange }: { value: Border; onChange: (b: Border) => void }) {
    const { t } = useTranslation('promo');
    return (
        <div className="space-y-2">
            <Toggle checked={value.enabled} onChange={v => onChange({ ...value, enabled: v })} label={t('admin.design.border.enabled')} />
            {value.enabled && (
                <div className="grid grid-cols-2 gap-3">
                    <ColorField label={t('admin.design.border.color')} value={value.color} onChange={v => onChange({ ...value, color: v })} />
                    <Field label={t('admin.design.border.width')}><NumberInput value={value.width} min={0} max={50} onChange={v => onChange({ ...value, width: v })} /></Field>
                </div>
            )}
        </div>
    );
}

function GlowFields({ value, onChange }: { value: Glow; onChange: (g: Glow) => void }) {
    const { t } = useTranslation('promo');
    return (
        <div className="space-y-2">
            <Toggle checked={value.enabled} onChange={v => onChange({ ...value, enabled: v })} label={t('admin.design.glow.enabled')} />
            {value.enabled && (
                <div className="grid grid-cols-2 gap-3">
                    <ColorField label={t('admin.design.glow.color')} value={value.color} onChange={v => onChange({ ...value, color: v })} />
                    <Field label={t('admin.design.glow.blur')}><Slider value={value.blur} min={0} max={120} step={2} suffix="px" onChange={v => onChange({ ...value, blur: v })} /></Field>
                </div>
            )}
        </div>
    );
}

function ShadowField({ value, onChange }: { value: string; onChange: (css: string) => void }) {
    const { t } = useTranslation('promo');
    const id = BOX_SHADOWS.find(s => s.css === value)?.id ?? 'none';
    return (
        <Field label={t('admin.design.shadow.label')}>
            <Select value={id} onChange={v => onChange(BOX_SHADOWS.find(s => s.id === v)?.css ?? '')} options={BOX_SHADOWS.map(s => ({ value: s.id, label: t(`admin.design.shadow.${s.id}`) }))} />
        </Field>
    );
}

interface Props {
    el: PromoElement;
    icons: string[];
    onChange: Patch;
    onDuplicate: () => void;
    onDelete: () => void;
    onMove: (dir: -1 | 1) => void;
    canUp: boolean;
    canDown: boolean;
}

/** Todo lo que se puede cambiar de un elemento: nombre, apariencia según su tipo, animaciones. */
export default function ElementPanel({ el, icons, onChange, onDuplicate, onDelete, onMove, canUp, canDown }: Props) {
    const { t } = useTranslation(['promo', 'overlays']);
    const { data, resolve, reload } = useBrand();
    const [picking, setPicking] = useState(false);
    const [pickError, setPickError] = useState<string | null>(null);
    const imageRef = el.kind === 'image' ? el.ref : '';

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={!canUp} onClick={() => onMove(1)} title={t('admin.design.element.up')}><ChevronUp className="w-4 h-4" /></button>
                <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={!canDown} onClick={() => onMove(-1)} title={t('admin.design.element.down')}><ChevronDown className="w-4 h-4" /></button>
                <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={onDuplicate}><Copy className="w-4 h-4" /> {t('admin.design.element.duplicate')}</button>
                <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={onDelete}><Trash2 className="w-4 h-4" /> {t('admin.design.element.delete')}</button>
            </div>
            <Field label={t('admin.design.element.name')}>
                <input className={inputClass} value={el.name} maxLength={60} onChange={e => onChange({ name: e.target.value.replace(/[<>]/g, '') })} />
            </Field>

            <Group title={t('admin.design.group.look')} defaultOpen>
                {el.kind === 'shape' && <>
                    <FillFields label={t('admin.design.shape.fill')} value={el.fill} onChange={v => onChange({ fill: v })} />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('admin.design.shape.radius')}><NumberInput value={el.radius} min={0} max={2000} onChange={v => onChange({ radius: v })} /></Field>
                        <Field label={t('admin.design.shape.backdropBlur')}><Slider value={el.backdropBlur} min={0} max={40} suffix="px" onChange={v => onChange({ backdropBlur: v })} /></Field>
                        <Field label={t('admin.design.shape.cut')}>
                            <Select value={el.cut} onChange={v => onChange({ cut: v })} options={SHAPE_CUTS.map(c => ({ value: c, label: t(`admin.design.shape.cuts.${c}`) }))} />
                        </Field>
                        {el.cut !== 'none' && <Field label={t('admin.design.shape.cutSize')}><NumberInput value={el.cutSize} min={0} max={500} onChange={v => onChange({ cutSize: v })} /></Field>}
                    </div>
                    <BorderFields value={el.border} onChange={v => onChange({ border: v })} />
                    <ShadowField value={el.shadow} onChange={v => onChange({ shadow: v })} />
                    <GlowFields value={el.glow} onChange={v => onChange({ glow: v })} />
                </>}

                {el.kind === 'image' && <>
                    <Field label={t('admin.design.image.source')}>
                        <Select value={el.source} onChange={v => onChange({ source: v })} options={[{ value: 'piece', label: t('admin.design.image.fromPiece') }, { value: 'library', label: t('admin.design.image.fromLibrary') }]} />
                    </Field>
                    {el.source === 'library' && (
                        <div className="space-y-1">
                            <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setPicking(true)}><ImageIcon className="w-4 h-4" /> {t(el.ref ? 'admin.design.image.change' : 'admin.design.image.choose')}</button>
                            <p className="text-xs 3xl:text-sm text-ds-soft">{el.ref ? (resolve(el.ref)?.name ?? el.ref) : t('admin.design.image.none')}</p>
                            {pickError && <p className="text-xs text-ds-danger">{pickError}</p>}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('admin.design.image.fit')}>
                            <Select value={el.fit} onChange={v => onChange({ fit: v })} options={(['contain', 'cover', 'fill'] as const).map(f => ({ value: f, label: t(`admin.design.image.fits.${f}`) }))} />
                        </Field>
                        <Field label={t('admin.design.shape.radius')}><NumberInput value={el.radius} min={0} max={2000} onChange={v => onChange({ radius: v })} /></Field>
                    </div>
                    <BorderFields value={el.border} onChange={v => onChange({ border: v })} />
                    <ShadowField value={el.shadow} onChange={v => onChange({ shadow: v })} />
                    <GlowFields value={el.glow} onChange={v => onChange({ glow: v })} />
                </>}

                {el.kind === 'icon' && <>
                    <Field label={t('admin.design.icon.source')}>
                        <Select value={el.source} onChange={v => onChange({ source: v })} options={[{ value: 'piece', label: t('admin.design.icon.fromPiece') }, { value: 'fixed', label: t('admin.design.icon.fixed') }]} />
                    </Field>
                    {el.source === 'fixed' && (
                        <Field label={t('admin.design.icon.icon')}>
                            <Select value={el.icon} onChange={v => onChange({ icon: v })} options={icons.filter(i => PROMO_ICONS[i]).map(i => ({ value: i, label: i }))} />
                        </Field>
                    )}
                    <ColorField label={t('admin.design.icon.color')} value={el.color} onChange={v => onChange({ color: v })} />
                    <Field label={t('admin.design.icon.strokeWidth')}><Slider value={el.strokeWidth} min={0.5} max={6} step={0.25} onChange={v => onChange({ strokeWidth: v })} /></Field>
                    <GlowFields value={el.glow} onChange={v => onChange({ glow: v })} />
                </>}

                {el.kind === 'text' && <>
                    <Field label={t('admin.design.text.template')} hint={t('admin.design.text.templateHint', { vars: ['title', 'body', 'channel', 'commands', 'link'].map(v => `{{${v}}}`).join(' ') })}>
                        <textarea className={inputClass} rows={2} maxLength={400} value={el.template} onChange={e => onChange({ template: e.target.value.replace(/[<>]/g, '') })} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('admin.design.text.font')}>
                            <select className={inputClass} value={el.fontFamily} onChange={e => onChange({ fontFamily: e.target.value, fontWeight: nearestWeight(e.target.value, el.fontWeight) })}>
                                {(['display', 'sans', 'tech', 'fun', 'mono'] as const).map(g => (
                                    <optgroup key={g} label={t(`admin.design.text.groups.${g}`)}>
                                        {PROMO_FONTS.filter(f => f.group === g).map(f => <option key={f.family} value={f.family}>{f.family}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                        </Field>
                        <Field label={t('admin.design.text.weight')}>
                            <Select value={String(nearestWeight(el.fontFamily, el.fontWeight))} onChange={v => onChange({ fontWeight: Number(v) })}
                                options={(fontByFamily(el.fontFamily)?.weights ?? [400]).map(w => ({ value: String(w), label: String(w) }))} />
                        </Field>
                        <Field label={t('admin.design.text.size')}><NumberInput value={el.fontSize} min={6} max={400} onChange={v => onChange({ fontSize: v })} /></Field>
                        <ColorField label={t('admin.design.text.color')} value={el.color} onChange={v => onChange({ color: v })} />
                        <Field label={t('admin.design.text.align')}>
                            <Select value={el.align} onChange={v => onChange({ align: v })} options={(['left', 'center', 'right'] as const).map(a => ({ value: a, label: t(`admin.design.text.aligns.${a}`) }))} />
                        </Field>
                        <Field label={t('admin.design.text.valign')}>
                            <Select value={el.verticalAlign} onChange={v => onChange({ verticalAlign: v })} options={(['top', 'center', 'bottom'] as const).map(a => ({ value: a, label: t(`admin.design.text.valigns.${a}`) }))} />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('admin.design.text.lineHeight')}><Slider value={el.lineHeight} min={0.8} max={2} step={0.05} onChange={v => onChange({ lineHeight: v })} /></Field>
                        <Field label={t('admin.design.text.letterSpacing')}><Slider value={el.letterSpacing} min={-2} max={20} step={0.5} suffix="px" onChange={v => onChange({ letterSpacing: v })} /></Field>
                        <Field label={t('admin.design.text.maxLines')} hint={t('admin.design.text.maxLinesHint')}><NumberInput value={el.maxLines} min={0} max={20} onChange={v => onChange({ maxLines: v })} /></Field>
                        <Field label={t('admin.design.text.shadow')}>
                            <Select value={el.shadow} onChange={v => onChange({ shadow: v })} options={TEXT_SHADOWS.map(s => ({ value: s, label: t(`admin.design.text.shadows.${s}`) }))} />
                        </Field>
                    </div>
                    {el.shadow === 'glow' && <ColorField label={t('admin.design.text.glowColor')} value={el.glowColor} onChange={v => onChange({ glowColor: v })} />}
                    <div className="grid grid-cols-2 gap-3">
                        <Toggle checked={el.italic} onChange={v => onChange({ italic: v })} label={t('admin.design.text.italic')} />
                        <Toggle checked={el.uppercase} onChange={v => onChange({ uppercase: v })} label={t('admin.design.text.uppercase')} />
                    </div>
                    <p className="text-xs 3xl:text-sm font-bold uppercase text-ds-soft pt-1">{t('admin.design.text.box')}</p>
                    <FillFields label={t('admin.design.text.boxFill')} value={el.fill} onChange={v => onChange({ fill: v })} />
                    <BorderFields value={el.border} onChange={v => onChange({ border: v })} />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('admin.design.shape.radius')}><NumberInput value={el.radius} min={0} max={500} onChange={v => onChange({ radius: v })} /></Field>
                        <Field label={t('admin.design.text.padding')}><NumberInput value={el.padding} min={0} max={300} onChange={v => onChange({ padding: v })} /></Field>
                    </div>
                </>}

                {el.kind === 'qr' && <>
                    <p className="text-xs 3xl:text-sm text-ds-soft">{t('admin.design.qr.hint')}</p>
                    <div className="grid grid-cols-2 gap-3">
                        <ColorField label={t('admin.design.qr.color')} value={el.color} onChange={v => onChange({ color: v })} />
                        <ColorField label={t('admin.design.qr.background')} value={el.background} onChange={v => onChange({ background: v })} />
                        <Field label={t('admin.design.shape.radius')}><NumberInput value={el.radius} min={0} max={500} onChange={v => onChange({ radius: v })} /></Field>
                        <Field label={t('admin.design.text.padding')}><NumberInput value={el.padding} min={0} max={100} onChange={v => onChange({ padding: v })} /></Field>
                    </div>
                    <BorderFields value={el.border} onChange={v => onChange({ border: v })} />
                </>}
            </Group>

            <Group title={t('admin.design.group.placement')}>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('admin.design.common.opacity')}><Slider value={el.opacity} min={0} max={100} suffix="%" onChange={v => onChange({ opacity: v })} /></Field>
                    <Field label={t('admin.design.common.rotation')}><Slider value={el.rotation} min={-180} max={180} suffix="°" onChange={v => onChange({ rotation: v })} /></Field>
                </div>
            </Group>

            <Group title={t('admin.design.group.motion')}>
                <StepFields label={t('overlays:eventAlertsView.design.anim.enter')} value={el.animation.enter} onChange={s => onChange({ animation: { ...el.animation, enter: s } })} />
                <StepFields label={t('overlays:eventAlertsView.design.anim.exit')} value={el.animation.exit} onChange={s => onChange({ animation: { ...el.animation, exit: s } })} />
                <LoopFields value={el.loop} onChange={l => onChange({ loop: l })} />
            </Group>

            {picking && (
                <AssetPicker assets={data?.assets ?? []} current={imageRef || null} onClose={() => setPicking(false)}
                    onPick={ref => { onChange({ ref }); setPicking(false); }}
                    onUploaded={() => { void reload(); }} onError={setPickError} />
            )}
        </div>
    );
}
