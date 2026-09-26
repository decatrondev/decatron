import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Plus, Trash2, Eye, EyeOff, Shield, ChevronUp, ChevronDown, CheckCircle2, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { Card, ColorField, CopyButton, Field, NumberInput, Select, Slider, Toggle, ScaledCanvas, inputClass, CHECKER_BG } from '../../../../components/overlay-editor/ui';
import OverlayCanvasEditor, { type Rect } from '../../../../components/overlay-editor/OverlayCanvasEditor';
import ShoutoutRenderer, { fillVariables } from '../../../../components/shoutout-overlay/ShoutoutRenderer';
import api from '../../../../services/api';
import { FONT_OPTIONS, SAMPLE_SHOUTOUT, element, textBlock } from '../../../../components/shoutout-overlay/defaults';
import { COLOR_THEMES, LAYOUT_PRESETS, applyColorTheme, applyLayoutPreset } from '../../../../components/shoutout-overlay/presets';
import type { AnimationType, Direction, Easing, ElementKind, ShoutoutElement, ShoutoutLayout, ShowHideAnimation, TextBlock, TextLine } from '../../../../components/shoutout-overlay/types';
import { CLIP_MODES, COOLDOWN_RANGE, DURATION_RANGE, NO_CLIP_RANGE, type ShoutoutConfigState } from '../hooks/useShoutoutConfig';

export type ShoutoutTabId = 'guide' | 'general' | 'clip' | 'theme' | 'elements' | 'text' | 'animations' | 'editor' | 'auto' | 'permissions';

/** Lo que llega con los datos nuevos del shoutout (fase 2: insignia, en vivo, título, etiquetas, seguidores, datos del clip). */
const EXTRA_DATA = true;
const OFFERED: ElementKind[] = EXTRA_DATA
    ? ['panel', 'shape', 'clip', 'avatar', 'text', 'badge', 'live', 'progress', 'timer']
    : ['panel', 'shape', 'clip', 'avatar', 'text', 'progress', 'timer'];
export const VARIABLES = EXTRA_DATA
    ? ['@displayname', '@username', '@game', '@title', '@tags', '@followers', '@clipTitle', '@clipViews', '@clipCreator']
    : ['@displayname', '@username', '@game'];

interface TabProps { cfg: ShoutoutConfigState }

const btnBase = 'px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';
const btnGray = `${btnBase} bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]`;
const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;
const choice = (active: boolean) => `px-3 py-2.5 rounded-xl text-sm 3xl:text-base font-bold border transition-colors ${active ? 'border-[#2563eb] bg-[#eff6ff] dark:bg-[#1e3a8a]/30 text-[#2563eb] dark:text-[#93c5fd]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-[#2563eb]'}`;

/** Cambios sobre el diseño, siempre partiendo del último (el arrastre manda muchos seguidos). */
function useLayoutEdit(cfg: ShoutoutConfigState) {
    const ref = useRef(cfg.layout);
    ref.current = cfg.layout;
    const set = cfg.updateLayout;
    const setElement = useCallback((id: string, patch: Partial<ShoutoutElement>) => {
        const l = ref.current;
        set({ ...l, elements: l.elements.map(e => (e.id === id ? { ...e, ...patch } : e)) });
    }, [set]);
    const setOptions = useCallback((id: string, patch: Record<string, any>) => {
        const e = ref.current.elements.find(x => x.id === id);
        if (e) setElement(id, { options: { ...e.options, ...patch } });
    }, [setElement]);
    const setText = useCallback((id: string, patch: Partial<TextBlock>) => {
        const e = ref.current.elements.find(x => x.id === id);
        if (e?.text) setElement(id, { text: { ...e.text, ...patch } });
    }, [setElement]);
    return { layout: cfg.layout, ref, set, setElement, setOptions, setText };
}

function useElementLabel() {
    const { t } = useTranslation('overlays');
    return (e: ShoutoutElement, layout: ShoutoutLayout) => {
        if (e.kind !== 'text') return t(`shoutout.elements.${e.kind}`);
        const n = layout.elements.filter(x => x.kind === 'text').indexOf(e) + 1;
        return t('shoutout.elements.textN', { n });
    };
}

// ── Guía ───────────────────────────────────────────────────────────────────

