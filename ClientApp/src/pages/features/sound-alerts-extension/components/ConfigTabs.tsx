import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Plus, Eye, EyeOff, Trash2, RotateCcw } from 'lucide-react';
import { Card, Field, Toggle, Slider, Select, ColorField, CopyButton, inputClass } from '../../../../components/overlay-editor/ui';
import type { SoundAlertsConfigState } from '../hooks/useSoundAlertsConfig';
import type { PlacedLine, TabId } from '../types';
import {
    ANIMATION_SPEED_OPTIONS, ANIMATION_TYPE_OPTIONS, BACKGROUND_TYPE_OPTIONS, DEFAULT_LAYOUT, DEFAULT_STYLES,
    DEFAULT_TEXT_LINES, FONT_OPTIONS, FONT_WEIGHT_OPTIONS, FULL_CANVAS, SHADOW_OPTIONS,
} from '../constants/defaults';
import { newLine, placeLines } from '../model';

interface TabProps { cfg: SoundAlertsConfigState }

export function overlayUrl(channel: string) {
    return `${window.location.origin}/overlay/soundalerts?channel=${channel || 'tu_canal'}`;
}

// ── Guía ───────────────────────────────────────────────────────────────────────

export function GuideTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: TabId) => void }) {
    const { t } = useTranslation('overlays');
    const url = overlayUrl(cfg.channelName);
    const assigned = cfg.files.length;
    const step = (n: number, title: string, body: React.ReactNode) => (
        <div className="flex gap-4">
            <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-[#2563eb] text-white font-black flex items-center justify-center text-sm 3xl:text-base">{n}</span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] space-y-2">{body}</div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {!cfg.settings.globalEnabled && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm 3xl:text-base">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        {t('soundAlerts.guide.disabledWarning')}{' '}
                        <button className="underline font-bold" onClick={() => onNavigate('basic')}>{t('soundAlerts.guide.goBasic')}</button>
                    </div>
                </div>
            )}
            <Card title={t('soundAlerts.guide.title')} description={t('soundAlerts.guide.description')}>
                <div className="space-y-6">
                    {step(1, t('soundAlerts.guide.step1Title'), (
                        <>
                            <p>{t('soundAlerts.guide.step1Body')}</p>
                            <p className="font-semibold">
                                {t('soundAlerts.guide.assigned', { count: assigned, total: cfg.rewards.length })}{' '}
                                <button className="underline text-[#2563eb]" onClick={() => onNavigate('rewards')}>{t('soundAlerts.guide.goRewards')}</button>
                            </p>
                        </>
                    ))}
                    {step(2, t('soundAlerts.guide.step2Title'), (
                        <>
                            <p>{t('soundAlerts.guide.step2Body')}</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input readOnly value={url} className={`${inputClass} font-mono text-xs 3xl:text-sm`} onFocus={e => e.currentTarget.select()} />
                                <div className="flex gap-2">
                                    <CopyButton text={url} label={t('soundAlerts.guide.copy')} doneLabel={t('soundAlerts.guide.copied')} />
                                    <a href={url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] flex items-center gap-1.5 shrink-0">
                                        <ExternalLink className="w-4 h-4" /> {t('soundAlerts.guide.open')}
                                    </a>
                                </div>
                            </div>
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>{t('soundAlerts.guide.obs1')}</li>
                                <li>{t('soundAlerts.guide.obs2')}</li>
                                <li>{t('soundAlerts.guide.obs3')}</li>
                                <li>{t('soundAlerts.guide.obs4')}</li>
                            </ol>
                        </>
                    ))}
                    {step(3, t('soundAlerts.guide.step3Title'), <p>{t('soundAlerts.guide.step3Body')}</p>)}
                    {step(4, t('soundAlerts.guide.step4Title'), (
                        <p>
                            {t('soundAlerts.guide.step4Body')}{' '}
                            <button className="underline text-[#2563eb]" onClick={() => onNavigate('editor')}>{t('soundAlerts.guide.goEditor')}</button>
                        </p>
                    ))}
                </div>
            </Card>
        </div>
    );
}

// ── Básico ─────────────────────────────────────────────────────────────────────

