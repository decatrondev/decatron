import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import { Card, CopyButton, inputClass } from '../../components/overlay-editor/ui';
import { useGoogleFonts } from '../../components/music-overlay/utils';
import { EVENT_TYPES } from '../../components/event-alert-overlay/defaults';
import { listCases, payloadFor } from '../../components/event-alert-overlay/fromConfig';
import type { AlertEventType, EventAlertData, EventAlertsDesign } from '../../components/event-alert-overlay/types';
import { useEventAlertsConfig } from './event-alerts-extension/hooks/useEventAlertsConfig';
import { useEventAlertsPersistence } from './event-alerts-extension/hooks/useEventAlertsPersistence';
import { GlobalTab, FollowTab, BitsTab, SubsTab, GiftSubsTab, RaidsTab, ResubsTab, HypeTrainTab, MediaTab, TestingTab, StyleTab } from './event-alerts-extension/components/tabs';
import { applyStyleChanges } from '../../components/event-alert-overlay/convertLegacy';
import type { GlobalAlertsConfig } from './event-alerts-extension/types/index';
import { GlobalDefaultsContext } from './event-alerts-extension/globalDefaults';
import DesignTab, { firstFamily, targetEvent, type DesignTarget } from './event-alerts-extension/components/design/DesignTab';
import EventAlertsPreview from './event-alerts-extension/components/EventAlertsPreview';

// Event Alerts (.dev/plans/EVENT_ALERTS_REDESIGN_PLAN.md, fase 2): mismo patrón que /overlays/shoutout —
// pestañas a la izquierda (2/3), vista previa en vivo a la derecha (1/3), un solo renderer para OBS, vista previa
// y editor. Las pestañas de cada evento (niveles, variantes, TTS, chat) son las de siempre.

type TabId = 'guide' | 'general' | 'events' | 'design' | 'advanced' | 'media' | 'testing';

const TABS: { id: TabId; icon: string }[] = [
    { id: 'guide', icon: '📚' },
    { id: 'general', icon: '⚙️' },
    { id: 'events', icon: '🎉' },
    { id: 'design', icon: '🎨' },
    { id: 'advanced', icon: '⚡' },
    { id: 'media', icon: '📁' },
    { id: 'testing', icon: '🧪' },
];

const EVENT_ICONS: Record<AlertEventType, string> = { follow: '❤️', bits: '💎', subs: '⭐', giftSubs: '🎁', raids: '🚀', resubs: '🎉', hypeTrain: '🔥' };