export function GuideTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: ShoutoutTabId) => void }) {
    const { t } = useTranslation('overlays');
    const step = (n: number, title: string, body: ReactNode) => (
        <div className="flex gap-4">
            <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-[#2563eb] text-white font-black flex items-center justify-center text-sm 3xl:text-base">{n}</span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] space-y-2">{body}</div>
            </div>
        </div>
    );
    const link = (tab: ShoutoutTabId, label: string) => <button className="underline text-[#2563eb]" onClick={() => onNavigate(tab)}>{label}</button>;

    return (
        <Card title={t('shoutout.guide.title')} description={t('shoutout.guide.description')}>
            <div className="space-y-6">
                {step(1, t('shoutout.guide.step1Title'), (
                    <>
                        <p>{t('shoutout.guide.step1Body')}</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input readOnly value={cfg.overlayUrl} className={`${inputClass} font-mono text-xs 3xl:text-sm`} onFocus={e => e.currentTarget.select()} />
                            <div className="flex gap-2">
                                <CopyButton text={cfg.overlayUrl} label={t('shoutout.guide.copy')} doneLabel={t('shoutout.guide.copied')} />
                                <a href={cfg.overlayUrl} target="_blank" rel="noreferrer" className={`${btnGray} shrink-0`}><ExternalLink className="w-4 h-4" /> {t('shoutout.guide.open')}</a>
                            </div>
                        </div>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>{t('shoutout.guide.obs1')}</li>
                            <li>{t('shoutout.guide.obs2')}</li>
                            <li>{t('shoutout.guide.obs3', { width: cfg.layout.canvas.width, height: cfg.layout.canvas.height })}</li>
                        </ol>
                    </>
                ))}
                {step(2, t('shoutout.guide.step2Title'), <p>{t('shoutout.guide.step2Body')} {link('theme', t('shoutout.guide.goTheme'))}</p>)}
                {step(3, t('shoutout.guide.step3Title'), <p>{t('shoutout.guide.step3Body')}</p>)}
                {step(4, t('shoutout.guide.step4Title'), (
                    <>
                        <p>{t('shoutout.guide.step4Body')}</p>
                        <code className="inline-block px-2 py-1 rounded bg-[#f1f5f9] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-mono">!so @usuario</code>
                        <p>{t('shoutout.guide.step4Perms')} {link('permissions', t('shoutout.guide.goPermissions'))}</p>
                    </>
                ))}
            </div>
        </Card>
    );
}

// ── General ────────────────────────────────────────────────────────────────

export function GeneralTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const { layout, setElement } = useLayoutEdit(cfg);
    const s = cfg.settings;
    const timer = layout.elements.find(e => e.kind === 'timer');
    return (
        <div className="space-y-6">
            <Card title={t('shoutout.general.timeTitle')}>
                <div className="space-y-5">
                    <Field label={t('shoutout.general.duration')} hint={t('shoutout.general.durationHint')}>
                        <Slider value={s.duration} min={DURATION_RANGE.min} max={DURATION_RANGE.max} onChange={v => cfg.update({ duration: v })} suffix="s" />
                    </Field>
                    <Field label={t('shoutout.general.cooldown')} hint={t('shoutout.general.cooldownHint')}>
                        <Slider value={s.cooldown} min={COOLDOWN_RANGE.min} max={COOLDOWN_RANGE.max} step={5} onChange={v => cfg.update({ cooldown: v })} suffix="s" />
                    </Field>
                </div>
            </Card>
            {timer && (
                <Card title={t('shoutout.general.debugTitle')}>
                    <Toggle checked={timer.enabled} onChange={v => setElement(timer.id, { enabled: v })} label={t('shoutout.general.showTimer')} hint={t('shoutout.general.showTimerHint')} />
                </Card>
            )}
        </div>
    );
}

// ── Clip ───────────────────────────────────────────────────────────────────

