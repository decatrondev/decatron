import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Image as ImageIcon, Plus, QrCode, Save, Shapes, Smile, Type } from 'lucide-react';
import { Alert, Button, Field, Input, Select, Tabs } from '../../../components/ds';
import { ToggleRow } from '../../../components/dashboard/config';
import OverlayCanvasEditor, { type EditorElement } from '../../../components/overlay-editor/OverlayCanvasEditor';
import { Card } from '../../../components/overlay-editor/ui';
import PromoDesignRenderer from '../../../components/promo-overlay/PromoDesignRenderer';
import { newElement } from '../../../components/promo-overlay/defaults';
import type { PromoElementKind } from '../../../components/promo-overlay/types';
import { errorCodes, promoAdminApi } from './api';
import ElementPanel from './design/ElementPanel';
import SlotsPanel from './design/SlotsPanel';
import { StepFields } from './design/AnimationFields';
import { addElement, duplicateElement, moveElement, patchElement, removeElement } from './design/designOps';
import { PreviewPane, errorText, sampleContent, sampleVars, useResolveImage, zonePlacement, type Lang } from './shared';
import type { PromoOptions, PromoTemplate, PromoZone } from './types';

const KINDS: { kind: PromoElementKind; icon: React.ReactNode }[] = [
    { kind: 'shape', icon: <Shapes className="w-4 h-4" /> }, { kind: 'image', icon: <ImageIcon className="w-4 h-4" /> }, { kind: 'icon', icon: <Smile className="w-4 h-4" /> },
    { kind: 'text', icon: <Type className="w-4 h-4" /> }, { kind: 'qr', icon: <QrCode className="w-4 h-4" /> },
];

/**
 * El editor de una plantilla: el mismo editor de lienzo de los demás overlays (arrastrar, redimensionar, capas) más el panel de cada
 * elemento y la vista previa con su posición real. Todo lo que se cambia aquí es lo que sale en OBS (mismo renderer).
 */