export function BasicTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const s = cfg.settings;

    const resetDesign = () => {
        if (!window.confirm(t('soundAlerts.basic.resetConfirm'))) return;
        cfg.updateDesign(prev => {
            const layout = { ...DEFAULT_LAYOUT, panel: { ...FULL_CANVAS } };
            return {
                ...prev,
                layout,
                textLines: placeLines(DEFAULT_TEXT_LINES, layout.text),
                styles: { ...DEFAULT_STYLES },
                animation: { type: 'fade', speed: 'normal' },
                textOutline: { enabled: false, color: '#000000', width: 2 },
            };
        });
    };

    return (
        <div className="space-y-6">
            <Card title={t('soundAlerts.basic.title')}>
                <div className="space-y-6">
                    <Toggle checked={s.globalEnabled} onChange={v => cfg.update({ globalEnabled: v })} label={t('soundAlerts.basic.enabled')} hint={t('soundAlerts.basic.enabledHint')} />
                    <Field label={t('soundAlerts.basic.volume')} hint={t('soundAlerts.basic.volumeHint')}>
                        <Slider value={s.globalVolume} min={0} max={100} suffix="%" onChange={v => cfg.update({ globalVolume: v })} />
                    </Field>
                    <Field label={t('soundAlerts.basic.duration')} hint={t('soundAlerts.basic.durationHint')}>
                        <Slider value={s.duration} min={3} max={30} suffix=" s" onChange={v => cfg.update({ duration: v })} />
                    </Field>
                    <Field label={t('soundAlerts.basic.cooldown')} hint={t('soundAlerts.basic.cooldownHint')}>
                        <Slider value={s.cooldownMs / 1000} min={0} max={10} step={0.5} suffix=" s" onChange={v => cfg.update({ cooldownMs: Math.round(v * 1000) })} />
                    </Field>
                </div>
            </Card>
            <Card title={t('soundAlerts.basic.resetTitle')} description={t('soundAlerts.basic.resetDescription')}>
                <button onClick={resetDesign} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]">
                    <RotateCcw className="w-4 h-4" /> {t('soundAlerts.basic.reset')}
                </button>
            </Card>
        </div>
    );
}

// ── Textos ─────────────────────────────────────────────────────────────────────

