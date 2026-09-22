/**
 * Mascotas — panel de configuración (/overlays/pets).
 * Pestañas: Mascota, Comportamiento, Overlay (URL para OBS) y Testing. La preview es la misma escena del overlay.
 * Ver .dev/plans/PETS_PLAN.md §4.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Cat, Footprints, Monitor, FlaskConical, Save, Loader2, Copy, ExternalLink, RotateCcw, Pause, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Card, SectionTitle, SubLabel, Label, TextInput, Toggle, SelectInput, ColorInput, Slider, NumberInput, Checkbox } from './now-playing-extension/components/ui/SharedUI';
import PetScene from './pets/PetScene';
import { PetEventBus } from './pets/PetEventBus';
import { PET_LIMITS, defaultPetsConfig, resolvePetsConfig, type PetManifest, type PetsConfig, type PetsPanelData, type PetTextStyle } from './pets/types';

type TabId = 'pet' | 'behavior' | 'overlay' | 'testing';
const FONT_FAMILIES = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Bebas Neue', 'Rajdhani', 'Exo 2', 'Press Start 2P', 'system-ui'];

const errorMessage = (e: any) => e?.response?.data?.message || e?.message || 'Error';

const PetsConfigPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('overlays', { keyPrefix: 'pets' });
    const [data, setData] = useState<PetsPanelData | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<TabId>('pet');
    const [cfg, setCfg] = useState<PetsConfig | null>(null);
    const [isEnabled, setIsEnabled] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [frontendUrl, setFrontendUrl] = useState(window.location.origin);
    const [modelUrls, setModelUrls] = useState<Record<string, string>>({});
    const [previewPaused, setPreviewPaused] = useState(false);
    const [previewWidth, setPreviewWidth] = useState(900);
    const previewBox = useRef<HTMLDivElement>(null);
    const bus = useMemo(() => new PetEventBus(), []);
    // Testing
    const [testState, setTestState] = useState('react');
    const [testBubble, setTestBubble] = useState('¡Hola chat! 👋');
    const [testDuration, setTestDuration] = useState(4);

    const load = useCallback(async () => {
        const r = await api.get<PetsPanelData>('/pets/config');
        setData(r.data);
        setIsEnabled(r.data.isEnabled);
        setCfg(resolvePetsConfig(r.data.config, r.data.catalog[0]?.id));
        setDirty(false);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const info = await api.get('/settings/frontend-info').catch(() => null);
                if (info?.data?.frontendUrl) setFrontendUrl(info.data.frontendUrl);
                await load();
            } catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
            finally { setLoading(false); }
        })();
    }, [load]);

    // URL firmada del modelo elegido (JWT), una vez por modelo
    const manifest: PetManifest | null = useMemo(() => data && cfg ? (data.catalog.find(m => m.id === cfg.pets[0].model) ?? data.catalog[0] ?? null) : null, [data, cfg]);
    useEffect(() => {
        if (!manifest || modelUrls[manifest.id]) return;
        api.get<{ url: string }>(`/pets/models/${manifest.id}/sign`).then(r => setModelUrls(prev => ({ ...prev, [manifest.id]: r.data.url }))).catch(() => {});
    }, [manifest, modelUrls]);

    useEffect(() => {
        const el = previewBox.current; if (!el) return;
        const ro = new ResizeObserver(() => setPreviewWidth(el.clientWidth));
        ro.observe(el); setPreviewWidth(el.clientWidth);
        return () => ro.disconnect();
    }, [loading]);

    const update = (patch: Partial<PetsConfig>) => { setCfg(prev => prev ? { ...prev, ...patch } : prev); setDirty(true); };
    const updatePet = (patch: Partial<PetsConfig['pets'][0]>) => cfg && update({ pets: [{ ...cfg.pets[0], ...patch }, ...cfg.pets.slice(1)] });
    const updateOverlay = (patch: Partial<PetsConfig['overlay']>) => cfg && update({ overlay: { ...cfg.overlay, ...patch } });
    const updateBehavior = (patch: Partial<PetsConfig['behavior']>) => cfg && update({ behavior: { ...cfg.behavior, ...patch } });
    const updateStyle = (key: 'nameStyle' | 'bubbleStyle', patch: Partial<PetTextStyle>) => cfg && update({ [key]: { ...cfg[key], ...patch } } as Partial<PetsConfig>);

    const save = async () => {
        if (!cfg) return;
        setSaving(true); setSaveMsg(null);
        try {
            const res = await api.post('/pets/config', { isEnabled, config: cfg });
            if (!res.data?.success) { setSaveMsg({ type: 'err', text: res.data?.message || t('saveError') }); return; }
            setSaveMsg({ type: 'ok', text: t('saved') });
            setDirty(false);
        } catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
        finally { setSaving(false); setTimeout(() => setSaveMsg(null), 6000); }
    };

    const sendTest = async (toOverlay: boolean) => {
        const ev = { state: testState, durationSec: testDuration, bubble: testBubble || null };
        bus.emit(ev);
        if (!toOverlay) return;
        try { await api.post('/pets/test', ev); setSaveMsg({ type: 'ok', text: t('testing.sent') }); }
        catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
        setTimeout(() => setSaveMsg(null), 4000);
    };

    const overlayUrl = useMemo(() => data ? `${frontendUrl}${data.overlayUrlTemplate}` : '', [data, frontendUrl]);
    const scale = cfg ? Math.min(1, previewWidth / cfg.overlay.width) : 1;

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>;
    if (!data || !cfg) return <Card><SectionTitle>{t('title')}</SectionTitle><SubLabel>{saveMsg?.text ?? t('loadError')}</SubLabel></Card>;

    const modelUrl = manifest ? modelUrls[manifest.id] : undefined;
    const states = manifest ? Object.keys(manifest.states) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/overlays')} className="p-2 rounded-lg hover:bg-[#262626] text-[#94a3b8]"><ArrowLeft className="w-5 h-5" /></button>
                    <Cat className="w-6 h-6 text-[#2563eb]" />
                    <div>
                        <h1 className="text-2xl font-black text-[#f8fafc]">{t('title')}</h1>
                        <p className="text-sm text-[#94a3b8]">{t('subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saveMsg && <span className={`text-sm ${saveMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{saveMsg.text}</span>}
                    <button onClick={save} disabled={!dirty || saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{t('save')}
                    </button>
                </div>
            </div>

            {/* Preview: misma escena del overlay, escalada al ancho disponible */}
            <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><SectionTitle>{t('preview.title')}</SectionTitle><SubLabel>{t('preview.hint', { size: `${cfg.overlay.width}×${cfg.overlay.height}` })}</SubLabel></div>
                    <button onClick={() => setPreviewPaused(p => !p)} className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-sm border border-[#374151] flex items-center gap-2">
                        {previewPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}{previewPaused ? t('preview.resume') : t('preview.pause')}
                    </button>
                </div>
                <div ref={previewBox} className="mt-3 w-full overflow-hidden rounded-lg border border-[#374151]"
                    style={{ height: cfg.overlay.height * scale, backgroundImage: 'linear-gradient(45deg,#1f2937 25%,transparent 25%),linear-gradient(-45deg,#1f2937 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1f2937 75%),linear-gradient(-45deg,transparent 75%,#1f2937 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0', backgroundColor: '#111827' }}>
                    <div style={{ width: cfg.overlay.width, height: cfg.overlay.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                        {manifest && modelUrl && <PetScene config={cfg} manifest={manifest} modelUrl={modelUrl} bus={bus} paused={previewPaused} />}
                    </div>
                </div>
            </Card>

            <div className="flex flex-col lg:flex-row gap-5">
                <div className="lg:w-48 flex lg:flex-col gap-1">
                    {([['pet', Cat], ['behavior', Footprints], ['overlay', Monitor], ['testing', FlaskConical]] as [TabId, React.FC<{ className?: string }>][]).map(([id, Icon]) => (
                        <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${tab === id ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:bg-[#262626]'}`}><Icon className="w-4 h-4" />{t(`tabs.${id}`)}</button>
                    ))}
                </div>
                <div className="flex-1 min-w-0 space-y-5">
                    {tab === 'pet' && (
                        <>
                            <Card>
                                <SectionTitle>{t('pet.model')}</SectionTitle>
                                <SubLabel>{t('pet.modelHint')}</SubLabel>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {data.catalog.map(m => (
                                        <button key={m.id} onClick={() => updatePet({ model: m.id })} className={`text-left rounded-lg border px-4 py-3 ${cfg.pets[0].model === m.id ? 'border-blue-500 bg-blue-500/10' : 'border-[#374151] bg-[#111214] hover:bg-[#1a1b1e]'}`}>
                                            <div className="text-sm font-semibold text-[#f8fafc]">{m.name}</div>
                                            <div className="text-[11px] text-[#94a3b8]">{m.triangles.toLocaleString()} tris · {Object.values(m.states).filter(s => s.clip).length} {t('pet.clips')}</div>
                                            <div className="text-[11px] text-[#6b7280] mt-1">
                                                {t('pet.by')} <a className="underline" href={m.credit.authorUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{m.credit.author}</a> · <a className="underline" href={m.credit.licenseUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{m.credit.license}</a>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </Card>
                            <Card>
                                <SectionTitle>{t('pet.identity')}</SectionTitle>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><Label>{t('pet.name')}</Label><TextInput value={cfg.pets[0].name} onChange={v => updatePet({ name: v.slice(0, 24) })} placeholder="Michi" /></div>
                                    <div className="flex items-end"><Toggle checked={cfg.pets[0].showName} onChange={v => updatePet({ showName: v })} label={t('pet.showName')} size="sm" /></div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><Label>{t('style.font')}</Label><SelectInput value={cfg.nameStyle.font} onChange={v => updateStyle('nameStyle', { font: v })} options={FONT_FAMILIES.map(f => ({ value: f, label: f }))} /></div>
                                    <div><Label>{t('style.size')}</Label><Slider value={cfg.nameStyle.size} onChange={v => updateStyle('nameStyle', { size: v })} min={10} max={48} unit="px" /></div>
                                    <div><Label>{t('style.color')}</Label><ColorInput value={cfg.nameStyle.color} onChange={v => updateStyle('nameStyle', { color: v })} /></div>
                                    <div className="flex items-end"><Checkbox checked={cfg.nameStyle.outline} onChange={v => updateStyle('nameStyle', { outline: v })} label={t('style.outline')} /></div>
                                </div>
                            </Card>
                            <Card>
                                <SectionTitle>{t('style.bubbleTitle')}</SectionTitle>
                                <SubLabel>{t('style.bubbleHint')}</SubLabel>
                                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><Label>{t('style.font')}</Label><SelectInput value={cfg.bubbleStyle.font} onChange={v => updateStyle('bubbleStyle', { font: v })} options={FONT_FAMILIES.map(f => ({ value: f, label: f }))} /></div>
                                    <div><Label>{t('style.size')}</Label><Slider value={cfg.bubbleStyle.size} onChange={v => updateStyle('bubbleStyle', { size: v })} min={10} max={48} unit="px" /></div>
                                    <div><Label>{t('style.color')}</Label><ColorInput value={cfg.bubbleStyle.color} onChange={v => updateStyle('bubbleStyle', { color: v })} /></div>
                                    <div><Label>{t('style.background')}</Label><ColorInput value={cfg.bubbleStyle.background.startsWith('#') ? cfg.bubbleStyle.background : '#ffffff'} onChange={v => updateStyle('bubbleStyle', { background: v })} /></div>
                                </div>
                            </Card>
                        </>
                    )}

                    {tab === 'behavior' && (
                        <Card>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div><SectionTitle>{t('behavior.title')}</SectionTitle><SubLabel>{t('behavior.hint')}</SubLabel></div>
                                <button onClick={() => { if (confirm(t('behavior.confirmReset'))) update({ behavior: defaultPetsConfig().behavior }); }} className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-sm border border-[#374151]" title={t('behavior.reset')}><RotateCcw className="w-4 h-4" /></button>
                            </div>
                            <div className="mt-4 space-y-5">
                                <div>
                                    <Label>{t('behavior.wander')}</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><SubLabel>{t('behavior.min')}</SubLabel><Slider value={cfg.behavior.wanderMinSec} onChange={v => updateBehavior({ wanderMinSec: Math.min(v, cfg.behavior.wanderMaxSec) })} min={2} max={120} unit="s" /></div>
                                        <div><SubLabel>{t('behavior.max')}</SubLabel><Slider value={cfg.behavior.wanderMaxSec} onChange={v => updateBehavior({ wanderMaxSec: Math.max(v, cfg.behavior.wanderMinSec) })} min={2} max={180} unit="s" /></div>
                                    </div>
                                </div>
                                <div><Label>{t('behavior.walkSpeed')}</Label><Slider value={cfg.overlay.walkSpeedPx} onChange={v => updateOverlay({ walkSpeedPx: v })} min={20} max={400} unit="px/s" /></div>
                                <div>
                                    <Label>{t('behavior.walkArea')}</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><SubLabel>{t('behavior.left')}</SubLabel><Slider value={Math.round(cfg.behavior.walkArea.xMin * 100)} onChange={v => updateBehavior({ walkArea: { ...cfg.behavior.walkArea, xMin: Math.min(v, Math.round(cfg.behavior.walkArea.xMax * 100) - 10) / 100 } })} min={0} max={90} unit="%" /></div>
                                        <div><SubLabel>{t('behavior.right')}</SubLabel><Slider value={Math.round(cfg.behavior.walkArea.xMax * 100)} onChange={v => updateBehavior({ walkArea: { ...cfg.behavior.walkArea, xMax: Math.max(v, Math.round(cfg.behavior.walkArea.xMin * 100) + 10) / 100 } })} min={10} max={100} unit="%" /></div>
                                    </div>
                                </div>
                                <div>
                                    <Label>{t('behavior.sit')}</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div><SubLabel>{t('behavior.chance')}</SubLabel><Slider value={Math.round(cfg.behavior.sitChance * 100)} onChange={v => updateBehavior({ sitChance: v / 100 })} min={0} max={100} unit="%" /></div>
                                        <div><SubLabel>{t('behavior.min')}</SubLabel><Slider value={cfg.behavior.sitMinSec} onChange={v => updateBehavior({ sitMinSec: Math.min(v, cfg.behavior.sitMaxSec) })} min={3} max={120} unit="s" /></div>
                                        <div><SubLabel>{t('behavior.max')}</SubLabel><Slider value={cfg.behavior.sitMaxSec} onChange={v => updateBehavior({ sitMaxSec: Math.max(v, cfg.behavior.sitMinSec) })} min={3} max={300} unit="s" /></div>
                                    </div>
                                </div>
                                <div>
                                    <Label>{t('behavior.sleep')}</Label>
                                    <SubLabel>{t('behavior.sleepHint')}</SubLabel>
                                    <div className="grid grid-cols-3 gap-3 mt-1">
                                        <div><SubLabel>{t('behavior.sleepAfter')}</SubLabel><Slider value={cfg.behavior.sleepAfterSec} onChange={v => updateBehavior({ sleepAfterSec: v })} min={0} max={1800} step={30} unit="s" /></div>
                                        <div><SubLabel>{t('behavior.min')}</SubLabel><Slider value={cfg.behavior.sleepMinSec} onChange={v => updateBehavior({ sleepMinSec: Math.min(v, cfg.behavior.sleepMaxSec) })} min={5} max={600} step={5} unit="s" /></div>
                                        <div><SubLabel>{t('behavior.max')}</SubLabel><Slider value={cfg.behavior.sleepMaxSec} onChange={v => updateBehavior({ sleepMaxSec: Math.max(v, cfg.behavior.sleepMinSec) })} min={5} max={900} step={5} unit="s" /></div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {tab === 'overlay' && (
                        <>
                            <Card>
                                <SectionTitle>{t('url.title')}</SectionTitle>
                                <SubLabel>{t('url.hint', { size: `${cfg.overlay.width}×${cfg.overlay.height}` })}</SubLabel>
                                <div className="flex items-center gap-2 mt-3">
                                    <input readOnly value={overlayUrl} className="flex-1 bg-[#111214] border border-[#374151] rounded-lg px-3 py-2 text-sm text-[#e6edf3] font-mono" />
                                    <button onClick={() => navigator.clipboard.writeText(overlayUrl)} className="p-2.5 bg-[#262626] hover:bg-[#333] rounded-lg border border-[#374151] text-white" title={t('url.copy')}><Copy className="w-4 h-4" /></button>
                                    <a href={overlayUrl} target="_blank" rel="noreferrer" className="p-2.5 bg-[#262626] hover:bg-[#333] rounded-lg border border-[#374151] text-white" title={t('url.open')}><ExternalLink className="w-4 h-4" /></a>
                                </div>
                                <div className="mt-4"><Toggle checked={isEnabled} onChange={v => { setIsEnabled(v); setDirty(true); }} label={t('url.enabled')} description={t('url.enabledHint')} size="sm" /></div>
                            </Card>
                            <Card>
                                <SectionTitle>{t('overlay.title')}</SectionTitle>
                                <SubLabel>{t('overlay.hint')}</SubLabel>
                                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><Label>{t('overlay.width')}</Label><NumberInput value={cfg.overlay.width} onChange={v => updateOverlay({ width: Math.max(PET_LIMITS.minWidth, Math.min(PET_LIMITS.maxWidth, v)) })} min={PET_LIMITS.minWidth} max={PET_LIMITS.maxWidth} /></div>
                                    <div><Label>{t('overlay.height')}</Label><NumberInput value={cfg.overlay.height} onChange={v => updateOverlay({ height: Math.max(PET_LIMITS.minHeight, Math.min(PET_LIMITS.maxHeight, v)) })} min={PET_LIMITS.minHeight} max={PET_LIMITS.maxHeight} /></div>
                                    <div><Label>{t('overlay.petHeight')}</Label><NumberInput value={cfg.overlay.petHeightPx} onChange={v => updateOverlay({ petHeightPx: Math.max(PET_LIMITS.minPetHeight, Math.min(PET_LIMITS.maxPetHeight, v)) })} min={PET_LIMITS.minPetHeight} max={PET_LIMITS.maxPetHeight} /></div>
                                    <div><Label>{t('overlay.ground')}</Label><NumberInput value={cfg.overlay.groundPx} onChange={v => updateOverlay({ groundPx: Math.max(0, Math.min(cfg.overlay.height, v)) })} min={0} max={cfg.overlay.height} /></div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><Label>{t('overlay.tilt')}</Label><Slider value={Math.round(cfg.overlay.cameraTilt * 100)} onChange={v => updateOverlay({ cameraTilt: v / 100 })} min={0} max={100} unit="%" /></div>
                                    <div className="flex items-end"><Toggle checked={cfg.overlay.shadow} onChange={v => updateOverlay({ shadow: v })} label={t('overlay.shadow')} size="sm" /></div>
                                </div>
                            </Card>
                        </>
                    )}

                    {tab === 'testing' && (
                        <Card>
                            <SectionTitle>{t('testing.title')}</SectionTitle>
                            <SubLabel>{t('testing.hint')}</SubLabel>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {states.map(s => {
                                    const own = !!manifest?.states[s]?.clip;
                                    return <button key={s} onClick={() => setTestState(s)} title={own ? '' : t('testing.noClip')} className={`px-3 py-1.5 rounded-lg text-sm border ${testState === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#1a1b1e]'} ${own ? '' : 'border-dashed opacity-70'}`}>{s}{own ? '' : ' *'}</button>;
                                })}
                            </div>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2"><Label>{t('testing.bubble')}</Label><TextInput value={testBubble} onChange={setTestBubble} placeholder={t('testing.bubblePlaceholder')} /></div>
                                <div><Label>{t('testing.duration')}</Label><Slider value={testDuration} onChange={setTestDuration} min={1} max={30} unit="s" /></div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button onClick={() => sendTest(false)} className="px-4 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-sm border border-[#374151]">{t('testing.previewOnly')}</button>
                                <button onClick={() => sendTest(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">{t('testing.sendToOverlay')}</button>
                            </div>
                            <p className="text-[11px] text-[#6b7280] mt-3">{t('testing.note')}</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PetsConfigPage;
