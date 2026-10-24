/**
 * Pestañas del overlay de OBS, una por tema como en Song Request: Enlace, Editor, Tema, Texto, Animaciones y Sonido.
 * Todo se guarda en settings.overlay y lo dibuja GiveawayStage, el mismo componente de OBS. Los controles y los textos de
 * tema y animaciones son los del motor compartido de overlays de música (components/music-overlay).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Palette, Play, Type, Sparkles, Volume2, LayoutDashboard } from 'lucide-react';
import api from '../../../../../services/api';
import OverlayCanvasEditor from '../../../../../components/overlay-editor/OverlayCanvasEditor';
import type { EditorElement, Rect } from '../../../../../components/overlay-editor/OverlayCanvasEditor';
import { Card, Field, NumberInput, Slider, Select, ColorField, Toggle, ScaledCanvas, CHECKER_BG } from '../../../../../components/overlay-editor/ui';
import { LinkRow, Warning, useOverlayStatus } from '../../../../../components/overlay-editor/OverlayLinks';
import { ShowHideCard } from '../../../../../components/music-overlay/DesignTabs';
import { THEME_PRESETS } from '../../../../../components/music-overlay/presets';
import GiveawayStage from '../../overlay/GiveawayStage';
import { FONT_FAMILIES, OVERLAY_CANVAS, demoSnapshot } from '../../overlay/model';
import type { OverlayBlockId, OverlayPhase, TextShadow } from '../../overlay/model';
import type { GiveawayConfig, GiveawaySettings, PlatformCapabilities } from '../../types';
import { TabShell } from './SettingsExtras';

interface TabProps {
    config: GiveawayConfig;
    onUpdateSettings: <K extends keyof GiveawaySettings>(group: K, updates: Partial<GiveawaySettings[K]>) => void;
}

type Overlay = GiveawaySettings['overlay'];

const BLOCKS: OverlayBlockId[] = ['card', 'entries', 'reveal', 'winners'];

const PHASES: OverlayPhase[] = ['open', 'drawing', 'winner', 'result'];

/** Selector de fase para ver el overlay en cada momento del sorteo */
function PhasePicker({ phase, onPick }: { phase: OverlayPhase; onPick: (p: OverlayPhase) => void }) {
    const { t: tg } = useTranslation('features');
    return (
        <div className="flex flex-wrap gap-2">
            {PHASES.map((p) => (
                <button key={p} onClick={() => onPick(p)} className={phase === p ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>{tg(`giveaway.ov.phase_${p}`)}</button>
            ))}
        </div>
    );
}

/** Vista previa del overlay (la misma foto que mandaría el servidor, con datos de ejemplo) para las pestañas de estilo */
function Preview({ overlay, withKick }: { overlay: Overlay; withKick: boolean }) {
    const { t: tg } = useTranslation('features');
    const [phase, setPhase] = useState<OverlayPhase>('open');
    const [run, setRun] = useState(0);
    // run reinicia la ruleta y las cuentas regresivas al volver a pulsar una fase
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const snapshot = useMemo(() => demoSnapshot(phase, overlay, withKick), [phase, overlay, withKick, run]);
    return (
        <Card title={tg('giveaway.ov.preview')} description={tg('giveaway.ov.previewHint')}>
            <div className="space-y-3">
                <PhasePicker phase={phase} onPick={(p) => { setPhase(p); setRun((n) => n + 1); }} />
                <ScaledCanvas width={OVERLAY_CANVAS.width} height={OVERLAY_CANVAS.height} background={CHECKER_BG}>
                    <GiveawayStage snapshot={snapshot} clockOffsetMs={0} source="all" audio={false} />
                </ScaledCanvas>
            </div>
        </Card>
    );
}

function useOverlayPatch(onUpdateSettings: TabProps['onUpdateSettings']) {
    return (patch: Partial<Overlay>) => onUpdateSettings('overlay', patch);
}

// ── Enlace: la fuente de OBS y la simulación ────────────────────────────────────

export const OverlayLinkTab: React.FC<TabProps> = ({ config }) => {
    const { t: tg } = useTranslation('features');
    const { status, loaded } = useOverlayStatus('/giveaway/overlay/status');
    const [caps, setCaps] = useState<PlatformCapabilities | null>(null);
    const [simMsg, setSimMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [simulating, setSimulating] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get('/giveaway/platforms').then((r) => { if (!cancelled && r.data?.success) setCaps(r.data); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    const bothLinked = !!caps?.linked?.twitch && !!caps?.linked?.kick;
    const key = status.overlayKey ?? '';
    const url = `${window.location.origin}/overlay/giveaway?channel=${key || 'tu_canal'}`;

    const simulate = async () => {
        setSimulating(true);
        setSimMsg(null);
        try {
            await api.post('/giveaway/overlay/simulate');
            setSimMsg({ ok: true, text: tg('giveaway.ov.simStarted') });
        } catch (err: unknown) {
            const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code ?? '';
            setSimMsg({ ok: false, text: ['real_giveaway_active', 'already_running', 'no_channel'].includes(code) ? tg(`giveaway.ov.sim_${code}`) : tg('giveaway.ov.simFailed') });
        } finally {
            setSimulating(false);
        }
    };

    return (
        <TabShell icon={<Monitor className="w-6 h-6 text-ds-text" />} title={tg('giveaway.ov.linkTitle')} subtitle={tg('giveaway.ov.linkSub')}>
            <Card title={tg('giveaway.ov.linkCard')} description={tg('giveaway.ov.linkCardHint')}>
                <LinkRow url={url} name={bothLinked ? tg('giveaway.ov.allName') : undefined} recommended={bothLinked}
                    connected={status.all > 0 || (!bothLinked && status.total > 0)} loaded={loaded} copyLabel={tg('giveaway.ov.copy')} copiedLabel={tg('giveaway.ov.copied')} />
                {bothLinked && (
                    <div className="mt-5 pt-4 border-t border-ds-border space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ds-soft">{tg('giveaway.ov.advanced')}</p>
                        <LinkRow url={`${url}&source=twitch`} name={tg('giveaway.ov.onlyTwitch')} connected={status.twitch > 0} loaded={loaded} copyLabel={tg('giveaway.ov.copy')} copiedLabel={tg('giveaway.ov.copied')} />
                        <LinkRow url={`${url}&source=kick`} name={tg('giveaway.ov.onlyKick')} connected={status.kick > 0} loaded={loaded} copyLabel={tg('giveaway.ov.copy')} copiedLabel={tg('giveaway.ov.copied')} />
                    </div>
                )}
                {status.warnings.includes('mixed') && <Warning title={tg('giveaway.ov.warnMixedTitle')} text={tg('giveaway.ov.warnMixed')} />}
                {status.warnings.includes('repeated') && !status.warnings.includes('mixed') && <Warning title={tg('giveaway.ov.warnRepTitle')} text={tg('giveaway.ov.warnRep')} />}
            </Card>

            <Card title={tg('giveaway.ov.testTitle')} description={tg('giveaway.ov.testHint')}>
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={simulate} disabled={simulating} className="ds-btn ds-btn--primary inline-flex items-center gap-2">
                        <Play className="w-4 h-4" />{simulating ? tg('giveaway.ov.simulating') : tg('giveaway.ov.simulate')}
                    </button>
                    {simMsg && <span className={`text-sm ${simMsg.ok ? 'text-ds-soft' : 'text-red-500'}`}>{simMsg.text}</span>}
                </div>
            </Card>
            <Preview overlay={config.settings.overlay} withKick={config.settings.platforms.kick} />
        </TabShell>
    );
};

// ── Editor: arrastrar y redimensionar los bloques ───────────────────────────────

export const OverlayEditorTab: React.FC<TabProps> = ({ config, onUpdateSettings }) => {
    const { t: tg } = useTranslation('features');
    const a = config.settings.overlay;
    const [phase, setPhase] = useState<OverlayPhase>('open');
    const [run, setRun] = useState(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const snapshot = useMemo(() => demoSnapshot(phase, a, config.settings.platforms.kick), [phase, a, config.settings.platforms.kick, run]);

    const elements: EditorElement[] = BLOCKS.map((id) => ({
        id, label: tg(`giveaway.ov.block_${id}`), enabled: a[id].enabled, x: a[id].x, y: a[id].y, width: a[id].width, height: a[id].height, toggleable: true,
    }));
    const patchBlock = (id: string, patch: Partial<Rect> & { enabled?: boolean }) =>
        onUpdateSettings('overlay', { [id]: { ...a[id as OverlayBlockId], ...patch } } as Partial<Overlay>);

    return (
        <TabShell icon={<LayoutDashboard className="w-6 h-6 text-ds-text" />} title={tg('giveaway.ov.editorTitle')} subtitle={tg('giveaway.ov.editorSub')}>
            <PhasePicker phase={phase} onPick={(p) => { setPhase(p); setRun((n) => n + 1); }} />
            <OverlayCanvasEditor
                canvas={OVERLAY_CANVAS}
                elements={elements}
                onRectChange={(id, r) => patchBlock(id, r)}
                onToggle={(id, enabled) => patchBlock(id, { enabled })}
                title={tg('giveaway.ov.designTitle')}
                description={tg('giveaway.ov.designHint')}
            >
                <GiveawayStage snapshot={snapshot} clockOffsetMs={0} source="all" audio={false} />
            </OverlayCanvasEditor>
        </TabShell>
    );
};

// ── Tema: panel, bordes y colores (los de Song Request) ─────────────────────────

export const OverlayThemeTab: React.FC<TabProps> = ({ config, onUpdateSettings }) => {
    const { t } = useTranslation('overlays');
    const { t: tg } = useTranslation('features');
    const a = config.settings.overlay;
    const patch = useOverlayPatch(onUpdateSettings);
    const setTheme = (p: Partial<Overlay['theme']>) => patch({ theme: { ...a.theme, ...p } });

    return (
        <TabShell icon={<Palette className="w-6 h-6 text-ds-text" />} title={tg('giveaway.ov.themeTitle')} subtitle={tg('giveaway.ov.themeSub')}>
            <Preview overlay={a} withKick={config.settings.platforms.kick} />
            <Card title={t('musicOverlay.theme.presetsTitle')} description={t('musicOverlay.theme.presetsDescription')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {THEME_PRESETS.map((p) => (
                        <button key={p.id}
                            onClick={() => patch({ theme: { ...a.theme, ...p.theme }, font: p.font, textColor: p.primary, secondaryColor: p.secondary, textShadow: p.shadow })}
                            className="text-left p-3 rounded-lg border border-ds-border hover:border-ds-accent transition-all">
                            <div className="flex h-8 rounded-lg overflow-hidden mb-2 border border-ds-border/10">
                                {p.swatch.map((c, i) => <span key={i} className="flex-1" style={{ background: c === '#00000000' ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 10px 10px' : c }} />)}
                            </div>
                            <p className="text-sm 3xl:text-base font-bold text-ds-text" style={{ fontFamily: `'${p.font}', system-ui` }}>{t(`musicOverlay.theme.presets.${p.id}`)}</p>
                        </button>
                    ))}
                </div>
            </Card>
            <Card title={t('musicOverlay.theme.panelTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorField label={t('musicOverlay.theme.panelBackground')} value={a.theme.panelBackground} onChange={(v) => setTheme({ panelBackground: v })} />
                    <ColorField label={t('musicOverlay.theme.panelBorder')} value={a.theme.panelBorderColor} onChange={(v) => setTheme({ panelBorderColor: v })} />
                    <Field label={t('musicOverlay.theme.borderWidth')}><Slider value={a.theme.panelBorderWidth} min={0} max={8} onChange={(v) => setTheme({ panelBorderWidth: v })} suffix="px" /></Field>
                    <Field label={t('musicOverlay.theme.radius')}><Slider value={a.theme.panelRadius} min={0} max={80} onChange={(v) => setTheme({ panelRadius: v })} suffix="px" /></Field>
                    <Field label={t('musicOverlay.theme.blur')} hint={t('musicOverlay.theme.blurHint')}><Slider value={a.theme.panelBlur} min={0} max={30} onChange={(v) => setTheme({ panelBlur: v })} suffix="px" /></Field>
                    <ColorField label={t('musicOverlay.theme.accent')} value={a.theme.accent} onChange={(v) => setTheme({ accent: v })} hint={tg('giveaway.ov.accentHint')} />
                    <div className="pt-5"><Toggle checked={a.theme.panelShadow} onChange={(v) => setTheme({ panelShadow: v })} label={t('musicOverlay.theme.shadow')} /></div>
                </div>
            </Card>
        </TabShell>
    );
};

// ── Texto: fuente, colores y sombra ─────────────────────────────────────────────

export const OverlayTextTab: React.FC<TabProps> = ({ config, onUpdateSettings }) => {
    const { t } = useTranslation('overlays');
    const { t: tg } = useTranslation('features');
    const a = config.settings.overlay;
    const patch = useOverlayPatch(onUpdateSettings);

    return (
        <TabShell icon={<Type className="w-6 h-6 text-ds-text" />} title={tg('giveaway.ov.textTitle')} subtitle={tg('giveaway.ov.textSub')}>
            <Preview overlay={a} withKick={config.settings.platforms.kick} />
            <Card title={tg('giveaway.ov.typo')} description={tg('giveaway.ov.typoHint')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('musicOverlay.typography.font')}>
                        <Select value={a.font} onChange={(v) => patch({ font: v })} options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))} />
                    </Field>
                    <Field label={t('musicOverlay.typography.shadow')}>
                        <Select<TextShadow> value={a.textShadow} onChange={(v) => patch({ textShadow: v })}
                            options={(['none', 'soft', 'strong', 'glow'] as TextShadow[]).map((x) => ({ value: x, label: t(`musicOverlay.typography.shadows.${x}`) }))} />
                    </Field>
                    <ColorField label={tg('giveaway.ov.textColor')} value={a.textColor} onChange={(v) => patch({ textColor: v })} />
                    <ColorField label={tg('giveaway.ov.text2Color')} value={a.secondaryColor} onChange={(v) => patch({ secondaryColor: v })} hint={tg('giveaway.ov.text2Hint')} />
                </div>
            </Card>
        </TabShell>
    );
};

// ── Animaciones: entrada, salida y duración del revelado ────────────────────────

export const OverlayAnimationsTab: React.FC<TabProps> = ({ config, onUpdateSettings }) => {
    const { t } = useTranslation('overlays');
    const { t: tg } = useTranslation('features');
    const a = config.settings.overlay;
    const patch = useOverlayPatch(onUpdateSettings);

    return (
        <TabShell icon={<Sparkles className="w-6 h-6 text-ds-text" />} title={tg('giveaway.ov.animTitle')} subtitle={tg('giveaway.ov.animSub')}>
            <Preview overlay={a} withKick={config.settings.platforms.kick} />
            <ShowHideCard title={t('musicOverlay.animations.enterTitle')} description={tg('giveaway.ov.enterHint')} value={a.enter} onChange={(v) => patch({ enter: v })} />
            <ShowHideCard title={t('musicOverlay.animations.exitTitle')} description={tg('giveaway.ov.exitHint')} value={a.exit} onChange={(v) => patch({ exit: v })} />
            <Card title={tg('giveaway.ov.times')} description={tg('giveaway.ov.timesHint')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={tg('giveaway.ov.revealSec')} hint={tg('giveaway.ov.revealSecHint')}>
                        <NumberInput value={a.revealSeconds} onChange={(v) => patch({ revealSeconds: v })} min={0} max={60} />
                    </Field>
                    <Field label={tg('giveaway.ov.resultSec')} hint={tg('giveaway.ov.resultSecHint')}>
                        <NumberInput value={a.resultSeconds} onChange={(v) => patch({ resultSeconds: v })} min={0} max={600} />
                    </Field>
                </div>
            </Card>
        </TabShell>
    );
};

// ── Sonido y efectos ────────────────────────────────────────────────────────────

export const OverlaySoundTab: React.FC<TabProps> = ({ config, onUpdateSettings }) => {
    const { t: tg } = useTranslation('features');
    const a = config.settings.overlay;
    const patch = useOverlayPatch(onUpdateSettings);

    return (
        <TabShell icon={<Volume2 className="w-6 h-6 text-ds-text" />} title={tg('giveaway.ov.soundTitle')} subtitle={tg('giveaway.ov.soundSub')}>
            <Card title={tg('giveaway.ov.sounds')} description={tg('giveaway.ov.soundsHint')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={tg('giveaway.ov.volume')}><Slider value={a.volume} onChange={(v) => patch({ volume: v })} min={0} max={100} suffix="%" /></Field>
                    <div />
                    <Toggle checked={a.tickSound} onChange={(v) => patch({ tickSound: v })} label={tg('giveaway.ov.tick')} hint={tg('giveaway.ov.tickHint')} />
                    <Toggle checked={a.fanfareSound} onChange={(v) => patch({ fanfareSound: v })} label={tg('giveaway.ov.fanfare')} />
                </div>
            </Card>
            <Card title={tg('giveaway.ov.effects')}>
                <Toggle checked={a.confetti} onChange={(v) => patch({ confetti: v })} label={tg('giveaway.ov.confetti')} />
            </Card>
        </TabShell>
    );
};
