import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Select } from '../../../../components/ds';
import { Card } from '../../../../components/overlay-editor/ui';
import { MAX_SLOTS, MAX_TARGETS, emptySlot, propsFor, type Slot, type SlotKind } from '../../../../components/promo-overlay/slots';
import type { PromoDesign } from '../../../../components/promo-overlay/types';

const KINDS: SlotKind[] = ['color', 'text', 'font'];

/**
 * Qué puede cambiar el streamer de esta plantilla. Cada ajuste (un color, un texto fijo o una tipografía) apunta a una o más propiedades de
 * elementos del diseño; el streamer guarda un solo valor por ajuste y el overlay lo aplica sobre una copia. Lo que no se declara aquí no
 * se puede tocar. Se guarda junto con el diseño (`slots`).
 */
export default function SlotsPanel({ design, onChange }: { design: PromoDesign; onChange: (slots: Slot[]) => void }) {
    const { t } = useTranslation('promo');
    const slots = design.slots ?? [];
    const patch = (id: string, p: Partial<Slot>) => onChange(slots.map(s => (s.id === id ? { ...s, ...p } : s)));

    // Los destinos posibles de un tipo de ajuste: cada propiedad de cada elemento que la acepta.
    const options = (kind: SlotKind) => design.elements.flatMap(e => propsFor(kind, e.kind).map(prop => ({
        value: `${e.id}|${prop}`, label: `${e.name} · ${t(`admin.slots.prop.${prop}`)}`,
    })));

    return (
        <Card title={t('admin.slots.title')} description={t('admin.slots.description')}>
            <div className="space-y-4">
                {slots.length === 0 && <p className="text-sm text-ds-soft">{t('admin.slots.empty')}</p>}
                {slots.map(slot => {
                    const opts = options(slot.kind);
                    return (
                        <div key={slot.id} className="rounded-lg border border-ds-border p-3 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                <Field label={t('admin.slots.kind')}>
                                    <Select value={slot.kind} onChange={e => patch(slot.id, { kind: e.target.value as SlotKind, targets: [] })}>
                                        {KINDS.map(k => <option key={k} value={k}>{t(`admin.slots.kinds.${k}`)}</option>)}
                                    </Select>
                                </Field>
                                <Field label={t('admin.slots.labelEs')}><Input value={slot.labelEs} maxLength={60} onChange={e => patch(slot.id, { labelEs: e.target.value })} /></Field>
                                <Field label={t('admin.slots.labelEn')}><Input value={slot.labelEn} maxLength={60} onChange={e => patch(slot.id, { labelEn: e.target.value })} /></Field>
                                {slot.kind === 'text' && (
                                    <Field label={t('admin.slots.maxLength')}>
                                        <Input type="number" min={1} max={200} value={slot.maxLength} onChange={e => patch(slot.id, { maxLength: Math.min(200, Math.max(1, Number(e.target.value) || 1)) })} />
                                    </Field>
                                )}
                            </div>
                            <Field label={t('admin.slots.targets')} hint={t('admin.slots.targetsHint')}>
                                <div className="space-y-2">
                                    {slot.targets.map((tg, i) => (
                                        <div key={i} className="flex gap-2">
                                            <div className="flex-1 min-w-0">
                                                <Select value={`${tg.elementId}|${tg.prop}`} onChange={e => {
                                                    const [elementId, prop] = e.target.value.split('|');
                                                    patch(slot.id, { targets: slot.targets.map((x, j) => (j === i ? { elementId, prop } : x)) });
                                                }}>
                                                    {!opts.some(o => o.value === `${tg.elementId}|${tg.prop}`) && <option value={`${tg.elementId}|${tg.prop}`}>{t('admin.slots.missing')}</option>}
                                                    {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </Select>
                                            </div>
                                            <Button variant="ghost" icon={<Trash2 />} aria-label={t('admin.design.element.delete')} onClick={() => patch(slot.id, { targets: slot.targets.filter((_, j) => j !== i) })} />
                                        </div>
                                    ))}
                                    {slot.targets.length < MAX_TARGETS && opts.length > 0 && (
                                        <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => { const [elementId, prop] = opts[0].value.split('|'); patch(slot.id, { targets: [...slot.targets, { elementId, prop }] }); }}>{t('admin.slots.addTarget')}</Button>
                                    )}
                                    {opts.length === 0 && <p className="text-sm text-ds-soft">{t('admin.slots.noTargets')}</p>}
                                </div>
                            </Field>
                            <Button variant="ghost" icon={<Trash2 />} onClick={() => onChange(slots.filter(s => s.id !== slot.id))}>{t('admin.slots.remove')}</Button>
                        </div>
                    );
                })}
                {slots.length < MAX_SLOTS && <Button variant="secondary" icon={<Plus />} onClick={() => onChange([...slots, emptySlot('color')])}>{t('admin.slots.add')}</Button>}
            </div>
        </Card>
    );
}