export function ClipTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: ShoutoutTabId) => void }) {
    const { t } = useTranslation('overlays');
    const { layout, setElement, setOptions } = useLayoutEdit(cfg);
    const s = cfg.settings;
    const clip = layout.elements.find(e => e.kind === 'clip');
    return (
        <div className="space-y-6">
            <Card title={t('shoutout.clip.pickTitle')} description={t('shoutout.clip.pickDescription')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                    {CLIP_MODES.map(m => (
                        <button key={m} onClick={() => cfg.update({ clipMode: m })} className={`${choice(s.clipMode === m)} text-left`}>
                            <span className="block">{t(`shoutout.clip.modes.${m}`)}</span>
                            <span className="block text-xs 3xl:text-sm font-normal opacity-80 mt-0.5">{t(`shoutout.clip.modesHint.${m}`)}</span>
                        </button>
                    ))}
                </div>
                <div className="space-y-4">
                    {s.clipMode === 'days' && (
                        <Field label={t('shoutout.clip.days')}>
                            <Slider value={s.clipDays} min={1} max={365} onChange={v => cfg.update({ clipDays: v })} suffix={t('shoutout.clip.daysSuffix')} />
                        </Field>
                    )}
                    {(s.clipMode === 'days' || s.clipMode === 'recent') && (
                        <Toggle checked={s.clipFallback} onChange={v => cfg.update({ clipFallback: v })} label={t('shoutout.clip.fallback')} hint={t('shoutout.clip.fallbackHint')} />
                    )}
                </div>
            </Card>

            {clip && (
                <Card title={t('shoutout.clip.noClipTitle')} description={t('shoutout.clip.noClipDescription')}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
                        {(['hide', 'avatar', 'offline'] as const).map(m => (
                            <button key={m} onClick={() => setOptions(clip.id, { noClip: m })} className={`${choice((clip.options.noClip ?? 'hide') === m)} text-left`}>
                                <span className="block">{t(`shoutout.clip.noClipModes.${m}`)}</span>
                                <span className="block text-xs 3xl:text-sm font-normal opacity-80 mt-0.5">{t(`shoutout.clip.noClipModesHint.${m}`)}</span>
                            </button>
                        ))}
                    </div>
                    <Field label={t('shoutout.clip.noClipSeconds')} hint={t('shoutout.clip.noClipSecondsHint')}>
                        <Slider value={s.noClipSeconds} min={NO_CLIP_RANGE.min} max={NO_CLIP_RANGE.max} onChange={v => cfg.update({ noClipSeconds: v })} suffix="s" />
                    </Field>
                    <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-3">{t('shoutout.clip.noClipPreview')}</p>
                </Card>
            )}

            {clip && (
                <Card title={t('shoutout.clip.soundTitle')}>
                    <div className="space-y-4">
                        <Field label={t('shoutout.clip.volume')} hint={t('shoutout.clip.volumeHint')}>
                            <Slider value={clip.options.volume ?? 100} min={0} max={100} step={5} onChange={v => setOptions(clip.id, { volume: v })} suffix="%" />
                        </Field>
                        {!clip.enabled && (
                            <p className="text-sm 3xl:text-base text-amber-600 dark:text-amber-400">
                                {t('shoutout.clip.hiddenWarning')} <button className="underline font-bold" onClick={() => setElement(clip.id, { enabled: true })}>{t('shoutout.clip.showClip')}</button>
                            </p>
                        )}
                        <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">{t('shoutout.clip.lookHint')} <button className="underline text-[#2563eb]" onClick={() => onNavigate('elements')}>{t('shoutout.clip.goElements')}</button></p>
                    </div>
                </Card>
            )}
        </div>
    );
}

// ── Tema ───────────────────────────────────────────────────────────────────

const SHADOWS: { id: string; css: string }[] = [
    { id: 'none', css: '' },
    { id: 'soft', css: '0 4px 16px rgba(0, 0, 0, 0.2)' },
    { id: 'medium', css: '0 8px 24px rgba(0, 0, 0, 0.4)' },
    { id: 'strong', css: '0 10px 30px rgba(0, 0, 0, 0.35)' },
];

function PresetThumb({ layout }: { layout: ShoutoutLayout }) {
    return (
        <div className="rounded-lg overflow-hidden pointer-events-none" style={{ background: CHECKER_BG }}>
            <ScaledCanvas width={layout.canvas.width} height={layout.canvas.height}>
                <ShoutoutRenderer layout={layout} data={SAMPLE_SHOUTOUT} phase="static" preview />
            </ScaledCanvas>
        </div>
    );
}

export function ThemeTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const { layout, set } = useLayoutEdit(cfg);
    const theme = layout.theme;
    const bg = theme.background;
    const setTheme = (patch: Partial<typeof theme>) => set({ ...layout, theme: { ...theme, ...patch } });
    const setBg = (patch: Partial<typeof bg>) => setTheme({ background: { ...bg, ...patch } });
    const shadowId = SHADOWS.find(s => s.css === theme.shadow)?.id ?? 'custom';

    const applyPreset = (build: () => ShoutoutLayout) => {
        if (!window.confirm(t('shoutout.theme.layoutConfirm'))) return;
        set(applyLayoutPreset(layout, build()));
    };

    return (
        <div className="space-y-6">
            <Card title={t('shoutout.theme.layoutsTitle')} description={t('shoutout.theme.layoutsDescription')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {LAYOUT_PRESETS.map(p => {
                        // La miniatura con los colores y fuentes actuales, como quedaría
                        const l = applyLayoutPreset(layout, p.build());
                        return (
                            <button key={p.id} onClick={() => applyPreset(p.build)} className="p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] hover:shadow-md transition-all text-left">
                                <PresetThumb layout={l} />
                                <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc] mt-2">{t(`shoutout.theme.layouts.${p.id}`)}</p>
                                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t(`shoutout.theme.layoutsHint.${p.id}`)} · {l.canvas.width}×{l.canvas.height}</p>
                            </button>
                        );
                    })}
                </div>
            </Card>

            <Card title={t('shoutout.theme.colorsTitle')} description={t('shoutout.theme.colorsDescription')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {COLOR_THEMES.map(c => (
                        <button key={c.id} onClick={() => set(applyColorTheme(layout, c))} className="text-left p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] hover:shadow-md transition-all">
                            <div className="flex h-8 rounded-lg overflow-hidden mb-2 border border-black/10">
                                {c.swatch.map((s, i) => <span key={i} className="flex-1" style={{ background: s === '#00000000' ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 10px 10px' : s }} />)}
                            </div>
                            <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">{t(`shoutout.theme.colors.${c.id}`)}</p>
                        </button>
                    ))}
                </div>
            </Card>

            <Card title={t('shoutout.theme.panelTitle')}>
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                        {(['gradient', 'solid', 'transparent'] as const).map(ty => (
                            <button key={ty} className={seg(bg.type === ty)} onClick={() => setBg({ type: ty })}>{t(`shoutout.theme.bg.${ty}`)}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bg.type === 'gradient' && (
                            <>
                                <ColorField label={t('shoutout.theme.color1')} value={bg.color1} onChange={v => setBg({ color1: v })} />
                                <ColorField label={t('shoutout.theme.color2')} value={bg.color2} onChange={v => setBg({ color2: v })} />
                                <Field label={t('shoutout.theme.angle')}><Slider value={bg.angle} min={0} max={360} onChange={v => setBg({ angle: v })} suffix="°" /></Field>
                            </>
                        )}
                        {bg.type === 'solid' && <ColorField label={t('shoutout.theme.solid')} value={bg.solid} onChange={v => setBg({ solid: v })} />}
                        {bg.type !== 'transparent' && (
                            <Field label={t('shoutout.theme.opacity')}><Slider value={bg.opacity} min={0} max={100} onChange={v => setBg({ opacity: v })} suffix="%" /></Field>
                        )}
                        <Field label={t('shoutout.theme.radius')}><Slider value={theme.radius} min={0} max={120} onChange={v => setTheme({ radius: v })} suffix="px" /></Field>
                        <Field label={t('shoutout.theme.blur')} hint={t('shoutout.theme.blurHint')}><Slider value={theme.blur} min={0} max={30} onChange={v => setTheme({ blur: v })} suffix="px" /></Field>
                        <Field label={t('shoutout.theme.shadow')}>
                            <Select
                                value={shadowId}
                                onChange={v => { const s = SHADOWS.find(x => x.id === v); if (s) setTheme({ shadow: s.css }); }}
                                options={[...SHADOWS.map(s => ({ value: s.id, label: t(`shoutout.theme.shadows.${s.id}`) })), ...(shadowId === 'custom' ? [{ value: 'custom', label: t('shoutout.theme.shadows.custom') }] : [])]}
                            />
                        </Field>
                        <ColorField label={t('shoutout.theme.accent')} value={theme.accent} onChange={v => setTheme({ accent: v })} hint={t('shoutout.theme.accentHint')} />
                    </div>
                    <Toggle checked={theme.borderEnabled} onChange={v => setTheme({ borderEnabled: v })} label={t('shoutout.theme.border')} />
                    {theme.borderEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ColorField label={t('shoutout.theme.borderColor')} value={theme.borderColor} onChange={v => setTheme({ borderColor: v })} />
                            <Field label={t('shoutout.theme.borderWidth')}><Slider value={theme.borderWidth} min={1} max={12} onChange={v => setTheme({ borderWidth: v })} suffix="px" /></Field>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

// ── Elementos ──────────────────────────────────────────────────────────────

export function ElementsTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: ShoutoutTabId) => void }) {
    const { t } = useTranslation('overlays');
    const { layout, setElement, setOptions } = useLayoutEdit(cfg);
    const label = useElementLabel();
    const list = layout.elements.filter(e => OFFERED.includes(e.kind) && e.kind !== 'timer');

    const body = (e: ShoutoutElement): ReactNode => {
        const o = e.options;
        switch (e.kind) {
            case 'clip':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label={t('shoutout.elementsTab.radius')}><Slider value={o.radius} min={0} max={80} onChange={v => setOptions(e.id, { radius: v })} suffix="px" /></Field>
                        <Field label={t('shoutout.elementsTab.borderWidth')}><Slider value={o.borderWidth} min={0} max={12} onChange={v => setOptions(e.id, { borderWidth: v })} suffix="px" /></Field>
                        {o.borderWidth > 0 && <ColorField label={t('shoutout.elementsTab.borderColor')} value={o.borderColor} onChange={v => setOptions(e.id, { borderColor: v })} />}
                        <div className="pt-5"><Toggle checked={!!o.shadow} onChange={v => setOptions(e.id, { shadow: v })} label={t('shoutout.elementsTab.shadow')} /></div>
                    </div>
                );
            case 'avatar':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label={t('shoutout.elementsTab.shape')}>
                            <Select value={o.shape} onChange={v => setOptions(e.id, { shape: v })} options={['circle', 'rounded', 'square'].map(s => ({ value: s, label: t(`shoutout.elementsTab.shapes.${s}`) }))} />
                        </Field>
                        {o.shape === 'rounded' && <Field label={t('shoutout.elementsTab.radius')}><Slider value={o.radius} min={0} max={80} onChange={v => setOptions(e.id, { radius: v })} suffix="px" /></Field>}
                        <Field label={t('shoutout.elementsTab.borderWidth')}><Slider value={o.borderWidth} min={0} max={12} onChange={v => setOptions(e.id, { borderWidth: v })} suffix="px" /></Field>
                        {o.borderWidth > 0 && <ColorField label={t('shoutout.elementsTab.borderColor')} value={o.borderColor} onChange={v => setOptions(e.id, { borderColor: v })} />}
                        <div className="pt-5"><Toggle checked={!!o.shadow} onChange={v => setOptions(e.id, { shadow: v })} label={t('shoutout.elementsTab.shadow')} /></div>
                    </div>
                );
            case 'progress':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ColorField label={t('shoutout.elementsTab.fill')} value={o.fill || layout.theme.accent} onChange={v => setOptions(e.id, { fill: v })} hint={t('shoutout.elementsTab.fillHint')} />
                        <ColorField label={t('shoutout.elementsTab.track')} value={o.track} onChange={v => setOptions(e.id, { track: v })} />
                        <Field label={t('shoutout.elementsTab.radius')}><Slider value={o.radius} min={0} max={20} onChange={v => setOptions(e.id, { radius: v })} suffix="px" /></Field>
                    </div>
                );
            case 'shape': {
                // Franja: degradado de transparente a negro; la opacidad es la del final
                const m = /rgba\(0,0,0,([\d.]+)\) 100%/.exec(String(o.background).replace(/\s/g, ''));
                const dark = m ? Math.round(Number(m[1]) * 100) : 85;
                return (
                    <Field label={t('shoutout.elementsTab.darkness')} hint={t('shoutout.elementsTab.darknessHint')}>
                        <Slider value={dark} min={0} max={100} onChange={v => setOptions(e.id, { background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,${v / 100}) 100%)` })} suffix="%" />
                    </Field>
                );
            }
            case 'live':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label={t('shoutout.elementsTab.liveLabel')}><input className={inputClass} value={o.label} maxLength={20} onChange={ev => setOptions(e.id, { label: ev.target.value })} /></Field>
                        <ColorField label={t('shoutout.elementsTab.liveBackground')} value={o.background} onChange={v => setOptions(e.id, { background: v })} />
                        <Toggle checked={!!o.pulse} onChange={v => setOptions(e.id, { pulse: v })} label={t('shoutout.elementsTab.pulse')} />
                    </div>
                );
            case 'badge':
                return <Toggle checked={!!o.showAffiliate} onChange={v => setOptions(e.id, { showAffiliate: v })} label={t('shoutout.elementsTab.showAffiliate')} hint={t('shoutout.elementsTab.showAffiliateHint')} />;
            case 'text':
                return <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">{t('shoutout.elementsTab.textHint')} <button className="underline text-[#2563eb]" onClick={() => onNavigate('text')}>{t('shoutout.elementsTab.goText')}</button></p>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">{t('shoutout.elementsTab.description')} <button className="underline text-[#2563eb]" onClick={() => onNavigate('editor')}>{t('shoutout.elementsTab.goEditor')}</button></p>
            {list.map(e => {
                const content = e.enabled ? body(e) : null;
                return (
                    <Card key={e.id} title={label(e, layout)} description={t(`shoutout.elementsTab.hints.${e.kind}`)}
                        actions={<Toggle checked={e.enabled} onChange={v => setElement(e.id, { enabled: v })} label="" />}>
                        {content ?? <p className="text-sm 3xl:text-base text-[#94a3b8]">{e.enabled ? '' : t('shoutout.elementsTab.hidden')}</p>}
                    </Card>
                );
            })}
        </div>
    );
}

// ── Texto ──────────────────────────────────────────────────────────────────

export function TextTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const { layout, ref, set, setText } = useLayoutEdit(cfg);
    const label = useElementLabel();
    const blocks = layout.elements.filter(e => e.kind === 'text');
    const focused = useRef<{ id: string; index: number } | null>(null);

    const setLine = (e: ShoutoutElement, index: number, patch: Partial<TextLine>) =>
        setText(e.id, { lines: e.text!.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) });

    const insertVariable = (v: string) => {
        const f = focused.current;
        const e = f && ref.current.elements.find(x => x.id === f.id);
        if (!f || !e?.text?.lines[f.index]) return;
        setLine(e, f.index, { text: `${e.text.lines[f.index].text} ${v}`.trim() });
    };

    const addBlock = () => {
        const n = layout.elements.filter(e => e.kind === 'text').length + 1;
        const prev = blocks[0]?.text;
        const w = Math.min(500, layout.canvas.width - 40);
        const block = element(`text-${Date.now().toString(36)}`, 'text', { x: Math.round((layout.canvas.width - w) / 2), y: Math.round(layout.canvas.height / 2 - 20), width: w, height: 40 }, {
            text: textBlock({ ...(prev ? { fontFamily: prev.fontFamily, color: prev.color, shadow: prev.shadow, outline: prev.outline } : {}), gap: 4, lines: [{ text: t('shoutout.text.newLine', { n }), fontSize: 24, fontWeight: '600', enabled: true }] }),
        });
        // Antes del contador, que va siempre encima
        const els = [...layout.elements];
        const ti = els.findIndex(e => e.kind === 'timer');
        els.splice(ti < 0 ? els.length : ti, 0, block);
        set({ ...layout, elements: els });
    };

    const removeBlock = (id: string) => {
        if (!window.confirm(t('shoutout.text.removeBlockConfirm'))) return;
        set({ ...layout, elements: layout.elements.filter(e => e.id !== id) });
    };

    const moveLine = (e: ShoutoutElement, index: number, dir: -1 | 1) => {
        const lines = [...e.text!.lines];
        const j = index + dir;
        if (j < 0 || j >= lines.length) return;
        [lines[index], lines[j]] = [lines[j], lines[index]];
        setText(e.id, { lines });
    };

    return (
        <div className="space-y-6">
            <Card title={t('shoutout.text.variablesTitle')} description={t('shoutout.text.variablesDescription')}>
                <div className="flex flex-wrap gap-2">
                    {VARIABLES.map(v => (
                        <button key={v} onMouseDown={ev => ev.preventDefault()} onClick={() => insertVariable(v)} className="px-2.5 py-1.5 rounded-lg font-mono text-xs 3xl:text-sm bg-[#f1f5f9] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]" title={t(`shoutout.text.vars.${v.slice(1)}`)}>
                            {v}
                        </button>
                    ))}
                </div>
                <ul className="mt-3 text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8] space-y-0.5">
                    {VARIABLES.map(v => <li key={v}><span className="font-mono">{v}</span>: {t(`shoutout.text.vars.${v.slice(1)}`)}</li>)}
                </ul>
            </Card>

            {blocks.map(e => {
                const tb = e.text!;
                return (
                    <Card key={e.id} title={label(e, layout)}
                        actions={<button onClick={() => removeBlock(e.id)} className="p-2 rounded-lg text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title={t('shoutout.text.removeBlock')}><Trash2 className="w-4 h-4" /></button>}>
                        <div className="space-y-3 mb-5">
                            {tb.lines.map((l, i) => (
                                <div key={i} className={`p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] space-y-2 ${l.enabled ? '' : 'opacity-60'}`}>
                                    <div className="flex items-center gap-2">
                                        <input
                                            className={inputClass}
                                            value={l.text}
                                            maxLength={200}
                                            onFocus={() => { focused.current = { id: e.id, index: i }; }}
                                            onChange={ev => setLine(e, i, { text: ev.target.value })}
                                            placeholder={t('shoutout.text.linePlaceholder')}
                                        />
                                        <button onClick={() => setLine(e, i, { enabled: !l.enabled })} className="p-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-white" title={l.enabled ? t('shoutout.text.hideLine') : t('shoutout.text.showLine')}>
                                            {l.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => moveLine(e, i, -1)} disabled={i === 0} className="p-1 text-[#64748b] disabled:opacity-30" title={t('shoutout.text.moveUp')}><ChevronUp className="w-4 h-4" /></button>
                                        <button onClick={() => moveLine(e, i, 1)} disabled={i === tb.lines.length - 1} className="p-1 text-[#64748b] disabled:opacity-30" title={t('shoutout.text.moveDown')}><ChevronDown className="w-4 h-4" /></button>
                                        <button onClick={() => setText(e.id, { lines: tb.lines.filter((_, j) => j !== i) })} disabled={tb.lines.length <= 1} className="p-2 text-[#94a3b8] hover:text-red-600 disabled:opacity-30" title={t('shoutout.text.removeLine')}><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label={t('shoutout.text.size')}><NumberInput value={l.fontSize} min={8} max={160} onChange={v => setLine(e, i, { fontSize: v })} /></Field>
                                        <Field label={t('shoutout.text.weight')}>
                                            <Select value={l.fontWeight} onChange={v => setLine(e, i, { fontWeight: v })} options={[
                                                ...['400', '500', '600', 'bold', '800'].map(w => ({ value: w, label: t(`shoutout.text.weights.${w}`) })),
                                                ...(['400', '500', '600', 'bold', '800'].includes(l.fontWeight) ? [] : [{ value: l.fontWeight, label: l.fontWeight }]),
                                            ]} />
                                        </Field>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setText(e.id, { lines: [...tb.lines, { text: '', fontSize: tb.lines[tb.lines.length - 1]?.fontSize ?? 24, fontWeight: '600', enabled: true }] })} className={btnGray}>
                                <Plus className="w-4 h-4" /> {t('shoutout.text.addLine')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label={t('shoutout.text.font')}>
                                <select className={inputClass} value={tb.fontFamily} onChange={ev => setText(e.id, { fontFamily: ev.target.value })}>
                                    {[...new Set([tb.fontFamily, ...FONT_OPTIONS])].map(f => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
                                </select>
                            </Field>
                            <ColorField label={t('shoutout.text.color')} value={tb.color} onChange={v => setText(e.id, { color: v })} />
                            <Field label={t('shoutout.text.align')}>
                                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                                    {(['left', 'center', 'right'] as const).map(a => <button key={a} className={seg(tb.align === a)} onClick={() => setText(e.id, { align: a })}>{t(`shoutout.text.aligns.${a}`)}</button>)}
                                </div>
                            </Field>
                            <Field label={t('shoutout.text.shadow')}>
                                <Select value={tb.shadow} onChange={v => setText(e.id, { shadow: v })} options={(['none', 'normal', 'strong', 'glow'] as const).map(s => ({ value: s, label: t(`shoutout.text.shadows.${s}`) }))} />
                            </Field>
                            <Field label={t('shoutout.text.gap')}><Slider value={tb.gap} min={0} max={40} onChange={v => setText(e.id, { gap: v })} suffix="px" /></Field>
                            <Field label={t('shoutout.text.letterSpacing')}><Slider value={tb.letterSpacing ?? 0} min={-2} max={10} step={0.5} onChange={v => setText(e.id, { letterSpacing: v })} suffix="px" /></Field>
                            <Toggle checked={!!tb.uppercase} onChange={v => setText(e.id, { uppercase: v })} label={t('shoutout.text.uppercase')} />
                            <Toggle checked={tb.outline.enabled} onChange={v => setText(e.id, { outline: { ...tb.outline, enabled: v } })} label={t('shoutout.text.outline')} />
                            {tb.outline.enabled && (
                                <>
                                    <ColorField label={t('shoutout.text.outlineColor')} value={tb.outline.color} onChange={v => setText(e.id, { outline: { ...tb.outline, color: v } })} />
                                    <Field label={t('shoutout.text.outlineWidth')}><Slider value={tb.outline.width} min={1} max={8} onChange={v => setText(e.id, { outline: { ...tb.outline, width: v } })} suffix="px" /></Field>
                                </>
                            )}
                        </div>
                        {tb.anchor && <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-4">{t('shoutout.text.anchorHint')}</p>}
                    </Card>
                );
            })}

            <button onClick={addBlock} className={btnGray}><Plus className="w-4 h-4" /> {t('shoutout.text.addBlock')}</button>
        </div>
    );
}

// ── Animaciones ────────────────────────────────────────────────────────────

const ANIMATIONS: AnimationType[] = ['none', 'fade', 'fade-scale', 'slide', 'bounce', 'pop', 'zoom', 'rotate', 'flip', 'glitch'];
const WITH_DIRECTION: AnimationType[] = ['slide', 'bounce', 'flip'];

function AnimationCard({ title, description, value, onChange }: { title: string; description: string; value: ShowHideAnimation; onChange: (v: ShowHideAnimation) => void }) {
    const { t } = useTranslation('overlays');
    const set = (patch: Partial<ShowHideAnimation>) => onChange({ ...value, ...patch });
    const directions: Direction[] = ['left', 'right', 'top', 'bottom'];
    const easings: Easing[] = ['ease', 'ease-out', 'ease-in', 'ease-in-out', 'linear'];
    return (
        <Card title={title} description={description}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
                {ANIMATIONS.map(a => <button key={a} className={choice(value.type === a)} onClick={() => set({ type: a })}>{t(`shoutout.animations.names.${a}`)}</button>)}
            </div>
            {value.type !== 'none' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {WITH_DIRECTION.includes(value.type) && (
                        <Field label={t('shoutout.animations.direction')}>
                            <Select value={value.direction} onChange={v => set({ direction: v })} options={directions.map(d => ({ value: d, label: t(`shoutout.animations.directions.${d}`) }))} />
                        </Field>
                    )}
                    <Field label={t('shoutout.animations.easing')}>
                        <Select value={value.easing} onChange={v => set({ easing: v })} options={easings.map(e => ({ value: e, label: t(`shoutout.animations.easings.${e}`) }))} />
                    </Field>
                    <Field label={t('shoutout.animations.duration')}><Slider value={value.durationMs} min={100} max={3000} step={50} onChange={v => set({ durationMs: v })} suffix="ms" /></Field>
                </div>
            )}
        </Card>
    );
}

export function AnimationsTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const { layout, set } = useLayoutEdit(cfg);
    const a = layout.animations;
    return (
        <div className="space-y-6">
            <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">{t('shoutout.animations.hint')}</p>
            <AnimationCard title={t('shoutout.animations.enterTitle')} description={t('shoutout.animations.enterDescription')} value={a.enter} onChange={v => set({ ...layout, animations: { ...a, enter: v } })} />
            <AnimationCard title={t('shoutout.animations.exitTitle')} description={t('shoutout.animations.exitDescription')} value={a.exit} onChange={v => set({ ...layout, animations: { ...a, exit: v } })} />
        </div>
    );
}

// ── Editor ─────────────────────────────────────────────────────────────────

export function EditorTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const { layout, ref, set, setElement } = useLayoutEdit(cfg);
    const label = useElementLabel();

    const onRectChange = useCallback((id: string, patch: Partial<Rect>) => {
        const l = ref.current;
        set({ ...l, elements: l.elements.map(e => (e.id === id ? { ...e, ...patch } : e)) });
    }, [ref, set]);

    return (
        <OverlayCanvasEditor
            canvas={layout.canvas}
            elements={layout.elements.filter(e => OFFERED.includes(e.kind)).map(e => ({
                id: e.id, label: label(e, layout), x: e.x, y: e.y, width: e.width, height: e.height, enabled: e.enabled,
                zIndex: e.kind === 'panel' ? 1 : e.kind === 'clip' || e.kind === 'shape' ? 5 : 10,
            }))}
            onRectChange={onRectChange}
            onToggle={(id, enabled) => setElement(id, { enabled })}
            initialSelected={layout.elements.find(e => e.kind === 'text')?.id}
            title={t('shoutout.editor.title')}
            description={t('shoutout.editor.description')}
            onCanvasChange={size => set({ ...ref.current, canvas: size })}
        >
            <ShoutoutRenderer layout={layout} data={SAMPLE_SHOUTOUT} phase="static" preview remaining={cfg.settings.duration} labels={{ clip: t('shoutout.preview.sampleClip') }} />
        </OverlayCanvasEditor>
    );
}

// ── Automático ─────────────────────────────────────────────────────────────

interface NativeStatus {
    tokenValid: boolean;
    botLogin: string | null;
    hasScope: boolean;
    last: { at: string; ok: boolean; status: number; error: string | null; target: string } | null;
}

function NativeStatusBox() {
    const { t } = useTranslation('overlays');
    const [status, setStatus] = useState<NativeStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        try { setStatus((await api.get('/shoutout/native-status')).data); } catch { setStatus(null); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const row = (ok: boolean | 'info', text: string) => (
        <li className="flex items-start gap-2">
            {ok === 'info' ? <Info className="w-4 h-4 mt-0.5 text-[#64748b] shrink-0" /> : ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />}
            <span>{text}</span>
        </li>
    );
    const lastText = (l: NonNullable<NativeStatus['last']>) => {
        if (l.ok) return t('shoutout.auto.native.lastOk', { user: l.target });
        if (l.error === 'channel_cooldown' || l.error === 'target_cooldown') return t(`shoutout.auto.native.${l.error}`, { user: l.target });
        return t('shoutout.auto.native.lastError', { user: l.target, error: l.error || l.status });
    };

    return (
        <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-4 text-sm 3xl:text-base text-[#475569] dark:text-[#cbd5e1]">
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('shoutout.auto.native.statusTitle')}</span>
                <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-[#262626] disabled:opacity-50" title={t('shoutout.auto.native.refresh')}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            {!status ? (
                <p className="text-[#94a3b8]">{loading ? t('shoutout.auto.native.checking') : t('shoutout.auto.native.unknown')}</p>
            ) : (
                <ul className="space-y-1.5">
                    {row(status.tokenValid && status.hasScope, status.tokenValid && status.hasScope ? t('shoutout.auto.native.scopeOk', { bot: status.botLogin }) : t('shoutout.auto.native.scopeMissing'))}
                    {row('info', t('shoutout.auto.native.modNote', { bot: status.botLogin || 'bot' }))}
                    {row('info', t('shoutout.auto.native.liveNote'))}
                    {status.last && row(status.last.ok, lastText(status.last))}
                </ul>
            )}
        </div>
    );
}

export function AutoTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const s = cfg.settings;
    const inputRef = useRef<HTMLInputElement>(null);
    const chatVars = [...VARIABLES, '@url'];
    const sampleMessage = (tpl: string) => fillVariables(tpl, SAMPLE_SHOUTOUT).split('@url').join(`twitch.tv/${SAMPLE_SHOUTOUT.targetUser}`);
    const insert = (v: string) => {
        const el = inputRef.current;
        const text = s.chatMessage;
        const at = el?.selectionStart ?? text.length;
        cfg.update({ chatMessage: `${text.slice(0, at)}${v}${text.slice(at)}`.slice(0, 400) });
    };

    return (
        <div className="space-y-6">
            <Card title={t('shoutout.auto.queueTitle')}>
                <Toggle checked={s.queueEnabled} onChange={v => cfg.update({ queueEnabled: v })} label={t('shoutout.auto.queue')} hint={t('shoutout.auto.queueHint')} />
            </Card>

            <Card title={t('shoutout.auto.chatTitle')} description={t('shoutout.auto.chatDescription')}>
                <div className="space-y-4">
                    <Toggle checked={s.chatEnabled} onChange={v => cfg.update({ chatEnabled: v })} label={t('shoutout.auto.chatEnabled')} />
                    {s.chatEnabled && (
                        <>
                            <Field label={t('shoutout.auto.chatMessage')} hint={t('shoutout.auto.chatMessageHint')}>
                                <input ref={inputRef} className={inputClass} value={s.chatMessage} maxLength={400} placeholder={t('shoutout.auto.chatPlaceholder')} onChange={e => cfg.update({ chatMessage: e.target.value })} />
                            </Field>
                            <div className="flex flex-wrap gap-2">
                                {chatVars.map(v => (
                                    <button key={v} onMouseDown={e => e.preventDefault()} onClick={() => insert(v)} className="px-2.5 py-1.5 rounded-lg font-mono text-xs 3xl:text-sm bg-[#f1f5f9] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]">{v}</button>
                                ))}
                            </div>
                            <div className="rounded-xl bg-[#f8fafc] dark:bg-[#111] border border-[#e2e8f0] dark:border-[#374151] p-3 text-sm 3xl:text-base">
                                <span className="text-xs 3xl:text-sm font-bold uppercase text-[#94a3b8] block mb-1">{t('shoutout.auto.chatPreview')}</span>
                                <span className="text-[#1e293b] dark:text-[#f8fafc]">{sampleMessage(s.chatMessage.trim() || t('shoutout.auto.chatDefault'))}</span>
                            </div>
                        </>
                    )}
                </div>
            </Card>

            <Card title={t('shoutout.auto.nativeTitle')} description={t('shoutout.auto.nativeDescription')}>
                <div className="space-y-4">
                    <Toggle checked={s.nativeEnabled} onChange={v => cfg.update({ nativeEnabled: v })} label={t('shoutout.auto.nativeEnabled')} hint={t('shoutout.auto.nativeHint')} />
                    <NativeStatusBox />
                </div>
            </Card>

            <Card title={t('shoutout.auto.raidTitle')} description={t('shoutout.auto.raidDescription')}>
                <div className="space-y-4">
                    <Toggle checked={s.raidEnabled} onChange={v => cfg.update({ raidEnabled: v })} label={t('shoutout.auto.raidEnabled')} />
                    {s.raidEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label={t('shoutout.auto.raidMinViewers')} hint={t('shoutout.auto.raidMinViewersHint')}>
                                <NumberInput value={s.raidMinViewers} min={1} max={100000} onChange={v => cfg.update({ raidMinViewers: v })} />
                            </Field>
                            <Field label={t('shoutout.auto.raidDelay')} hint={t('shoutout.auto.raidDelayHint')}>
                                <Slider value={s.raidDelaySeconds} min={0} max={60} onChange={v => cfg.update({ raidDelaySeconds: v })} suffix="s" />
                            </Field>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

// ── Permisos ───────────────────────────────────────────────────────────────

function UserList({ title, description, color, users, onChange, empty }: { title: string; description: string; color: 'red' | 'green'; users: string[]; onChange: (u: string[]) => void; empty: string }) {
    const { t } = useTranslation('overlays');
    const [value, setValue] = useState('');
    const add = () => {
        const u = value.trim().replace(/^@/, '').toLowerCase();
        if (!u || users.includes(u)) { setValue(''); return; }
        onChange([...users, u]);
        setValue('');
    };
    return (
        <Card title={title} description={description} actions={<Shield className={`w-5 h-5 ${color === 'red' ? 'text-red-600' : 'text-green-600'}`} />}>
            <form className="flex gap-2 mb-4" onSubmit={e => { e.preventDefault(); add(); }}>
                <input value={value} onChange={e => setValue(e.target.value)} placeholder={t('shoutout.permissions.placeholder')} className={inputClass} maxLength={50} />
                <button type="submit" disabled={!value.trim()} className={`${btnBase} text-white shrink-0 ${color === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}><Plus className="w-4 h-4" /> {t('shoutout.permissions.add')}</button>
            </form>
            {users.length === 0 ? (
                <p className="text-sm 3xl:text-base text-[#94a3b8]">{empty}</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {users.map(u => (
                        <span key={u} className={`flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-lg text-sm 3xl:text-base font-mono border ${color === 'red' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'} text-[#1e293b] dark:text-[#f8fafc]`}>
                            @{u}
                            <button onClick={() => onChange(users.filter(x => x !== u))} className="p-1 rounded text-[#94a3b8] hover:text-red-600" title={t('shoutout.permissions.remove')}><Trash2 className="w-3.5 h-3.5" /></button>
                        </span>
                    ))}
                </div>
            )}
        </Card>
    );
}

export function PermissionsTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    return (
        <div className="space-y-6">
            <UserList title={t('shoutout.permissions.whitelistTitle')} description={t('shoutout.permissions.whitelistDescription')} color="green"
                users={cfg.settings.whitelist} onChange={u => cfg.update({ whitelist: u })} empty={t('shoutout.permissions.whitelistEmpty')} />
            <UserList title={t('shoutout.permissions.blacklistTitle')} description={t('shoutout.permissions.blacklistDescription')} color="red"
                users={cfg.settings.blacklist} onChange={u => cfg.update({ blacklist: u })} empty={t('shoutout.permissions.blacklistEmpty')} />
        </div>
    );
}
