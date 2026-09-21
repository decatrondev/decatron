/**
 * Partida en vivo — panel de configuración (/overlays/live).
 * Pestañas: Diseño (caja fija con una pantalla por fase del Desktop) y Overlay (URL e instancias).
 * Ver .dev/plans/LIVE_MATCH_OVERLAY_PLAN.md §3.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Palette, Monitor, Save, Loader2, Copy, Plus, Trash2, ExternalLink, AlertTriangle, Maximize2, RotateCcw, Radio } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Card, SectionTitle, SubLabel, Label, TextInput, Toggle, SelectInput, ColorInput, Slider, NumberInput, Checkbox } from './now-playing-extension/components/ui/SharedUI';
import { CanvasEditor } from '../../components/overlay-editor/CanvasEditor';
import { errorMessage } from './game-overlays/api';
import { Measurer } from './game-overlays/CardMeasurer';
import { simulateLive } from './game-overlays/liveSim';
import { AccountOverlayState, CARD_SIZE_LIMITS, CardSize, OverlayState } from './game-overlays/types';
import { LivePanelData, liveOverlaysApi } from './live-overlay/api';
import { LiveMatchCard } from './live-overlay/LiveMatchCard';
import { LIVE_LAYOUTS, LIVE_LAYOUT_DEFAULT_SIZE, LIVE_SCREENS, LiveElementId, LiveLayout, LiveOverlayConfig, LiveOverlayInstance, LiveScreenId, SCREEN_ELEMENTS, defaultLiveConfig, resolveLiveConfig } from './live-overlay/types';

type TabId = 'design' | 'overlay';
const FONT_FAMILIES = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Bebas Neue', 'Rajdhani', 'Exo 2', 'Press Start 2P', 'system-ui'];

const LiveOverlays: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('games', { keyPrefix: 'liveOverlay' });
    const lang: 'es' | 'en' = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
    const [data, setData] = useState<LivePanelData | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<TabId>('design');
    const [slug, setSlug] = useState('main');
    const [draft, setDraft] = useState<LiveOverlayInstance | null>(null);
    const [cfg, setCfg] = useState<LiveOverlayConfig | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [frontendUrl, setFrontendUrl] = useState(window.location.origin);
    const [newName, setNewName] = useState('');
    // Diseño
    const [screen, setScreen] = useState<LiveScreenId>('champselect');
    const [selected, setSelected] = useState<LiveElementId>('title');
    const [preview, setPreview] = useState<AccountOverlayState | null>(null);
    const [measured, setMeasured] = useState<CardSize | null>(null);

    const load = useCallback(async (keepSlug?: string) => {
        const d = await liveOverlaysApi.panel();
        setData(d);
        const target = d.instances.find(i => i.slug === (keepSlug ?? slug)) ?? d.instances[0] ?? null;
        if (target) { setSlug(target.slug); setDraft(target); setCfg(resolveLiveConfig(target.config)); }
        else { setDraft(null); setCfg(null); }
        setDirty(false);
    }, [slug]);

    useEffect(() => {
        (async () => {
            try {
                const info = await api.get('/settings/frontend-info').catch(() => null);
                if (info?.data?.frontendUrl) setFrontendUrl(info.data.frontendUrl);
                await load();
                const r = await fetch('/api/game-overlays/preview-public?game=lol').then(x => x.json()) as { success: boolean; state: OverlayState };
                if (r.success) setPreview(r.state.accounts[0] ?? null);
            } catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
            finally { setLoading(false); }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const update = (patch: Partial<LiveOverlayConfig>) => { setCfg(prev => prev ? { ...prev, ...patch } : prev); setDirty(true); };
    const updateDraft = (patch: Partial<LiveOverlayInstance>) => { setDraft(prev => prev ? { ...prev, ...patch } : prev); setDirty(true); };

    // Fuentes de Google del preview.
    const fontsInUse = useMemo(() => {
        const set = new Set<string>();
        for (const e of Object.values(cfg?.elements ?? {})) { const f = e?.font?.family; if (f && f !== 'system-ui' && f !== 'Inter') set.add(f); }
        return [...set];
    }, [cfg]);
    useEffect(() => {
        if (fontsInUse.length === 0) return;
        const id = 'go-fonts';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
        link.href = `https://fonts.googleapis.com/css2?${fontsInUse.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`).join('&')}&display=swap`;
    }, [fontsInUse]);

    // Tamaño automático: el máximo entre todas las pantallas activas (simuladas).
    const wanted = useMemo<CardSize | null>(() => {
        if (!cfg || !measured) return null;
        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
        const width = cfg.layout === 'bar'
            ? clamp((draft?.canvas.width ?? 1920) - cfg.position.x * 2, measured.width, CARD_SIZE_LIMITS.maxWidth)
            : clamp(measured.width, CARD_SIZE_LIMITS.minWidth, CARD_SIZE_LIMITS.maxWidth);
        return { width, height: clamp(measured.height, CARD_SIZE_LIMITS.minHeight, CARD_SIZE_LIMITS.maxHeight) };
    }, [cfg, measured, draft?.canvas.width]);
    const fits = !cfg || !wanted || (cfg.size.width >= wanted.width && cfg.size.height >= wanted.height);
    useEffect(() => {
        if (!cfg || cfg.sizeMode !== 'auto' || !wanted) return;
        if (wanted.width !== cfg.size.width || wanted.height !== cfg.size.height) update({ size: wanted });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cfg?.sizeMode, wanted?.width, wanted?.height, cfg?.size.width, cfg?.size.height]);

    const save = async () => {
        if (!draft || !cfg) return;
        setSaving(true); setSaveMsg(null);
        try {
            const res = await liveOverlaysApi.updateInstance(draft.slug, { name: draft.name, isEnabled: draft.isEnabled, canvas: draft.canvas, config: cfg });
            if (!res.success) { setSaveMsg({ type: 'err', text: res.message || t('saveError') }); return; }
            setSaveMsg({ type: 'ok', text: t('saved') });
            await load(draft.slug);
        } catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
        finally { setSaving(false); setTimeout(() => setSaveMsg(null), 6000); }
    };
    const createInstance = async () => {
        try {
            const res = await liveOverlaysApi.createInstance({ name: newName.trim() || undefined });
            if (!res.success || !res.instance) { setSaveMsg({ type: 'err', text: res.message || t('saveError') }); return; }
            setNewName('');
            await load(res.instance.slug);
        } catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
    };
    const deleteInstance = async (s: string) => {
        if (!confirm(t('instances.confirmDelete'))) return;
        await liveOverlaysApi.deleteInstance(s);
        await load(s === slug ? undefined : slug);
    };

    const overlayUrl = useMemo(() => data && draft ? `${frontendUrl}${data.overlayUrlTemplate.replace('{slug}', draft.slug)}` : '', [data, draft, frontendUrl]);
    const simPhase = useMemo(() => preview ? simulateLive(screen, preview) : null, [screen, preview]);
    const el = cfg?.elements[selected] ?? { visible: true };
    const setEl = (patch: Partial<typeof el>) => cfg && update({ elements: { ...cfg.elements, [selected]: { ...el, ...patch } } });
    const setFont = (patch: Partial<NonNullable<typeof el.font>>) => setEl({ font: { ...el.font, ...patch } });
    useEffect(() => { if (!SCREEN_ELEMENTS[screen].includes(selected)) setSelected(SCREEN_ELEMENTS[screen][0]); }, [screen, selected]);

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/overlays')} className="p-2 rounded-lg hover:bg-[#262626] text-[#94a3b8]"><ArrowLeft className="w-5 h-5" /></button>
                    <Radio className="w-6 h-6 text-[#2563eb]" />
                    <div>
                        <h1 className="text-2xl font-black text-[#f8fafc]">{t('title')}</h1>
                        <p className="text-sm text-[#94a3b8]">{t('subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saveMsg && <span className={`text-sm ${saveMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{saveMsg.text}</span>}
                    {data && data.instances.length > 1 && (
                        <SelectInput value={slug} onChange={v => { if (dirty && !confirm(t('discard'))) return; load(v); }} options={data.instances.map(i => ({ value: i.slug, label: i.name }))} />
                    )}
                    <button onClick={save} disabled={!dirty || saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{t('save')}
                    </button>
                </div>
            </div>

            {data && !data.desktopLinked && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{t('needsDesktop')} <Link to="/features/lol-coach" className="underline">{t('needsDesktopLink')}</Link></span>
                </div>
            )}
            {data?.state.connected && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">{t('desktopOnline', { phase: t(`screens.${data.state.phase?.phase ?? 'none'}`), name: data.state.summonerName ?? '' })}</div>
            )}

            {!draft || !cfg ? (
                <Card>
                    <SectionTitle>{t('first.title')}</SectionTitle>
                    <SubLabel>{t('first.hint')}</SubLabel>
                    <div className="flex items-center gap-2 mt-3">
                        <TextInput value={newName} onChange={setNewName} placeholder={t('first.placeholder')} />
                        <button onClick={createInstance} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> {t('first.create')}</button>
                    </div>
                </Card>
            ) : (
                <div className="flex flex-col lg:flex-row gap-5">
                    <div className="lg:w-48 flex lg:flex-col gap-1">
                        {([['design', Palette], ['overlay', Monitor]] as [TabId, React.FC<{ className?: string }>][]).map(([id, Icon]) => (
                            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${tab === id ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:bg-[#262626]'}`}><Icon className="w-4 h-4" />{t(`tabs.${id}`)}</button>
                        ))}
                    </div>
                    <div className="flex-1 min-w-0">
                        {tab === 'design' && (
                            <div className="space-y-5">
                                <Card>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div><SectionTitle>{t('design.title')}</SectionTitle><SubLabel>{t('design.hint')}</SubLabel></div>
                                        <button onClick={() => { if (confirm(t('design.confirmReset'))) update(defaultLiveConfig()); }} className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-sm border border-[#374151]" title={t('design.reset')}><RotateCcw className="w-4 h-4" /></button>
                                    </div>
                                    <div className="mt-4">
                                        <CanvasEditor width={draft.canvas.width} height={draft.canvas.height} snap={10} onMove={(_, position) => update({ position })}
                                            items={simPhase ? [{ id: 'card', position: cfg.position, node: (
                                                <div style={{ outline: '1px dashed rgba(96,165,250,.6)' }}>
                                                    <LiveMatchCard config={cfg} phase={simPhase} lang={lang} />
                                                </div>
                                            ) }] : []} />
                                        {preview && (
                                            <Measurer depsKey={JSON.stringify({ ...cfg, size: undefined, scale: undefined, position: undefined }) + lang} onMeasure={setMeasured}
                                                items={LIVE_SCREENS.filter(s => cfg.screens[s].enabled).map(s => ({ key: s, node: <LiveMatchCard config={{ ...cfg, scale: 1 }} phase={simulateLive(s, preview)} lang={lang} measure /> }))} />
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                        <span className="text-[11px] text-[#94a3b8] mr-1">{t('design.screen')}:</span>
                                        {LIVE_SCREENS.map(s => (
                                            <button key={s} onClick={() => setScreen(s)} className={`px-2.5 py-1 rounded-lg text-xs border ${screen === s ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'} ${cfg.screens[s].enabled ? '' : 'line-through opacity-60'}`}>{t(`screens.${s}`)}</button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap items-end gap-4 mt-3">
                                        <div className="w-40"><Label>{t('design.canvas')}</Label>
                                            <SelectInput value={`${draft.canvas.width}x${draft.canvas.height}`} onChange={v => { const [w, h] = v.split('x').map(Number); updateDraft({ canvas: { width: w, height: h } }); }}
                                                options={[{ value: '1920x1080', label: '1920×1080' }, { value: '1280x720', label: '1280×720' }, { value: '2560x1440', label: '2560×1440' }, { value: '3840x2160', label: '3840×2160' }]} />
                                        </div>
                                        <div className="w-28"><Label>{t('design.posX')}</Label><NumberInput value={cfg.position.x} onChange={x => update({ position: { ...cfg.position, x } })} min={0} max={draft.canvas.width} /></div>
                                        <div className="w-28"><Label>{t('design.posY')}</Label><NumberInput value={cfg.position.y} onChange={y => update({ position: { ...cfg.position, y } })} min={0} max={draft.canvas.height} /></div>
                                        <div className="w-40"><Label>{t('design.sizeMode')}</Label>
                                            <SelectInput value={cfg.sizeMode} onChange={v => update(v === 'auto' ? { sizeMode: 'auto', ...(wanted ? { size: wanted } : {}) } : { sizeMode: 'manual' })} options={[{ value: 'auto', label: t('design.sizeAuto') }, { value: 'manual', label: t('design.sizeManual') }]} />
                                        </div>
                                        <div className="w-28"><Label>{t('design.boxWidth')}</Label><NumberInput value={cfg.size.width} onChange={w => update({ sizeMode: 'manual', size: { ...cfg.size, width: Math.max(CARD_SIZE_LIMITS.minWidth, Math.min(CARD_SIZE_LIMITS.maxWidth, w)) } })} min={CARD_SIZE_LIMITS.minWidth} max={CARD_SIZE_LIMITS.maxWidth} disabled={cfg.sizeMode === 'auto'} /></div>
                                        <div className="w-28"><Label>{t('design.boxHeight')}</Label><NumberInput value={cfg.size.height} onChange={h => update({ sizeMode: 'manual', size: { ...cfg.size, height: Math.max(CARD_SIZE_LIMITS.minHeight, Math.min(CARD_SIZE_LIMITS.maxHeight, h)) } })} min={CARD_SIZE_LIMITS.minHeight} max={CARD_SIZE_LIMITS.maxHeight} disabled={cfg.sizeMode === 'auto'} /></div>
                                        <div className="w-40"><Label>{t('design.scale')}</Label><Slider value={Math.round(cfg.scale * 100)} onChange={v => update({ scale: Math.max(CARD_SIZE_LIMITS.minScale, Math.min(CARD_SIZE_LIMITS.maxScale, v / 100)) })} min={CARD_SIZE_LIMITS.minScale * 100} max={CARD_SIZE_LIMITS.maxScale * 100} unit="%" /></div>
                                        {cfg.sizeMode === 'manual' && wanted && (
                                            <button onClick={() => update({ size: wanted })} className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-xs flex items-center gap-2 border border-[#374151]"><Maximize2 className="w-3.5 h-3.5" />{t('design.fit')}</button>
                                        )}
                                    </div>
                                    {cfg.sizeMode === 'manual' && !fits && wanted && (
                                        <p className="text-[11px] text-amber-400 mt-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{t('design.sizeOverflow', { w: wanted.width, h: wanted.height })}</p>
                                    )}
                                    <p className="text-[11px] text-[#6b7280] mt-2">{t('design.boxHint')}</p>
                                </Card>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                    <Card>
                                        <SectionTitle>{t('design.card')}</SectionTitle>
                                        <div className="space-y-4 mt-3">
                                            <div>
                                                <Label>Layout</Label>
                                                <div className="grid grid-cols-3 gap-2 mt-1">
                                                    {LIVE_LAYOUTS.map(l => (
                                                        <button key={l} onClick={() => update({ layout: l, size: { ...LIVE_LAYOUT_DEFAULT_SIZE[l] } })} className={`px-2 py-2 rounded-lg text-xs border ${cfg.layout === l ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'}`}>{t(`layouts.${l}`)}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div><Label>{t('design.accent')}</Label><ColorInput value={cfg.accent} onChange={v => update({ accent: v })} /></div>
                                            <div><Label>{t('design.background')}</Label><SelectInput value={cfg.background.type} onChange={v => update({ background: { ...cfg.background, type: v as any } })} options={[{ value: 'solid', label: t('design.bgSolid') }, { value: 'transparent', label: t('design.bgTransparent') }]} /></div>
                                            {cfg.background.type === 'solid' && (
                                                <>
                                                    <div><Label>{t('design.bgColor')}</Label><ColorInput value={cfg.background.color} onChange={v => update({ background: { ...cfg.background, color: v } })} /></div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div><Label>{t('design.opacity')}</Label><Slider value={cfg.background.opacity} onChange={v => update({ background: { ...cfg.background, opacity: v } })} min={0} max={100} unit="%" /></div>
                                                        <div><Label>{t('design.radius')}</Label><Slider value={cfg.background.radius} onChange={v => update({ background: { ...cfg.background, radius: v } })} min={0} max={32} unit="px" /></div>
                                                    </div>
                                                </>
                                            )}
                                            <div className="grid grid-cols-3 gap-3">
                                                {(['in', 'out', 'phaseSwitch'] as const).map(k => (
                                                    <div key={k}><Label>{t(`design.anim.${k}`)}</Label><SelectInput value={cfg.animation[k]} onChange={v => update({ animation: { ...cfg.animation, [k]: v as any } })} options={[{ value: 'fade', label: t('design.animFade') }, { value: 'slide', label: t('design.animSlide') }, { value: 'none', label: t('design.animNone') }]} /></div>
                                                ))}
                                            </div>
                                            <div>
                                                <Label>{t('design.chrome')}</Label>
                                                <div className="grid grid-cols-2 gap-2 mt-1">
                                                    <Checkbox checked={cfg.chrome.accentLine} onChange={v => update({ chrome: { ...cfg.chrome, accentLine: v } })} label={t('design.chromeAccentLine')} />
                                                    <Checkbox checked={cfg.chrome.shadow} onChange={v => update({ chrome: { ...cfg.chrome, shadow: v } })} label={t('design.chromeShadow')} />
                                                </div>
                                                {cfg.chrome.accentLine && <div className="mt-2"><Label>{t('design.chromeAccentWidth')}</Label><Slider value={cfg.chrome.accentWidth} onChange={v => update({ chrome: { ...cfg.chrome, accentWidth: v } })} min={1} max={12} unit="px" /></div>}
                                            </div>
                                        </div>
                                    </Card>

                                    <Card>
                                        <SectionTitle>{t('design.screenTitle', { screen: t(`screens.${screen}`) })}</SectionTitle>
                                        <div className="mt-3">
                                            <Toggle checked={cfg.screens[screen].enabled} onChange={v => update({ screens: { ...cfg.screens, [screen]: { enabled: v } } })} label={t('design.screenEnabled')} description={t(`screenHelp.${screen}`)} size="sm" />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {SCREEN_ELEMENTS[screen].map(id => {
                                                const visible = cfg.elements[id]?.visible !== false;
                                                return <button key={id} onClick={() => setSelected(id)} className={`px-2.5 py-1.5 rounded-lg text-xs border ${selected === id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'} ${visible ? '' : 'line-through opacity-60'}`}>{t(`elements.${id}`)}</button>;
                                            })}
                                        </div>
                                        <div className="mt-4 space-y-4">
                                            <Toggle checked={el.visible !== false} onChange={v => setEl({ visible: v })} label={`${t('design.show')} ${t(`elements.${selected}`).toLowerCase()}`} size="sm" />
                                            {selected.startsWith('scout') && <p className="text-[11px] text-amber-300/80">{t('elementHelp.scout')}</p>}
                                            {(selected === 'coachSay' || selected === 'coachTips') && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.coach')}</p>}
                                            {selected === 'prediction' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.prediction')}</p>}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><Label>{t('design.font')}</Label><SelectInput value={el.font?.family ?? 'Inter'} onChange={v => setFont({ family: v })} options={FONT_FAMILIES.map(f => ({ value: f, label: f }))} /></div>
                                                <div><Label>{t('design.weight')}</Label><SelectInput value={String(el.font?.weight ?? 500)} onChange={v => setFont({ weight: Number(v) })} options={[400, 500, 600, 700, 800].map(w => ({ value: String(w), label: String(w) }))} /></div>
                                            </div>
                                            <div><Label>{t('design.size')}</Label><Slider value={el.font?.size ?? 13} onChange={v => setFont({ size: v })} min={8} max={48} unit="px" /></div>
                                            <div><Label>{t('design.color')}</Label><ColorInput value={el.font?.color ?? '#ffffff'} onChange={v => setFont({ color: v })} /></div>
                                            <Checkbox checked={!!el.font?.shadow} onChange={v => setFont({ shadow: v })} label={t('design.shadow')} />
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )}

                        {tab === 'overlay' && data && (
                            <div className="space-y-5">
                                <Card>
                                    <SectionTitle>{t('url.title')}</SectionTitle>
                                    <SubLabel>{t('url.hint', { size: `${draft.canvas.width}×${draft.canvas.height}` })}</SubLabel>
                                    <div className="flex items-center gap-2 mt-3">
                                        <input readOnly value={overlayUrl} className="flex-1 bg-[#111214] border border-[#374151] rounded-lg px-3 py-2 text-sm text-[#e6edf3] font-mono" />
                                        <button onClick={() => navigator.clipboard.writeText(overlayUrl)} className="p-2.5 bg-[#262626] hover:bg-[#333] rounded-lg border border-[#374151] text-white" title={t('url.copy')}><Copy className="w-4 h-4" /></button>
                                        <a href={`${overlayUrl}&preview=champselect`} target="_blank" rel="noreferrer" className="p-2.5 bg-[#262626] hover:bg-[#333] rounded-lg border border-[#374151] text-white" title={t('url.openPreview')}><ExternalLink className="w-4 h-4" /></a>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><Label>{t('url.name')}</Label><TextInput value={draft.name} onChange={v => updateDraft({ name: v })} /></div>
                                        <div className="flex items-end"><Toggle checked={draft.isEnabled} onChange={v => updateDraft({ isEnabled: v })} label={t('url.enabled')} description={t('url.enabledHint')} size="sm" /></div>
                                    </div>
                                </Card>
                                <Card>
                                    <SectionTitle>{t('instances.title')} <span className="text-[#6b7280] font-normal text-sm">({data.instances.length}/5)</span></SectionTitle>
                                    <SubLabel>{t('instances.hint')}</SubLabel>
                                    <div className="space-y-2 mt-3">
                                        {data.instances.map(i => (
                                            <div key={i.slug} className="flex items-center justify-between rounded-lg border border-[#374151] bg-[#111214] px-3 py-2">
                                                <div>
                                                    <div className="text-sm text-[#f8fafc] font-medium">{i.name} <span className="text-[#6b7280] font-mono text-xs">· {i.slug}</span></div>
                                                    <div className="text-[11px] text-[#94a3b8]">{i.isEnabled ? t('instances.enabled') : t('instances.disabled')}</div>
                                                </div>
                                                <button onClick={() => deleteInstance(i.slug)} className="p-2 rounded-lg text-[#94a3b8] hover:text-red-400 hover:bg-red-900/20" title={t('instances.delete')}><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                    {data.instances.length < 5 && (
                                        <div className="flex items-center gap-2 mt-3">
                                            <TextInput value={newName} onChange={setNewName} placeholder={t('instances.newPlaceholder')} />
                                            <button onClick={createInstance} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> {t('instances.new')}</button>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveOverlays;