export function LineFields({ line, onChange }: { line: PlacedLine; onChange: (patch: Partial<PlacedLine>) => void }) {
    const { t } = useTranslation('overlays');
    return (
        <div className="space-y-3">
            <Field label={t('soundAlerts.texts.text')} hint={t('soundAlerts.texts.variables')}>
                <input className={inputClass} value={line.text} onChange={e => onChange({ text: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label={t('soundAlerts.texts.size')}>
                    <Slider value={line.fontSize} min={12} max={120} suffix=" px" onChange={v => onChange({ fontSize: v })} />
                </Field>
                <Field label={t('soundAlerts.texts.weight')}>
                    <Select value={line.fontWeight as typeof FONT_WEIGHT_OPTIONS[number]} onChange={v => onChange({ fontWeight: v })}
                        options={FONT_WEIGHT_OPTIONS.map(w => ({ value: w, label: t(`soundAlerts.texts.weights.${w}`) }))} />
                </Field>
            </div>
            <Field label={t('soundAlerts.texts.align')}>
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                    {(['left', 'center', 'right'] as const).map(a => (
                        <button key={a} onClick={() => onChange({ align: a })}
                            className={`px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${line.align === a ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`}>
                            {t(`soundAlerts.texts.aligns.${a}`)}
                        </button>
                    ))}
                </div>
            </Field>
        </div>
    );
}

export function TextsTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const d = cfg.settings.design;
    const lines = d.textLines;
    const setLine = (i: number, patch: Partial<PlacedLine>) =>
        cfg.updateDesign(prev => ({ ...prev, textLines: prev.textLines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
    const removeLine = (i: number) => cfg.updateDesign(prev => ({ ...prev, textLines: prev.textLines.filter((_, j) => j !== i) }));
    const addLine = () => cfg.updateDesign(prev => ({ ...prev, textLines: [...prev.textLines, newLine(prev, t('soundAlerts.texts.newLine'))] }));
    const setStyle = (patch: Partial<typeof d.styles>) => cfg.updateDesign(prev => ({ ...prev, styles: { ...prev.styles, ...patch } }));
    const setOutline = (patch: Partial<typeof d.textOutline>) => cfg.updateDesign(prev => ({ ...prev, textOutline: { ...prev.textOutline, ...patch } }));

    return (
        <div className="space-y-6">
            <Card title={t('soundAlerts.texts.linesTitle')} description={t('soundAlerts.texts.linesDescription')}
                actions={
                    <button onClick={addLine} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shrink-0">
                        <Plus className="w-4 h-4" /> {t('soundAlerts.texts.add')}
                    </button>
                }
            >
                {lines.length === 0 && <p className="text-sm 3xl:text-base text-[#94a3b8]">{t('soundAlerts.texts.empty')}</p>}
                <div className="space-y-3">
                    {lines.map((line, i) => (
                        <div key={i} className={`p-4 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] ${line.enabled ? '' : 'opacity-60'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('soundAlerts.texts.line', { n: i + 1 })}</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setLine(i, { enabled: !line.enabled })} className="p-1.5 rounded-lg hover:bg-[#e2e8f0] dark:hover:bg-[#374151] text-[#64748b] dark:text-[#94a3b8]"
                                        title={line.enabled ? t('overlayEditor.hide') : t('overlayEditor.show')}>
                                        {line.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => removeLine(i)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600" title={t('soundAlerts.texts.remove')}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <LineFields line={line} onChange={patch => setLine(i, patch)} />
                        </div>
                    ))}
                </div>
            </Card>

            <Card title={t('soundAlerts.texts.styleTitle')} description={t('soundAlerts.texts.styleDescription')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('soundAlerts.texts.font')}>
                        <Select value={d.styles.fontFamily} onChange={v => setStyle({ fontFamily: v })} options={FONT_OPTIONS.map(f => ({ value: f, label: f }))} />
                    </Field>
                    <ColorField label={t('soundAlerts.texts.color')} value={d.styles.textColor} onChange={v => setStyle({ textColor: v })} />
                    <Field label={t('soundAlerts.texts.shadow')}>
                        <Select value={d.styles.textShadow as typeof SHADOW_OPTIONS[number]} onChange={v => setStyle({ textShadow: v })}
                            options={SHADOW_OPTIONS.map(o => ({ value: o, label: t(`soundAlerts.texts.shadows.${o}`) }))} />
                    </Field>
                </div>
                <div className="mt-6 space-y-4">
                    <Toggle checked={d.textOutline.enabled} onChange={v => setOutline({ enabled: v })} label={t('soundAlerts.texts.outline')} hint={t('soundAlerts.texts.outlineHint')} />
                    {d.textOutline.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ColorField label={t('soundAlerts.texts.outlineColor')} value={d.textOutline.color} onChange={v => setOutline({ color: v })} />
                            <Field label={t('soundAlerts.texts.outlineWidth')}>
                                <Slider value={d.textOutline.width} min={1} max={10} suffix=" px" onChange={v => setOutline({ width: v })} />
                            </Field>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

// ── Fondo ──────────────────────────────────────────────────────────────────────

export function BackgroundTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: TabId) => void }) {
    const { t } = useTranslation('overlays');
    const st = cfg.settings.design.styles;
    const setStyle = (patch: Partial<typeof st>) => cfg.updateDesign(prev => ({ ...prev, styles: { ...prev.styles, ...patch } }));
    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;

    return (
        <Card title={t('soundAlerts.background.title')} description={t('soundAlerts.background.description')}>
            <div className="space-y-5">
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                    {BACKGROUND_TYPE_OPTIONS.map(o => (
                        <button key={o} className={seg(st.backgroundType === o)} onClick={() => setStyle({ backgroundType: o })}>{t(`soundAlerts.background.types.${o}`)}</button>
                    ))}
                </div>
                {st.backgroundType === 'solid' && (
                    <ColorField label={t('soundAlerts.background.color')} value={st.solidColor} onChange={v => setStyle({ solidColor: v })} />
                )}
                {st.backgroundType === 'gradient' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ColorField label={t('soundAlerts.background.color1')} value={st.gradientColor1} onChange={v => setStyle({ gradientColor1: v })} />
                        <ColorField label={t('soundAlerts.background.color2')} value={st.gradientColor2} onChange={v => setStyle({ gradientColor2: v })} />
                        <Field label={t('soundAlerts.background.angle')}>
                            <Slider value={st.gradientAngle} min={0} max={360} suffix="°" onChange={v => setStyle({ gradientAngle: v })} />
                        </Field>
                    </div>
                )}
                {st.backgroundType !== 'transparent' && (
                    <>
                        <Field label={t('soundAlerts.background.opacity')}>
                            <Slider value={st.backgroundOpacity} min={0} max={100} suffix="%" onChange={v => setStyle({ backgroundOpacity: v })} />
                        </Field>
                        <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">
                            {t('soundAlerts.background.moveHint')}{' '}
                            <button className="underline text-[#2563eb]" onClick={() => onNavigate('editor')}>{t('soundAlerts.guide.goEditor')}</button>
                        </p>
                    </>
                )}
            </div>
        </Card>
    );
}

// ── Animación ──────────────────────────────────────────────────────────────────

export function AnimationTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const a = cfg.settings.design.animation;
    const set = (patch: Partial<typeof a>) => cfg.updateDesign(prev => ({ ...prev, animation: { ...prev.animation, ...patch } }));
    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;

    return (
        <Card title={t('soundAlerts.animation.title')} description={t('soundAlerts.animation.description')}>
            <div className="space-y-5">
                <Field label={t('soundAlerts.animation.type')}>
                    <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                        {ANIMATION_TYPE_OPTIONS.map(o => (
                            <button key={o} className={seg(a.type === o)} onClick={() => set({ type: o })}>{t(`soundAlerts.animation.types.${o}`)}</button>
                        ))}
                    </div>
                </Field>
                {a.type !== 'none' && (
                    <Field label={t('soundAlerts.animation.speed')}>
                        <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                            {ANIMATION_SPEED_OPTIONS.map(o => (
                                <button key={o} className={seg(a.speed === o)} onClick={() => set({ speed: o })}>{t(`soundAlerts.animation.speeds.${o}`)}</button>
                            ))}
                        </div>
                    </Field>
                )}
            </div>
        </Card>
    );
}