/** JSON con las claves ordenadas: el mismo contenido da el mismo texto aunque una pestaña reordene claves. */
function stableStringify(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
    if (v && typeof v === 'object') {
        return `{${Object.keys(v as object).filter(k => (v as any)[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stableStringify((v as any)[k])}`).join(',')}}`;
    }
    return JSON.stringify(v) ?? 'null';
}

/** El lienzo es uno solo (la fuente de OBS): se copia a todos los diseños al guardar. */
function withCanvas(design: EventAlertsDesign, canvas: { width: number; height: number }): EventAlertsDesign {
    const c = { ...canvas };
    const events: EventAlertsDesign['events'] = {};
    for (const [k, d] of Object.entries(design.events)) {
        if (!d) continue;
        const withLevels = 'levels' in d && d.levels
            ? { ...d, canvas: c, levels: Object.fromEntries(Object.entries(d.levels).map(([lk, ld]) => [lk, ld ? { ...ld, canvas: c } : ld])) }
            : { ...d, canvas: c };
        (events as any)[k] = withLevels;
    }
    return { ...design, general: { ...design.general, canvas: c }, events };
}

export default function EventAlertsConfig() {
    const { t } = useTranslation('overlays');
    const navigate = useNavigate();
    const cfg = useEventAlertsConfig();
    const { loading, saving, saveMessage, loadConfiguration, saveConfiguration } = useEventAlertsPersistence({ onConfigLoaded: cfg.loadConfig });
    const [tab, setTab] = useState<TabId>(() => { try { return (sessionStorage.getItem('ea-tab') as TabId) || 'guide'; } catch { return 'guide'; } });
    const [eventTab, setEventTab] = useState<AlertEventType>('follow');
    const [designTarget, setDesignTarget] = useState<DesignTarget>('general');
    const [previewEvent, setPreviewEvent] = useState<AlertEventType>('follow');
    const [overlayUrl, setOverlayUrl] = useState('');
    const [baseline, setBaseline] = useState<string | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => { try { sessionStorage.setItem('ea-tab', tab); } catch { /* sin storage */ } }, [tab]);

    useEffect(() => {
        loadConfiguration();
        api.get('/settings/frontend-info').then(res => {
            const login = res.data?.channel?.login || '';
            setOverlayUrl(`${res.data?.frontendUrl || window.location.origin}/overlay/event-alerts?channel=${login || 'tu-canal'}`);
        }).catch(() => setOverlayUrl(`${window.location.origin}/overlay/event-alerts?channel=tu-canal`));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const canvas = cfg.globalConfig.canvas;
    const complete = cfg.getCompleteConfig();
    const fresh = { ...complete, design: withCanvas(complete.design!, canvas) };
    const snapshot = stableStringify(fresh);
    // El mismo objeto mientras no cambie nada (la vista previa y los ejemplos no se recalculan en cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const toSave = useMemo(() => fresh, [snapshot]);
    // Lo cargado es la referencia de "sin cambios"
    useEffect(() => { if (!loading && baseline === null) setBaseline(snapshot); }, [loading, baseline, snapshot]);
    const dirty = baseline !== null && snapshot !== baseline;

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    useEffect(() => {
        if (!message) return;
        const id = window.setTimeout(() => setMessage(null), 4000);
        return () => window.clearTimeout(id);
    }, [message]);

    // Las fuentes del diseño (de Google Fonts, como en OBS)
    const families = useMemo(() => {
        const d = cfg.design;
        const all = [d.general, ...Object.values(d.events), ...Object.values(d.events.hypeTrain?.levels ?? {})];
        return all.flatMap(x => (x ? x.texts.map(tx => firstFamily(tx.fontFamily)) : []));
    }, [cfg.design]);
    useGoogleFonts(families, 'ea-fonts');

    // Datos de ejemplo del editor: la alerta base de cada evento, con su media real
    const samples = useMemo(() => {
        const out = {} as Record<AlertEventType, EventAlertData>;
        for (const ev of EVENT_TYPES) {
            const c = listCases(toSave, ev)[0];
            out[ev] = c ? payloadFor(toSave, c).data : { eventType: ev, username: 'StreamFan99' };
        }
        return out;
    }, [toSave]);

    const save = async () => {
        const ok = await saveConfiguration(toSave);
        if (ok) setBaseline(snapshot);
        setMessage({ ok, text: ok ? t('eventAlertsView.saved') : t('eventAlertsView.saveFailed') });
    };

    const back = () => {
        if (dirty && !window.confirm(t('eventAlertsView.leaveConfirm'))) return;
        navigate('/overlays');
    };

    const test = async (eventType: string, data?: any) => {
        try { await api.post('/eventalerts/test', { eventType, ...data }); } catch { setMessage({ ok: false, text: t('eventAlertsView.preview.testFailed') }); }
    };

    // Avanzado edita el estilo global viejo: también se aplica al diseño general si ya fue editado
    const onAdvancedChange = (updates: Partial<GlobalAlertsConfig>) => {
        if (updates.defaultStyle) {
            const prev = cfg.globalConfig.defaultStyle, next = updates.defaultStyle;
            cfg.setDesign(d => ({ ...d, general: applyStyleChanges(d.general, prev, next) }));
        }
        cfg.updateGlobalConfig(updates);
    };

    // La vista previa sigue al evento que se edita
    const onDesignTarget = (target: DesignTarget) => { setDesignTarget(target); setPreviewEvent(targetEvent(target)); };
    const onEventTab = (ev: AlertEventType) => { setEventTab(ev); setPreviewEvent(ev); };
    const hypeKey = designTarget.startsWith('hype-') ? designTarget.slice(5) : '';
    const hypeLevel = hypeKey === 'completed' ? 'completed' as const : hypeKey ? Number(hypeKey) : undefined;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    const step = (n: number, title: string, body: React.ReactNode) => (
        <div className="flex gap-4">
            <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-[#2563eb] text-white font-black flex items-center justify-center text-sm 3xl:text-base">{n}</span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] space-y-2">{body}</div>
            </div>
        </div>
    );
    const link = (to: TabId, label: string) => <button className="underline text-[#2563eb]" onClick={() => setTab(to)}>{label}</button>;

    return (
        <GlobalDefaultsContext.Provider value={{
            duration: cfg.globalConfig.defaultDuration || 5,
            animation: cfg.globalConfig.defaultAnimation || 'fade',
            direction: cfg.globalConfig.defaultAnimationDirection || 'center',
            volume: cfg.globalConfig.defaultVolume ?? 80,
        }}>
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6 lg:p-8">
            {/* panel-scale agranda todo en 2K/4K; el editor calcula el arrastre con el tamaño real en pantalla */}
            <div className="panel-scale max-w-[1920px] mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={back} className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg">
                            <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                        <div>
                            <h1 className="text-3xl 3xl:text-4xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('eventAlertsView.title')}</h1>
                            <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] mt-1">{t('eventAlertsView.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {dirty && <span className="text-xs 3xl:text-sm font-bold text-amber-600 dark:text-amber-400">{t('eventAlertsView.unsaved')}</span>}
                        <button
                            onClick={save}
                            disabled={saving || !dirty}
                            className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg ${saving || !dirty
                                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                                : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white'}`}
                        >
                            <Save className="w-5 h-5" />
                            {saving ? t('eventAlertsView.saving') : t('eventAlertsView.save')}
                        </button>
                    </div>
                </div>

                {(message || (saveMessage?.type === 'error' && baseline === null)) && (
                    <div className={`mb-6 p-4 rounded-xl border ${message?.ok
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
                        {message?.text ?? t('eventAlertsView.loadFailed')}
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6 min-w-0">
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                            <div className="flex flex-wrap gap-2">
                                {TABS.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setTab(item.id)}
                                        className={`px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold whitespace-nowrap transition-all ${tab === item.id
                                            ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'}`}
                                    >
                                        {item.icon} {t(`eventAlertsView.tabs.${item.id}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {tab === 'guide' && (
                            <Card title={t('eventAlertsView.guide.title')} description={t('eventAlertsView.guide.description')}>
                                <div className="space-y-6">
                                    {step(1, t('eventAlertsView.guide.step1Title'), (
                                        <>
                                            <p>{t('eventAlertsView.guide.step1Body')}</p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input readOnly value={overlayUrl} className={`${inputClass} font-mono text-xs 3xl:text-sm`} onFocus={e => e.currentTarget.select()} />
                                                <div className="flex gap-2">
                                                    <CopyButton text={overlayUrl} label={t('eventAlertsView.guide.copy')} doneLabel={t('eventAlertsView.guide.copied')} />
                                                    <a href={overlayUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold flex items-center gap-2 bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] shrink-0"><ExternalLink className="w-4 h-4" /> {t('eventAlertsView.guide.open')}</a>
                                                </div>
                                            </div>
                                            <ol className="list-decimal pl-5 space-y-1">
                                                <li>{t('eventAlertsView.guide.obs1')}</li>
                                                <li>{t('eventAlertsView.guide.obs2', { width: canvas.width, height: canvas.height })}</li>
                                                <li>{t('eventAlertsView.guide.obs3')}</li>
                                            </ol>
                                        </>
                                    ))}
                                    {step(2, t('eventAlertsView.guide.step2Title'), <p>{t('eventAlertsView.guide.step2Body')} {link('events', t('eventAlertsView.guide.goEvents'))}</p>)}
                                    {step(3, t('eventAlertsView.guide.step3Title'), <p>{t('eventAlertsView.guide.step3Body')} {link('design', t('eventAlertsView.guide.goDesign'))}</p>)}
                                    {step(4, t('eventAlertsView.guide.step4Title'), <p>{t('eventAlertsView.guide.step4Body')}</p>)}
                                </div>
                            </Card>
                        )}

                        {tab === 'general' && <GlobalTab config={cfg.globalConfig} onConfigChange={cfg.updateGlobalConfig} overlayUrl={overlayUrl} />}

                        {tab === 'events' && (
                            <div className="space-y-6">
                                <div className="flex flex-wrap gap-2">
                                    {EVENT_TYPES.map(ev => (
                                        <button key={ev} onClick={() => onEventTab(ev)}
                                            className={`px-3 py-2 rounded-xl text-sm 3xl:text-base font-bold border transition-colors ${eventTab === ev ? 'border-[#2563eb] bg-[#eff6ff] dark:bg-[#1e3a8a]/30 text-[#2563eb] dark:text-[#93c5fd]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-[#2563eb]'}`}>
                                            {EVENT_ICONS[ev]} {t(`eventAlertsView.events.${ev}`)}
                                        </button>
                                    ))}
                                </div>
                                {eventTab === 'follow' && <FollowTab config={cfg.followConfig} onConfigChange={cfg.updateFollowConfig} />}
                                {eventTab === 'bits' && <BitsTab config={cfg.bitsConfig} onConfigChange={cfg.updateBitsConfig} />}
                                {eventTab === 'subs' && <SubsTab config={cfg.subsConfig} onConfigChange={cfg.updateSubsConfig} />}
                                {eventTab === 'giftSubs' && <GiftSubsTab config={cfg.giftSubsConfig} onConfigChange={cfg.updateGiftSubsConfig} />}
                                {eventTab === 'raids' && <RaidsTab config={cfg.raidsConfig} onConfigChange={cfg.updateRaidsConfig} />}
                                {eventTab === 'resubs' && <ResubsTab config={cfg.resubsConfig} onConfigChange={cfg.updateResubsConfig} />}
                                {eventTab === 'hypeTrain' && <HypeTrainTab config={cfg.hypeTrainConfig} onConfigChange={cfg.updateHypeTrainConfig} />}
                            </div>
                        )}

                        {tab === 'design' && (
                            <DesignTab
                                design={cfg.design}
                                onChange={cfg.setDesign}
                                canvas={canvas}
                                onCanvasChange={size => cfg.updateGlobalConfig({ canvas: size })}
                                samples={samples}
                                target={designTarget}
                                onTargetChange={onDesignTarget}
                                anchor={cfg.globalConfig.defaultPosition}
                            />
                        )}

                        {tab === 'advanced' && <StyleTab globalConfig={cfg.globalConfig} onGlobalConfigChange={onAdvancedChange} />}
                        {tab === 'media' && <MediaTab />}
                        {tab === 'testing' && <TestingTab onTest={test} />}
                    </div>

                    <div className="xl:col-span-1 min-w-0">
                        <EventAlertsPreview
                            config={toSave}
                            design={toSave.design!}
                            canvas={canvas}
                            dirty={dirty}
                            eventType={previewEvent}
                            onEventTypeChange={setPreviewEvent}
                            hypeLevel={tab === 'design' ? hypeLevel : undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
        </GlobalDefaultsContext.Provider>
    );
}
