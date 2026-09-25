import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2, Save, Copy } from 'lucide-react';
import { Card, ColorField, Field, NumberInput, Select, Slider, Toggle, inputClass } from '../ui';
import OverlayCanvasEditor from '../OverlayCanvasEditor';
import type { OverlayLabels } from '../SongOverlayRenderer';
import { FONT_FAMILIES, LAYOUT_PRESETS, TEXT_ELEMENTS, ELEMENT_ORDER } from '../../constants/defaults';
import { THEME_PRESETS, applyThemePreset } from '../../constants/presets';
import type { ElementConfig, ElementId, OverlayKind, OverlayLayout, SavedTemplate, SongChangeAnimation, TextStyle } from '../../types';
import type { SongRequestConfigState } from '../../hooks/useSongRequestConfig';

interface DesignProps {
    cfg: SongRequestConfigState;
    kind: OverlayKind;
    onKindChange: (k: OverlayKind) => void;
}

function useLayout({ cfg, kind }: DesignProps) {
    const layout = cfg.overlay[kind];
    const set = (next: OverlayLayout) => cfg.updateLayout(kind, next);
    const setElement = (id: ElementId, patch: Partial<ElementConfig>) =>
        set({ ...layout, elements: { ...layout.elements, [id]: { ...layout.elements[id], ...patch } } });
    const setOptions = (id: ElementId, patch: Record<string, any>) =>
        setElement(id, { options: { ...layout.elements[id].options, ...patch } });
    return { layout, set, setElement, setOptions };
}

/** Qué overlay se está editando + copiar el diseño al otro. */
export function KindSwitch({ cfg, kind, onKindChange }: DesignProps) {
    const { t } = useTranslation('overlays');
    const other: OverlayKind = kind === 'player' ? 'nowPlaying' : 'player';
    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;
    return (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] px-4 py-3 shadow-lg">
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('songRequest.kinds.editing')}</span>
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111]">
                    <button className={seg(kind === 'player')} onClick={() => onKindChange('player')}>{t('songRequest.kinds.player')}</button>
                    <button className={seg(kind === 'nowPlaying')} onClick={() => onKindChange('nowPlaying')}>{t('songRequest.kinds.nowPlaying')}</button>
                </div>
            </div>
            <button
                onClick={() => {
                    if (!window.confirm(t('songRequest.kinds.copyConfirm', { to: t(`songRequest.kinds.${other}`) }))) return;
                    const copy = structuredClone(cfg.overlay[kind]);
                    if (other === 'nowPlaying') copy.elements.video.enabled = false;
                    cfg.updateLayout(other, copy);
                }}
                className="flex items-center gap-1.5 text-xs 3xl:text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-white"
            >
                <Copy className="w-4 h-4" /> {t('songRequest.kinds.copyTo', { to: t(`songRequest.kinds.${other}`) })}
            </button>
        </div>
    );
}

// ── Tema ─────────────────────────────────────────────────────────────────

export function ThemeTab(props: DesignProps) {
    const { t } = useTranslation('overlays');
    const { layout, set } = useLayout(props);
    const theme = layout.theme;
    const setTheme = (patch: Partial<typeof theme>) => set({ ...layout, theme: { ...theme, ...patch } });

    return (
        <div className="space-y-6">
            <KindSwitch {...props} />
            <Card title={t('songRequest.theme.presetsTitle')} description={t('songRequest.theme.presetsDescription')}>
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
                            <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]" style={{ fontFamily: `'${p.font}', system-ui` }}>{t(`songRequest.theme.presets.${p.id}`)}</p>
                        </button>
                    ))}
                </div>
            </Card>

            <Card title={t('songRequest.theme.panelTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorField label={t('songRequest.theme.panelBackground')} value={theme.panelBackground} onChange={v => setTheme({ panelBackground: v })} />
                    <ColorField label={t('songRequest.theme.panelBorder')} value={theme.panelBorderColor} onChange={v => setTheme({ panelBorderColor: v })} />
                    <Field label={t('songRequest.theme.borderWidth')}><Slider value={theme.panelBorderWidth} min={0} max={8} onChange={v => setTheme({ panelBorderWidth: v })} suffix="px" /></Field>
                    <Field label={t('songRequest.theme.radius')}><Slider value={theme.panelRadius} min={0} max={80} onChange={v => setTheme({ panelRadius: v })} suffix="px" /></Field>
                    <Field label={t('songRequest.theme.blur')} hint={t('songRequest.theme.blurHint')}><Slider value={theme.panelBlur} min={0} max={30} onChange={v => setTheme({ panelBlur: v })} suffix="px" /></Field>
                    <Field label={t('songRequest.theme.coverRadius')}><Slider value={theme.coverRadius} min={0} max={80} onChange={v => setTheme({ coverRadius: v })} suffix="px" /></Field>
                    <ColorField label={t('songRequest.theme.accent')} value={theme.accent} onChange={v => setTheme({ accent: v })} hint={t('songRequest.theme.accentHint')} />
                    <div className="pt-5"><Toggle checked={theme.panelShadow} onChange={v => setTheme({ panelShadow: v })} label={t('songRequest.theme.shadow')} /></div>
                </div>
            </Card>

            <TemplatesCard {...props} />
        </div>
    );
}

