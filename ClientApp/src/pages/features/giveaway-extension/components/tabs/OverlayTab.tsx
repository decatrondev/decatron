/**
 * OverlayTab - El overlay de OBS: enlaces, editor visual de bloques, estilo y simulación.
 * Todo lo que se ve en OBS sale de aquí (settings.overlay) y lo dibuja el mismo componente que la vista previa.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import api from '../../../../../services/api';
import OverlayCanvasEditor from '../../../../../components/overlay-editor/OverlayCanvasEditor';
import type { EditorElement, Rect } from '../../../../../components/overlay-editor/OverlayCanvasEditor';
import { Card, Field, NumberInput, Slider, Select, ColorField, Toggle } from '../../../../../components/overlay-editor/ui';
import { LinkRow, Warning, useOverlayStatus } from '../../../../../components/overlay-editor/OverlayLinks';
import { ShowHideCard } from '../../../../../components/music-overlay/DesignTabs';
import { THEME_PRESETS } from '../../../../../components/music-overlay/presets';
import GiveawayStage from '../../overlay/GiveawayStage';
import { FONT_FAMILIES, OVERLAY_CANVAS, demoSnapshot } from '../../overlay/model';
import type { OverlayBlockId, OverlayPhase, TextShadow } from '../../overlay/model';
import type { GiveawayConfig, GiveawaySettings, PlatformCapabilities } from '../../types';

interface OverlayTabProps {
    config: GiveawayConfig;
    onUpdateSettings: <K extends keyof GiveawaySettings>(group: K, updates: Partial<GiveawaySettings[K]>) => void;
}

const BLOCKS: { id: OverlayBlockId; label: string }[] = [
    { id: 'card', label: 'Tarjeta (premio, comando, contador, tiempo)' },
    { id: 'entries', label: 'Últimas entradas' },
    { id: 'reveal', label: 'Revelado y ganador' },
    { id: 'winners', label: 'Ganadores y su estado' },
];

const PHASES: { id: OverlayPhase; label: string }[] = [
    { id: 'open', label: 'Abierto' },
    { id: 'drawing', label: 'Ruleta' },
    { id: 'winner', label: 'Ganador' },
    { id: 'result', label: 'Resultado' },
];

const SIM_MESSAGES: Record<string, string> = {
    real_giveaway_active: 'Hay un giveaway real en curso: termínalo o cancélalo para simular.',
    already_running: 'Ya hay una simulación corriendo.',
    no_channel: 'No se encontró el canal.',
};

export const OverlayTab: React.FC<OverlayTabProps> = ({ config, onUpdateSettings }) => {
    const { t } = useTranslation('overlays');
    const a = config.settings.overlay;
    const { status, loaded } = useOverlayStatus('/giveaway/overlay/status');
    const [caps, setCaps] = useState<PlatformCapabilities | null>(null);
    const [phase, setPhase] = useState<OverlayPhase>('open');
    const [previewKey, setPreviewKey] = useState(0);
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
    const showKick = !!caps?.linked?.kick && config.settings.platforms.kick;

    // Vista previa: la misma foto que mandaría el servidor, con datos de ejemplo
    const snapshot = useMemo(() => demoSnapshot(phase, a, showKick),
        // previewKey reinicia la ruleta al volver a pulsar la fase
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [phase, a, showKick, previewKey]);

    const elements: EditorElement[] = BLOCKS.map((b) => ({
        id: b.id, label: b.label, enabled: a[b.id].enabled, x: a[b.id].x, y: a[b.id].y, width: a[b.id].width, height: a[b.id].height, toggleable: true,
    }));

    const patchBlock = (id: string, patch: Partial<Rect> & { enabled?: boolean }) => {
        const b = a[id as OverlayBlockId];
        onUpdateSettings('overlay', { [id]: { ...b, ...patch } } as Partial<GiveawaySettings['overlay']>);
    };

    const simulate = async () => {
        setSimulating(true);
        setSimMsg(null);
        try {
            await api.post('/giveaway/overlay/simulate');
            setSimMsg({ ok: true, text: 'Simulación en marcha: mira tu fuente de OBS (dura unos 40 segundos).' });
        } catch (err: unknown) {
            const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code ?? '';
            setSimMsg({ ok: false, text: SIM_MESSAGES[code] ?? 'No se pudo iniciar la simulación.' });
        } finally {
            setSimulating(false);
        }
    };

    const setTheme = (patch: Partial<GiveawaySettings['overlay']['theme']>) => onUpdateSettings('overlay', { theme: { ...a.theme, ...patch } });
    const set = <K extends keyof GiveawaySettings['overlay']>(field: K, value: GiveawaySettings['overlay'][K]) =>
        onUpdateSettings('overlay', { [field]: value } as Partial<GiveawaySettings['overlay']>);

    return (
        <div className="space-y-6">
            <Card title="Enlace para OBS" description="Agrégalo como fuente de navegador de 1920×1080. El servidor decide todo; OBS solo dibuja.">
                <LinkRow url={url} name={bothLinked ? 'Todo (Twitch + Kick)' : undefined} recommended={bothLinked}
                    connected={status.all > 0 || (!bothLinked && status.total > 0)} loaded={loaded} copyLabel="Copiar" copiedLabel="Copiado" />
                {bothLinked && (
                    <div className="mt-5 pt-4 border-t border-ds-border space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ds-soft">Avanzado: una plataforma por fuente</p>
                        <LinkRow url={`${url}&source=twitch`} name="Solo Twitch" connected={status.twitch > 0} loaded={loaded} copyLabel="Copiar" copiedLabel="Copiado" />
                        <LinkRow url={`${url}&source=kick`} name="Solo Kick" connected={status.kick > 0} loaded={loaded} copyLabel="Copiar" copiedLabel="Copiado" />
                    </div>
                )}
                {status.warnings.includes('mixed') && <Warning title="Fuentes que se pisan" text="Tienes «Todo» y una fuente parcial conectadas a la vez: la lista de entradas saldrá repetida." />}
                {status.warnings.includes('repeated') && !status.warnings.includes('mixed') && <Warning title="Fuente repetida" text="Hay más de una fuente igual conectada en OBS." />}
            </Card>

            <Card title="Probar sin sortear" description="Corre el ciclo completo en tu OBS con datos de ejemplo: entradas, ruleta, ganador y resultado. No escribe en el chat ni guarda nada.">
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={simulate} disabled={simulating} className="ds-btn ds-btn--primary inline-flex items-center gap-2">
                        <Play className="w-4 h-4" />{simulating ? 'Iniciando…' : 'Simular en el overlay'}
                    </button>
                    {simMsg && <span className={`text-sm ${simMsg.ok ? 'text-ds-soft' : 'text-red-500'}`}>{simMsg.text}</span>}
                </div>
            </Card>

            <OverlayCanvasEditor
                canvas={OVERLAY_CANVAS}
                elements={elements}
                onRectChange={(id, r) => patchBlock(id, r)}
                onToggle={(id, enabled) => patchBlock(id, { enabled })}
                title="Diseño del overlay"
                description="Arrastra y redimensiona cada bloque. Elige qué fase quieres ver en la vista previa."
                notice={(
                    <div className="flex flex-wrap gap-2 mb-3">
                        {PHASES.map((p) => (
                            <button key={p.id} onClick={() => { setPhase(p.id); setPreviewKey((k) => k + 1); }}
                                className={phase === p.id ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>{p.label}</button>
                        ))}
                    </div>
                )}
            >
                <GiveawayStage snapshot={snapshot} clockOffsetMs={0} source="all" audio={false} />
            </OverlayCanvasEditor>

            {/* Mismo tema, controles y textos que el editor de Song Request (motor components/music-overlay) */}
            <Card title={t('musicOverlay.theme.presetsTitle')} description={t('musicOverlay.theme.presetsDescription')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {THEME_PRESETS.map((p) => (
                        <button key={p.id}
                            onClick={() => onUpdateSettings('overlay', { theme: { ...a.theme, ...p.theme }, font: p.font, textColor: p.primary, secondaryColor: p.secondary, textShadow: p.shadow })}
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
                    <ColorField label={t('musicOverlay.theme.accent')} value={a.theme.accent} onChange={(v) => setTheme({ accent: v })} hint="Bordes de la ruleta, títulos y detalles." />
                    <div className="pt-5"><Toggle checked={a.theme.panelShadow} onChange={(v) => setTheme({ panelShadow: v })} label={t('musicOverlay.theme.shadow')} /></div>
                </div>
            </Card>

            <Card title="Texto" description="La misma fuente y sombra para todos los textos del overlay.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('musicOverlay.typography.font')}>
                        <Select value={a.font} onChange={(v) => set('font', v)} options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))} />
                    </Field>
                    <Field label={t('musicOverlay.typography.shadow')}>
                        <Select<TextShadow> value={a.textShadow} onChange={(v) => set('textShadow', v)}
                            options={(['none', 'soft', 'strong', 'glow'] as TextShadow[]).map((x) => ({ value: x, label: t(`musicOverlay.typography.shadows.${x}`) }))} />
                    </Field>
                    <ColorField label="Color del texto" value={a.textColor} onChange={(v) => set('textColor', v)} />
                    <ColorField label="Color del texto secundario" value={a.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
                </div>
            </Card>

            <ShowHideCard title={t('musicOverlay.animations.enterTitle')} description="Cómo aparece cada bloque del overlay." value={a.enter} onChange={(v) => set('enter', v)} />
            <ShowHideCard title={t('musicOverlay.animations.exitTitle')} description="Cómo se va el overlay cuando termina el giveaway." value={a.exit} onChange={(v) => set('exit', v)} />

            <Card title="Sonido y efectos" description="Se oyen en OBS; la vista previa no reproduce sonido.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Volumen de los sonidos">
                        <Slider value={a.volume} onChange={(v) => set('volume', v)} min={0} max={100} suffix="%" />
                    </Field>
                    <div />
                    <Toggle checked={a.confetti} onChange={(v) => set('confetti', v)} label="Confeti al revelar al ganador" />
                    <Toggle checked={a.tickSound} onChange={(v) => set('tickSound', v)} label="Sonido de la ruleta" hint="Un tic por cada nombre que pasa" />
                    <Toggle checked={a.fanfareSound} onChange={(v) => set('fanfareSound', v)} label="Fanfarria del ganador" />
                </div>
            </Card>

            <Card title="Tiempos" description="El servidor decide el ganador antes de la animación; estos tiempos solo controlan cuánto dura lo que se ve.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Duración del revelado (segundos)" hint="La ruleta de nombres antes de mostrar al ganador. Por defecto 8. Cuenta dentro del plazo del ganador para responder.">
                        <NumberInput value={a.revealSeconds} onChange={(v) => set('revealSeconds', v)} min={0} max={60} />
                    </Field>
                    <Field label="Tiempo del resultado en pantalla (segundos)" hint="Cuánto se queda el resultado final antes de ocultarse. Por defecto 15.">
                        <NumberInput value={a.resultSeconds} onChange={(v) => set('resultSeconds', v)} min={0} max={600} />
                    </Field>
                </div>
            </Card>
        </div>
    );
};
