import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2, Save } from 'lucide-react';
import { Card, ColorField, Field, NumberInput, Select, Slider, Toggle, inputClass } from '../overlay-editor/ui';
import MusicCanvasEditor, { type CanvasSample } from './MusicCanvasEditor';
import type { OverlayLabels } from './MusicOverlayRenderer';
import { FONT_FAMILIES, TEXT_ELEMENTS, ELEMENT_ORDER } from './defaults';
import { THEME_PRESETS, applyThemePreset } from './presets';
import { toggleElement } from './utils';
import VideoCoverNotice from './VideoCoverNotice';
import type { Direction, ElementConfig, ElementId, Easing, OverlayLayout, SavedTemplate, ShowHideAnimation, SongChangeAnimation, TextStyle } from './types';

// Pestañas de diseño del motor compartido: Tema, Elementos, Tipografía, Animaciones y Editor.
// Cada overlay (Song Request, Now Playing) dice qué elementos ofrece y pone su propio encabezado.

export interface DesignProps {
    layout: OverlayLayout;
    onChange: (layout: OverlayLayout) => void;
    /** Los elementos que ofrece este overlay, en orden. Los demás quedan apagados. */
    elementIds: ElementId[];
    /** Encima de cada pestaña (Song Request: qué overlay se edita). */
    header?: ReactNode;
}

export interface LayoutPreset { id: string; build: () => OverlayLayout }

/** Apaga lo que este overlay no ofrece (un diseño o plantilla puede traer, por ejemplo, el video). */
export function onlyOffered(layout: OverlayLayout, elementIds: ElementId[]): OverlayLayout {
    const elements = { ...layout.elements };
    for (const id of ELEMENT_ORDER) if (!elementIds.includes(id)) elements[id] = { ...elements[id], enabled: false };
    return { ...layout, elements };
}

function useLayout({ layout, onChange }: DesignProps) {
    const set = onChange;
    const setElement = (id: ElementId, patch: Partial<ElementConfig>) =>
        set({ ...layout, elements: { ...layout.elements, [id]: { ...layout.elements[id], ...patch } } });
    const setOptions = (id: ElementId, patch: Record<string, any>) =>
        setElement(id, { options: { ...layout.elements[id].options, ...patch } });
    return { layout, set, setElement, setOptions };
}

// ── Tema ─────────────────────────────────────────────────────────────────