function TemplatesCard({ cfg, kind }: DesignProps) {
    const { t } = useTranslation('overlays');
    const [name, setName] = useState('');
    const templates = cfg.overlay.templates;

    const saveTemplate = () => {
        if (!name.trim()) return;
        const tpl: SavedTemplate = { id: crypto.randomUUID(), name: name.trim().slice(0, 60), icon: '🎵', layout: structuredClone(cfg.overlay[kind]), createdAt: new Date().toISOString() };
        cfg.updateOverlay({ ...cfg.overlay, templates: [...templates, tpl].slice(-30) });
        setName('');
    };

    return (
        <Card title={t('songRequest.templates.title')} description={t('songRequest.templates.description')}>
            <form className="flex gap-2 mb-4" onSubmit={e => { e.preventDefault(); saveTemplate(); }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={t('songRequest.templates.namePlaceholder')} className={inputClass} maxLength={60} />
                <button type="submit" disabled={!name.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50 shrink-0">
                    <Save className="w-4 h-4" /> {t('songRequest.templates.save')}
                </button>
            </form>
            {templates.length === 0 ? (
                <p className="text-sm 3xl:text-base text-[#94a3b8]">{t('songRequest.templates.empty')}</p>
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
                                onClick={() => {
                                    const copy = structuredClone(tpl.layout);
                                    if (kind === 'nowPlaying') copy.elements.video.enabled = false;
                                    cfg.updateLayout(kind, copy);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                            >
                                <Check className="w-3.5 h-3.5" /> {t('songRequest.templates.apply')}
                            </button>
                            <button
                                onClick={() => { if (window.confirm(t('songRequest.templates.deleteConfirm', { name: tpl.name }))) cfg.updateOverlay({ ...cfg.overlay, templates: templates.filter(x => x.id !== tpl.id) }); }}
                                className="p-1.5 rounded-lg text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title={t('songRequest.templates.delete')}
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

export function ElementsTab(props: DesignProps) {
    const { t } = useTranslation('overlays');
    const { layout, setElement, setOptions } = useLayout(props);
    const ids = ELEMENT_ORDER.filter(id => props.kind === 'player' || id !== 'video');
    const e = layout.elements;

    const extra = (id: ElementId) => {
        switch (id) {
            case 'video':
                return <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('songRequest.elementOptions.videoHint')}</p>;
            case 'requester':
                return <Field label={t('songRequest.elementOptions.label')} hint={t('songRequest.elementOptions.requesterLabelHint')}><input className={inputClass} value={e.requester.options.label ?? ''} placeholder={t('songRequest.overlayLabels.requestedBy', { user: '{{user}}' })} onChange={ev => setOptions('requester', { label: ev.target.value })} maxLength={60} /></Field>;
            case 'next':
                return <Field label={t('songRequest.elementOptions.label')}><input className={inputClass} value={e.next.options.label ?? ''} placeholder={t('songRequest.overlayLabels.next')} onChange={ev => setOptions('next', { label: ev.target.value })} maxLength={40} /></Field>;
            case 'queue':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={t('songRequest.elementOptions.queueCount')}><NumberInput value={e.queue.options.count ?? 3} min={1} max={10} onChange={v => setOptions('queue', { count: v })} /></Field>
                        <div className="pt-5"><Toggle checked={!!e.queue.options.showRequester} onChange={v => setOptions('queue', { showRequester: v })} label={t('songRequest.elementOptions.showRequester')} /></div>
                    </div>
                );
            case 'progress':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ColorField label={t('songRequest.elementOptions.fill')} value={e.progress.options.fill ?? layout.theme.accent} onChange={v => setOptions('progress', { fill: v })} />
                        <ColorField label={t('songRequest.elementOptions.track')} value={e.progress.options.track ?? 'rgba(255,255,255,0.15)'} onChange={v => setOptions('progress', { track: v })} />
                        <Field label={t('songRequest.theme.radius')}><Slider value={e.progress.options.radius ?? 4} min={0} max={20} onChange={v => setOptions('progress', { radius: v })} suffix="px" /></Field>
                    </div>
                );
            case 'time':
                return (
                    <Field label={t('songRequest.elementOptions.timeFormat')}>
                        <Select value={e.time.options.format ?? 'elapsed_total'} onChange={v => setOptions('time', { format: v })} options={[
                            { value: 'elapsed_total', label: '1:23 / 3:33' },
                            { value: 'elapsed', label: '1:23' },
                            { value: 'remaining', label: '-2:10' },
                        ]} />
                    </Field>
                );
            case 'equalizer':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={t('songRequest.elementOptions.bars')}><Slider value={e.equalizer.options.bars ?? 4} min={2} max={12} onChange={v => setOptions('equalizer', { bars: v })} /></Field>
                        <ColorField label={t('songRequest.elementOptions.color')} value={e.equalizer.options.color || layout.theme.accent} onChange={v => setOptions('equalizer', { color: v })} />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <KindSwitch {...props} />
            <Card title={t('songRequest.elementsTab.title')} description={t('songRequest.elementsTab.description')}>
                <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                    {ids.map(id => {
                        const options = extra(id);
                        return (
                            <div key={id} className="py-3 space-y-3">
                                <Toggle checked={e[id].enabled} onChange={v => setElement(id, { enabled: v })} label={t(`songRequest.elements.${id}`)} hint={t(`songRequest.elementHints.${id}`)} />
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
    const [selected, setSelected] = useState<ElementId>('title');
    const style = layout.elements[selected].text!;
    const setText = (patch: Partial<TextStyle>) => setElement(selected, { text: { ...style, ...patch } });

    const applyFontToAll = () => {
        const elements = { ...layout.elements };
        for (const id of TEXT_ELEMENTS) elements[id] = { ...elements[id], text: { ...elements[id].text!, fontFamily: style.fontFamily } };
        set({ ...layout, elements });
    };

    return (
        <div className="space-y-6">
            <KindSwitch {...props} />
            <Card title={t('songRequest.typography.title')}>
                <div className="flex flex-wrap gap-2 mb-5">
                    {TEXT_ELEMENTS.map(id => (
                        <button
                            key={id}
                            onClick={() => setSelected(id)}
                            className={`px-3 py-1.5 rounded-lg text-sm 3xl:text-base font-bold transition-colors ${id === selected ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'} ${layout.elements[id].enabled ? '' : 'opacity-50'}`}
                        >
                            {t(`songRequest.elements.${id}`)}
                        </button>
                    ))}
                </div>
                {!layout.elements[selected].enabled && <p className="text-xs 3xl:text-sm text-amber-600 dark:text-amber-400 mb-4">{t('songRequest.typography.hiddenNote')}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('songRequest.typography.font')}>
                        <div className="flex gap-2">
                            <select className={inputClass} value={style.fontFamily} onChange={e => setText({ fontFamily: e.target.value })} style={{ fontFamily: `'${style.fontFamily}'` }}>
                                {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
                            </select>
                            <button onClick={applyFontToAll} className="px-3 py-2 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] shrink-0" title={t('songRequest.typography.applyAllHint')}>
                                {t('songRequest.typography.applyAll')}
                            </button>
                        </div>
                    </Field>
                    <ColorField label={t('songRequest.typography.color')} value={style.color} onChange={v => setText({ color: v })} />
                    <Field label={t('songRequest.typography.size')}><Slider value={style.fontSize} min={8} max={120} onChange={v => setText({ fontSize: v })} suffix="px" /></Field>
                    <Field label={t('songRequest.typography.weight')}>
                        <Select value={style.fontWeight} onChange={v => setText({ fontWeight: v })} options={['400', '500', '600', '700', '800'].map(w => ({ value: w, label: t(`songRequest.typography.weights.${w}`) }))} />
                    </Field>
                    <Field label={t('songRequest.typography.align')}>
                        <Select value={style.align} onChange={v => setText({ align: v })} options={(['left', 'center', 'right'] as const).map(a => ({ value: a, label: t(`songRequest.typography.aligns.${a}`) }))} />
                    </Field>
                    <Field label={t('songRequest.typography.shadow')}>
                        <Select value={style.shadow} onChange={v => setText({ shadow: v })} options={(['none', 'soft', 'strong', 'glow'] as const).map(s => ({ value: s, label: t(`songRequest.typography.shadows.${s}`) }))} />
                    </Field>
                    <Field label={t('songRequest.typography.letterSpacing')}><Slider value={style.letterSpacing} min={-2} max={10} step={0.5} onChange={v => setText({ letterSpacing: v })} suffix="px" /></Field>
                    <div className="space-y-3 pt-5">
                        <Toggle checked={style.uppercase} onChange={v => setText({ uppercase: v })} label={t('songRequest.typography.uppercase')} />
                        <Toggle checked={style.marquee} onChange={v => setText({ marquee: v })} label={t('songRequest.typography.marquee')} hint={t('songRequest.typography.marqueeHint')} />
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
            <KindSwitch {...props} />
            <Card title={t('songRequest.animations.title')} description={t('songRequest.animations.description')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                    {names.map(n => (
                        <button
                            key={n}
                            onClick={() => setAnim({ songChange: n })}
                            className={`px-3 py-2.5 rounded-xl text-sm 3xl:text-base font-bold border transition-colors ${a.songChange === n ? 'border-[#2563eb] bg-[#eff6ff] dark:bg-[#1e3a8a]/30 text-[#2563eb] dark:text-[#93c5fd]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-[#2563eb]'}`}
                        >
                            {t(`songRequest.animations.names.${n}`)}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('songRequest.animations.duration')}><Slider value={a.durationMs} min={150} max={2000} step={50} onChange={v => setAnim({ durationMs: v })} suffix="ms" /></Field>
                    <Field label={t('songRequest.animations.marqueeSpeed')} hint={t('songRequest.animations.marqueeSpeedHint')}><Slider value={a.marqueeSpeed} min={10} max={150} onChange={v => setAnim({ marqueeSpeed: v })} /></Field>
                    <Toggle checked={a.hideWhenIdle} onChange={v => setAnim({ hideWhenIdle: v })} label={t('songRequest.animations.hideWhenIdle')} hint={t('songRequest.animations.hideWhenIdleHint')} />
                    <Toggle checked={a.freezeWhenPaused} onChange={v => setAnim({ freezeWhenPaused: v })} label={t('songRequest.animations.freezeWhenPaused')} />
                </div>
                <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-4">{t('songRequest.animations.previewHint')}</p>
            </Card>
        </div>
    );
}

// ── Editor ───────────────────────────────────────────────────────────────

export function EditorTab(props: DesignProps & { labels: OverlayLabels }) {
    const { t } = useTranslation('overlays');
    const { layout, set } = useLayout(props);
    const presets = LAYOUT_PRESETS.filter(p => props.kind === 'player' || !p.playerOnly);

    const applyLayout = (build: () => OverlayLayout) => {
        if (!window.confirm(t('songRequest.editor.layoutConfirm'))) return;
        const next = build();
        // El diseño nuevo conserva los colores y fuentes que ya tenía
        for (const id of TEXT_ELEMENTS) {
            const prev = layout.elements[id].text;
            if (prev && next.elements[id].text) next.elements[id].text = { ...prev, fontSize: next.elements[id].text!.fontSize, align: next.elements[id].text!.align, marquee: next.elements[id].text!.marquee };
        }
        next.theme = { ...layout.theme, panelRadius: next.theme.panelRadius, coverRadius: next.theme.coverRadius };
        next.animations = layout.animations;
        next.elements.progress.options = { ...next.elements.progress.options, fill: layout.elements.progress.options.fill, track: layout.elements.progress.options.track };
        if (props.kind === 'nowPlaying') next.elements.video.enabled = false;
        set(next);
    };

    return (
        <div className="space-y-6">
            <KindSwitch {...props} />
            <Card title={t('songRequest.editor.layoutsTitle')} description={t('songRequest.editor.layoutsDescription')}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {presets.map(p => {
                        const l = p.build();
                        return (
                            <button key={p.id} onClick={() => applyLayout(p.build)} className="p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] hover:shadow-md transition-all text-left">
                                <LayoutThumb layout={l} />
                                <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc] mt-2">{t(`songRequest.editor.layouts.${p.id}`)}</p>
                                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{l.canvas.width}×{l.canvas.height}</p>
                            </button>
                        );
                    })}
                </div>
            </Card>
            <OverlayCanvasEditor kind={props.kind} layout={layout} onChange={set} labels={props.labels} />
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