export function TemplateEditor({ initial, zones, options, lang, onLang, onBack, onSaved }: {
    initial: PromoTemplate; zones: PromoZone[]; options: PromoOptions; lang: Lang; onLang: (l: Lang) => void; onBack: () => void; onSaved: () => Promise<void>;
}) {
    const { t, i18n } = useTranslation(['promo', 'overlays']);
    const [draft, setDraft] = useState<PromoTemplate>(initial);
    const [selected, setSelected] = useState<string>(initial.design.elements[0]?.id ?? '');
    const [tab, setTab] = useState<'general' | 'design' | 'animation' | 'slots' | 'preview'>(initial.id ? 'design' : 'general');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resolveImage = useResolveImage();
    const tl = i18n.getFixedT(lang, 'promo');
    const design = draft.design;

    const setDesign = useCallback((fn: (d: PromoTemplate['design']) => PromoTemplate['design']) => setDraft(p => ({ ...p, design: fn(p.design) })), []);
    const set = <K extends keyof PromoTemplate>(k: K, v: PromoTemplate[K]) => setDraft(p => ({ ...p, [k]: v }));

    const save = async () => {
        setSaving(true); setError(null);
        try { await promoAdminApi.upsertTemplate(draft); await onSaved(); }
        catch (e) { setError(errorText(t, errorCodes(e))); }
        finally { setSaving(false); }
    };

    const editorElements: EditorElement[] = design.elements.map(e => ({ id: e.id, label: e.name, enabled: e.enabled, x: e.x, y: e.y, width: e.width, height: e.height }));
    const content = sampleContent(tl);
    const vars = sampleVars(tl, content.link);
    const sel = design.elements.find(e => e.id === selected);
    const selIndex = design.elements.findIndex(e => e.id === selected);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" icon={<ArrowLeft />} onClick={onBack}>{t('admin.design.back')}</Button>
                <Button loading={saving} icon={<Save />} onClick={save}>{t('admin.editor.save')}</Button>
            </div>
            {error && <Alert tone="danger">{error}</Alert>}

            <Tabs items={[{ id: 'general', label: t('admin.design.tabs.general') }, { id: 'design', label: t('admin.design.tabs.design') }, { id: 'animation', label: t('admin.design.tabs.animation') }, { id: 'slots', label: t('admin.design.tabs.slots') }, { id: 'preview', label: t('admin.design.tabs.preview') }]} value={tab} onChange={id => setTab(id as typeof tab)} />

            {tab === 'general' && (
            <Card title={t(draft.id ? 'admin.templates.titleEdit' : 'admin.templates.titleNew')} description={t('admin.templates.hint')}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Field label={t('admin.templates.nameEs')}><Input value={draft.nameEs} maxLength={80} onChange={e => set('nameEs', e.target.value)} /></Field>
                    <Field label={t('admin.templates.nameEn')}><Input value={draft.nameEn} maxLength={80} onChange={e => set('nameEn', e.target.value)} /></Field>
                    <Field label={t('admin.templates.key')} hint={t('admin.templates.keyHint')}><Input value={draft.key} maxLength={40} disabled={draft.id > 0} onChange={e => set('key', e.target.value)} /></Field>
                    <Field label={t('admin.templates.zone')}>
                        <Select value={draft.zone} onChange={e => set('zone', e.target.value)}>
                            {zones.map(z => <option key={z.key} value={z.key}>{lang === 'en' && z.nameEn ? z.nameEn : z.nameEs}</option>)}
                        </Select>
                    </Field>
                </div>
                <div className="mt-3 max-w-sm"><ToggleRow title={t('admin.templates.enabled')} checked={draft.isEnabled} onChange={v => set('isEnabled', v)} /></div>
            </Card>
            )}

            {tab === 'design' && <>
            {/* Los tiradores de redimensionar sobresalen 6 px del lienzo: en móvil, con la ficha a todo el ancho, empujaban la página. */}
            <div className="overflow-x-clip">
            <OverlayCanvasEditor
                canvas={design.canvas}
                elements={editorElements}
                selectedId={selected}
                onRectChange={(id, rect) => setDesign(d => patchElement(d, id, rect as Record<string, unknown>))}
                onToggle={(id, enabled) => setDesign(d => patchElement(d, id, { enabled }))}
                onCanvasChange={canvas => setDesign(d => ({ ...d, canvas }))}
                title={t('admin.design.canvasTitle')}
                description={t('admin.design.canvasDescription')}
                layersActions={
                    <div className="flex flex-wrap gap-1">
                        {KINDS.map(k => (
                            <button key={k.kind} type="button" className="ds-btn ds-btn--secondary ds-btn--sm" title={`${t('admin.design.add.title')}: ${t(`admin.design.add.${k.kind}`)}`}
                                onClick={() => { const el = newElement(k.kind); setDesign(d => addElement(d, el)); setSelected(el.id); }}>
                                <Plus className="w-3 h-3" />{k.icon}<span className="hidden sm:inline">{t(`admin.design.add.${k.kind}`)}</span>
                            </button>
                        ))}
                    </div>
                }
                selectedExtra={() => sel ? (
                    <ElementPanel
                        key={sel.id}
                        el={sel}
                        icons={options.icons}
                        onChange={patch => setDesign(d => patchElement(d, sel.id, patch))}
                        onDuplicate={() => setDesign(d => { const r = duplicateElement(d, sel.id); if (r.newId) setSelected(r.newId); return r.design; })}
                        onDelete={() => setDesign(d => { const next = removeElement(d, sel.id); setSelected(next.elements[Math.max(0, selIndex - 1)]?.id ?? ''); return next; })}
                        onMove={dir => setDesign(d => moveElement(d, sel.id, dir))}
                        canUp={selIndex < design.elements.length - 1}
                        canDown={selIndex > 0}
                    />
                ) : <p className="text-sm text-ds-soft">{t('admin.design.noElements')}</p>}
            >
                <PromoDesignRenderer design={design} content={content} vars={vars} resolveImage={resolveImage} editing />
            </OverlayCanvasEditor>
            </div>
            </>}

            {tab === 'animation' && (
                <Card title={t('admin.design.wholeAnimation')} description={t('admin.design.wholeAnimationHint')}>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <StepFields label={t('overlays:eventAlertsView.design.anim.enter')} value={design.animation.enter} onChange={s => setDesign(d => ({ ...d, animation: { ...d.animation, enter: s } }))} />
                        <StepFields label={t('overlays:eventAlertsView.design.anim.exit')} value={design.animation.exit} onChange={s => setDesign(d => ({ ...d, animation: { ...d.animation, exit: s } }))} />
                    </div>
                </Card>
            )}
            {tab === 'slots' && <SlotsPanel design={design} onChange={slots => setDesign(d => ({ ...d, slots }))} />}
            {tab === 'preview' && (
                <Card title={t('admin.design.livePreview')} description={t('admin.design.livePreviewHint')}>
                    <PreviewPane design={design} content={content} vars={vars} zone={zonePlacement(draft.zone, zones)} t={t} lang={lang} onLang={onLang} />
                </Card>
            )}
        </div>
    );
}