export function ThemeTab(props: DesignProps & { templates?: { list: SavedTemplate[]; onChange: (list: SavedTemplate[]) => void } }) {
    const { t } = useTranslation('overlays');
    const { layout, set } = useLayout(props);
    const theme = layout.theme;
    const setTheme = (patch: Partial<typeof theme>) => set({ ...layout, theme: { ...theme, ...patch } });

    return (
        <div className="space-y-6">
            {props.header}
            <Card title={t('musicOverlay.theme.presetsTitle')} description={t('musicOverlay.theme.presetsDescription')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {THEME_PRESETS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => set(applyThemePreset(layout, p))}
                            className="text-left p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] hover:shadow-md transition-all"
                        >
                            <div className="flex h-8 rounded-lg overflow-hidden mb-2 border border-black/10">
                                {p.swatch.map((c, i) => <span key={i} className="flex-1" style={{ background: c === '#00000000' ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 10px 10px' : c }} />)}
                            </div>
                            <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]" style={{ fontFamily: `'${p.font}', system-ui` }}>{t(`musicOverlay.theme.presets.${p.id}`)}</p>
                        </button>
                    ))}
                </div>
            </Card>

            <Card title={t('musicOverlay.theme.panelTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorField label={t('musicOverlay.theme.panelBackground')} value={theme.panelBackground} onChange={v => setTheme({ panelBackground: v })} />
                    <ColorField label={t('musicOverlay.theme.panelBorder')} value={theme.panelBorderColor} onChange={v => setTheme({ panelBorderColor: v })} />
                    <Field label={t('musicOverlay.theme.borderWidth')}><Slider value={theme.panelBorderWidth} min={0} max={8} onChange={v => setTheme({ panelBorderWidth: v })} suffix="px" /></Field>
                    <Field label={t('musicOverlay.theme.radius')}><Slider value={theme.panelRadius} min={0} max={80} onChange={v => setTheme({ panelRadius: v })} suffix="px" /></Field>
                    <Field label={t('musicOverlay.theme.blur')} hint={t('musicOverlay.theme.blurHint')}><Slider value={theme.panelBlur} min={0} max={30} onChange={v => setTheme({ panelBlur: v })} suffix="px" /></Field>
                    <Field label={t('musicOverlay.theme.coverRadius')}><Slider value={theme.coverRadius} min={0} max={80} onChange={v => setTheme({ coverRadius: v })} suffix="px" /></Field>
                    <ColorField label={t('musicOverlay.theme.accent')} value={theme.accent} onChange={v => setTheme({ accent: v })} hint={t('musicOverlay.theme.accentHint')} />
                    <div className="pt-5"><Toggle checked={theme.panelShadow} onChange={v => setTheme({ panelShadow: v })} label={t('musicOverlay.theme.shadow')} /></div>
                </div>
            </Card>

            {props.templates && <TemplatesCard {...props} templates={props.templates} />}
        </div>
    );
}

function TemplatesCard({ layout, onChange, elementIds, templates: store }: DesignProps & { templates: { list: SavedTemplate[]; onChange: (list: SavedTemplate[]) => void } }) {
    const { t } = useTranslation('overlays');
    const [name, setName] = useState('');
    const templates = store.list;

    const saveTemplate = () => {
        if (!name.trim()) return;
        const tpl: SavedTemplate = { id: crypto.randomUUID(), name: name.trim().slice(0, 60), icon: '🎵', layout: structuredClone(layout), createdAt: new Date().toISOString() };
        store.onChange([...templates, tpl].slice(-30));
        setName('');
    };

    return (
        <Card title={t('musicOverlay.templates.title')} description={t('musicOverlay.templates.description')}>
            <form className="flex gap-2 mb-4" onSubmit={e => { e.preventDefault(); saveTemplate(); }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={t('musicOverlay.templates.namePlaceholder')} className={inputClass} maxLength={60} />
                <button type="submit" disabled={!name.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50 shrink-0">
                    <Save className="w-4 h-4" /> {t('musicOverlay.templates.save')}
                </button>
            </form>
            {templates.length === 0 ? (
                <p className="text-sm 3xl:text-base text-[#94a3b8]">{t('musicOverlay.templates.empty')}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {templates.map(tpl => (
                        <div key={tpl.id} className="flex items-center gap-2 p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                            <span className="text-lg">{tpl.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{tpl.name}</p>
                                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{tpl.layout.canvas.width}×{tpl.layout.canvas.height}</p>
                            </div>
                            <button
                                onClick={() => onChange(onlyOffered(structuredClone(tpl.layout), elementIds))}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                            >
                                <Check className="w-3.5 h-3.5" /> {t('musicOverlay.templates.apply')}
                            </button>
                            <button
                                onClick={() => { if (window.confirm(t('musicOverlay.templates.deleteConfirm', { name: tpl.name }))) store.onChange(templates.filter(x => x.id !== tpl.id)); }}
                                className="p-1.5 rounded-lg text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title={t('musicOverlay.templates.delete')}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

// ── Elementos ────────────────────────────────────────────────────────────

export function ElementsTab(props: DesignProps & { labels?: OverlayLabels }) {
    const { t } = useTranslation('overlays');
    const { layout, set, setOptions } = useLayout(props);
    const [coverHidden, setCoverHidden] = useState(false);
    const ids = props.elementIds;
    const toggle = (id: ElementId, enabled: boolean) => {
        const r = toggleElement(layout, id, enabled);
        set(r.layout);
        setCoverHidden(r.coverHidden);
    };
    const e = layout.elements;

    const extra = (id: ElementId) => {
        switch (id) {
            case 'video':
                return <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('musicOverlay.elementOptions.videoHint')}</p>;
            case 'requester':
                return <Field label={t('musicOverlay.elementOptions.label')} hint={t('musicOverlay.elementOptions.requesterLabelHint')}><input className={inputClass} value={e.requester.options.label ?? ''} placeholder={props.labels?.requestedBy} onChange={ev => setOptions('requester', { label: ev.target.value })} maxLength={60} /></Field>;
            case 'next':
                return <Field label={t('musicOverlay.elementOptions.label')}><input className={inputClass} value={e.next.options.label ?? ''} placeholder={props.labels?.next} onChange={ev => setOptions('next', { label: ev.target.value })} maxLength={40} /></Field>;
            case 'queue':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={t('musicOverlay.elementOptions.queueCount')}><NumberInput value={e.queue.options.count ?? 3} min={1} max={10} onChange={v => setOptions('queue', { count: v })} /></Field>
                        <div className="pt-5"><Toggle checked={!!e.queue.options.showRequester} onChange={v => setOptions('queue', { showRequester: v })} label={t('musicOverlay.elementOptions.showRequester')} /></div>
                    </div>
                );
            case 'progress':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ColorField label={t('musicOverlay.elementOptions.fill')} value={e.progress.options.fill ?? layout.theme.accent} onChange={v => setOptions('progress', { fill: v })} />
                        <ColorField label={t('musicOverlay.elementOptions.track')} value={e.progress.options.track ?? 'rgba(255,255,255,0.15)'} onChange={v => setOptions('progress', { track: v })} />
                        <Field label={t('musicOverlay.theme.radius')}><Slider value={e.progress.options.radius ?? 4} min={0} max={20} onChange={v => setOptions('progress', { radius: v })} suffix="px" /></Field>
                    </div>
                );
            case 'time':
                return (
                    <Field label={t('musicOverlay.elementOptions.timeFormat')}>
                        <Select value={e.time.options.format ?? 'elapsed_total'} onChange={v => setOptions('time', { format: v })} options={[
                            { value: 'elapsed_total', label: '1:23 / 3:33' },
                            { value: 'elapsed', label: '1:23' },
                            { value: 'remaining', label: '-2:10' },
                        ]} />
                    </Field>
                );
            case 'source':
                return (
                    <Field label={t('musicOverlay.elementOptions.sourceDisplay')} hint={t('musicOverlay.elementOptions.sourceDisplayHint')}>
                        <Select value={e.source.options.display ?? 'text'} onChange={v => setOptions('source', { display: v })} options={(['text', 'icon', 'both'] as const).map(d => ({ value: d, label: t(`musicOverlay.elementOptions.sourceDisplays.${d}`) }))} />
                    </Field>
                );
            case 'equalizer':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={t('musicOverlay.elementOptions.bars')}><Slider value={e.equalizer.options.bars ?? 4} min={2} max={12} onChange={v => setOptions('equalizer', { bars: v })} /></Field>
                        <ColorField label={t('musicOverlay.elementOptions.color')} value={e.equalizer.options.color || layout.theme.accent} onChange={v => setOptions('equalizer', { color: v })} />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {props.header}
            <VideoCoverNotice layout={layout} coverHidden={coverHidden} onDismiss={() => setCoverHidden(false)} />
            <Card title={t('musicOverlay.elementsTab.title')} description={t('musicOverlay.elementsTab.description')}>
                <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                    {ids.map(id => {
                        const options = extra(id);
                        return (
                            <div key={id} className="py-3 space-y-3">
                                <Toggle checked={e[id].enabled} onChange={v => toggle(id, v)} label={t(`musicOverlay.elements.${id}`)} hint={t(`musicOverlay.elementHints.${id}`)} />
                                {e[id].enabled && options && <div className="pl-14">{options}</div>}
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}

// ── Tipografía ───────────────────────────────────────────────────────────

export function TypographyTab(props: DesignProps) {
    const { t } = useTranslation('overlays');
    const { layout, set, setElement } = useLayout(props);
    const textIds = TEXT_ELEMENTS.filter(id => props.elementIds.includes(id));
    const [selected, setSelected] = useState<ElementId>('title');
    const style = layout.elements[selected].text!;
    const setText = (patch: Partial<TextStyle>) => setElement(selected, { text: { ...style, ...patch } });

    const applyFontToAll = () => {
        const elements = { ...layout.elements };
        for (const id of textIds) elements[id] = { ...elements[id], text: { ...elements[id].text!, fontFamily: style.fontFamily } };
        set({ ...layout, elements });
    };

    return (
        <div className="space-y-6">
            {props.header}
            <Card title={t('musicOverlay.typography.title')}>
                <div className="flex flex-wrap gap-2 mb-5">
                    {textIds.map(id => (
                        <button
                            key={id}
                            onClick={() => setSelected(id)}
                            className={`px-3 py-1.5 rounded-lg text-sm 3xl:text-base font-bold transition-colors ${id === selected ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'} ${layout.elements[id].enabled ? '' : 'opacity-50'}`}
                        >
                            {t(`musicOverlay.elements.${id}`)}
                        </button>
                    ))}
                </div>
                {!layout.elements[selected].enabled && <p className="text-xs 3xl:text-sm text-amber-600 dark:text-amber-400 mb-4">{t('musicOverlay.typography.hiddenNote')}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('musicOverlay.typography.font')}>
                        <div className="flex gap-2">
                            <select className={inputClass} value={style.fontFamily} onChange={e => setText({ fontFamily: e.target.value })} style={{ fontFamily: `'${style.fontFamily}'` }}>
                                {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
                            </select>
                            <button onClick={applyFontToAll} className="px-3 py-2 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] shrink-0" title={t('musicOverlay.typography.applyAllHint')}>
                                {t('musicOverlay.typography.applyAll')}
                            </button>
                        </div>
                    </Field>
                    <ColorField label={t('musicOverlay.typography.color')} value={style.color} onChange={v => setText({ color: v })} />
                    <Field label={t('musicOverlay.typography.size')}><Slider value={style.fontSize} min={8} max={120} onChange={v => setText({ fontSize: v })} suffix="px" /></Field>
                    <Field label={t('musicOverlay.typography.weight')}>
                        <Select value={style.fontWeight} onChange={v => setText({ fontWeight: v })} options={['400', '500', '600', '700', '800'].map(w => ({ value: w, label: t(`musicOverlay.typography.weights.${w}`) }))} />
                    </Field>
                    <Field label={t('musicOverlay.typography.align')}>
                        <Select value={style.align} onChange={v => setText({ align: v })} options={(['left', 'center', 'right'] as const).map(a => ({ value: a, label: t(`musicOverlay.typography.aligns.${a}`) }))} />
                    </Field>
                    <Field label={t('musicOverlay.typography.shadow')}>
                        <Select value={style.shadow} onChange={v => setText({ shadow: v })} options={(['none', 'soft', 'strong', 'glow'] as const).map(s => ({ value: s, label: t(`musicOverlay.typography.shadows.${s}`) }))} />
                    </Field>
                    <Field label={t('musicOverlay.typography.letterSpacing')}><Slider value={style.letterSpacing} min={-2} max={10} step={0.5} onChange={v => setText({ letterSpacing: v })} suffix="px" /></Field>
                    <div className="space-y-3 pt-5">
                        <Toggle checked={style.uppercase} onChange={v => setText({ uppercase: v })} label={t('musicOverlay.typography.uppercase')} />
                        <Toggle checked={style.marquee} onChange={v => setText({ marquee: v })} label={t('musicOverlay.typography.marquee')} hint={t('musicOverlay.typography.marqueeHint')} />
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ── Animaciones ──────────────────────────────────────────────────────────

export function AnimationsTab(props: DesignProps) {
    const { t } = useTranslation('overlays');
    const { layout, set } = useLayout(props);
    const a = layout.animations;
    const setAnim = (patch: Partial<typeof a>) => set({ ...layout, animations: { ...a, ...patch } });
    const names: SongChangeAnimation[] = ['none', 'fade', 'slide-up', 'slide-left', 'zoom', 'flip'];

    return (
        <div className="space-y-6">
            {props.header}
            <Card title={t('musicOverlay.animations.title')} description={t('musicOverlay.animations.description')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                    {names.map(n => (
                        <button
                            key={n}
                            onClick={() => setAnim({ songChange: n })}
                            className={`px-3 py-2.5 rounded-xl text-sm 3xl:text-base font-bold border transition-colors ${a.songChange === n ? 'border-[#2563eb] bg-[#eff6ff] dark:bg-[#1e3a8a]/30 text-[#2563eb] dark:text-[#93c5fd]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-[#2563eb]'}`}
                        >
                            {t(`musicOverlay.animations.names.${n}`)}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('musicOverlay.animations.duration')}><Slider value={a.durationMs} min={150} max={2000} step={50} onChange={v => setAnim({ durationMs: v })} suffix="ms" /></Field>
                    <Field label={t('musicOverlay.animations.marqueeSpeed')} hint={t('musicOverlay.animations.marqueeSpeedHint')}><Slider value={a.marqueeSpeed} min={10} max={150} onChange={v => setAnim({ marqueeSpeed: v })} /></Field>
                    <Toggle checked={a.hideWhenIdle} onChange={v => setAnim({ hideWhenIdle: v })} label={t('musicOverlay.animations.hideWhenIdle')} hint={t('musicOverlay.animations.hideWhenIdleHint')} />
                    <Toggle checked={a.freezeWhenPaused} onChange={v => setAnim({ freezeWhenPaused: v })} label={t('musicOverlay.animations.freezeWhenPaused')} />
                </div>
                <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-4">{t('musicOverlay.animations.previewHint')}</p>
            </Card>
            <ShowHideCard title={t('musicOverlay.animations.enterTitle')} description={t('musicOverlay.animations.enterDescription')} value={a.enter} onChange={v => setAnim({ enter: v })} />
            <ShowHideCard title={t('musicOverlay.animations.exitTitle')} description={t('musicOverlay.animations.exitDescription')} value={a.exit} onChange={v => setAnim({ exit: v })} />
        </div>
    );
}

function ShowHideCard({ title, description, value, onChange }: { title: string; description: string; value: ShowHideAnimation; onChange: (v: ShowHideAnimation) => void }) {
    const { t } = useTranslation('overlays');
    const set = (patch: Partial<ShowHideAnimation>) => onChange({ ...value, ...patch });
    const types: ShowHideAnimation['type'][] = ['none', 'fade', 'slide', 'bounce', 'zoom'];
    const directions: Direction[] = ['left', 'right', 'top', 'bottom'];
    const easings: Easing[] = ['ease', 'ease-out', 'ease-in', 'ease-in-out', 'linear'];
    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;
    return (
        <Card title={title} description={description}>
            <div className="space-y-4">
                <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                    {types.map(ty => <button key={ty} className={seg(value.type === ty)} onClick={() => set({ type: ty })}>{t(`musicOverlay.animations.showHide.${ty}`)}</button>)}
                </div>
                {value.type !== 'none' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(value.type === 'slide' || value.type === 'bounce') && (
                            <Field label={t('musicOverlay.animations.direction')}>
                                <Select value={value.direction} onChange={v => set({ direction: v })} options={directions.map(d => ({ value: d, label: t(`musicOverlay.animations.directions.${d}`) }))} />
                            </Field>
                        )}
                        <Field label={t('musicOverlay.animations.easing')}>
                            <Select value={value.easing} onChange={v => set({ easing: v })} options={easings.map(e => ({ value: e, label: t(`musicOverlay.animations.easings.${e}`) }))} />
                        </Field>
                        <Field label={t('musicOverlay.animations.duration')}><Slider value={value.durationMs} min={100} max={3000} step={50} onChange={v => set({ durationMs: v })} suffix="ms" /></Field>
                    </div>
                )}
            </div>
        </Card>
    );
}

// ── Editor ───────────────────────────────────────────────────────────────

export function EditorTab(props: DesignProps & { labels: OverlayLabels; sample: CanvasSample; presets: LayoutPreset[] }) {
    const { t } = useTranslation('overlays');
    const { layout, set } = useLayout(props);
    const presets = props.presets;

    const applyLayout = (build: () => OverlayLayout) => {
        if (!window.confirm(t('musicOverlay.editor.layoutConfirm'))) return;
        const next = build();
        // El diseño nuevo conserva los colores y fuentes que ya tenía
        for (const id of TEXT_ELEMENTS) {
            const prev = layout.elements[id].text;
            if (prev && next.elements[id].text) next.elements[id].text = { ...prev, fontSize: next.elements[id].text!.fontSize, align: next.elements[id].text!.align, marquee: next.elements[id].text!.marquee };
        }
        next.theme = { ...layout.theme, panelRadius: next.theme.panelRadius, coverRadius: next.theme.coverRadius };
        next.animations = layout.animations;
        next.elements.progress.options = { ...next.elements.progress.options, fill: layout.elements.progress.options.fill, track: layout.elements.progress.options.track };
        set(onlyOffered(next, props.elementIds));
    };

    return (
        <div className="space-y-6">
            {props.header}
            <Card title={t('musicOverlay.editor.layoutsTitle')} description={t('musicOverlay.editor.layoutsDescription')}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {presets.map(p => {
                        const l = p.build();
                        return (
                            <button key={p.id} onClick={() => applyLayout(p.build)} className="p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] hover:shadow-md transition-all text-left">
                                <LayoutThumb layout={l} />
                                <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc] mt-2">{t(`musicOverlay.editor.layouts.${p.id}`)}</p>
                                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{l.canvas.width}×{l.canvas.height}</p>
                            </button>
                        );
                    })}
                </div>
            </Card>
            <MusicCanvasEditor layout={layout} onChange={set} elementIds={props.elementIds} labels={props.labels} sample={props.sample} />
        </div>
    );
}

/** Miniatura esquemática de un diseño (cajas de cada elemento). */
function LayoutThumb({ layout }: { layout: OverlayLayout }) {
    const w = 140;
    const s = w / Math.max(layout.canvas.width, layout.canvas.height * 1.6);
    const colors: Partial<Record<ElementId, string>> = { panel: '#1f2937', cover: '#3b82f6', video: '#3b82f6', title: '#e5e7eb', artist: '#9ca3af', requester: '#39ff14', progress: '#39ff14', queue: '#6b7280' };
    return (
        <div className="relative mx-auto rounded bg-[#0b0b10]" style={{ width: layout.canvas.width * s, height: layout.canvas.height * s }}>
            {ELEMENT_ORDER.filter(id => layout.elements[id].enabled && colors[id]).map(id => {
                const e = layout.elements[id];
                return <span key={id} className="absolute rounded-sm" style={{ left: e.x * s, top: e.y * s, width: Math.max(2, e.width * s), height: Math.max(2, id === 'title' || id === 'artist' || id === 'requester' ? Math.min(e.height * s, 5) : e.height * s), background: colors[id], opacity: id === 'panel' ? 1 : 0.9 }} />;
            })}
        </div>
    );
}
