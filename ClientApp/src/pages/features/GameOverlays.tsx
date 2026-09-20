/**
 * Game Overlays — panel de configuracion (/overlays/games).
 * Pestañas: Cuentas (de la persona), Juegos, Detección, Diseño, Overlay (URL e instancias).
 * Ver .dev/plans/GAME_OVERLAYS_PLAN.md §4.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Gamepad2, Users, Radar, Palette, Monitor, Save, Loader2, ChevronRight, Copy, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Card, SectionTitle, SubLabel, Label, TextInput, Toggle } from './now-playing-extension/components/ui/SharedUI';
import { PanelData, gameOverlaysApi, errorMessage } from './game-overlays/api';
import { GAME_IDS, GameId, GameOverlayInstance, GameVisualConfig, resolveGameConfig } from './game-overlays/types';
import { AccountsTab } from './game-overlays/tabs/AccountsTab';
import { GamesTab } from './game-overlays/tabs/GamesTab';
import { DetectionTab } from './game-overlays/tabs/DetectionTab';
import { DesignTab } from './game-overlays/tabs/DesignTab';

type TabId = 'accounts' | 'games' | 'detection' | 'design' | 'overlay';

const TABS: { id: TabId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'accounts', label: 'Cuentas', icon: Users },
    { id: 'games', label: 'Juegos', icon: Gamepad2 },
    { id: 'detection', label: 'Detección', icon: Radar },
    { id: 'design', label: 'Diseño', icon: Palette },
    { id: 'overlay', label: 'Overlay', icon: Monitor },
];

function resolveAll(instance: GameOverlayInstance): Record<GameId, GameVisualConfig> {
    const out = {} as Record<GameId, GameVisualConfig>;
    for (const g of GAME_IDS) out[g] = resolveGameConfig(g, instance.games?.[g] ?? null);
    return out;
}

const GameOverlays: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<PanelData | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<TabId>('accounts');
    const [slug, setSlug] = useState<string>('main');
    const [draft, setDraft] = useState<GameOverlayInstance | null>(null);
    const [games, setGames] = useState<Record<GameId, GameVisualConfig> | null>(null);
    const [designGame, setDesignGame] = useState<GameId>('lol');
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [frontendUrl, setFrontendUrl] = useState(window.location.origin);
    const [newName, setNewName] = useState('');

    const load = useCallback(async (keepSlug?: string) => {
        const d = await gameOverlaysApi.panel();
        setData(d);
        const target = d.instances.find(i => i.slug === (keepSlug ?? slug)) ?? d.instances[0] ?? null;
        if (target) { setSlug(target.slug); setDraft(target); setGames(resolveAll(target)); }
        else { setDraft(null); setGames(null); }
        setDirty(false);
    }, [slug]);

    useEffect(() => {
        (async () => {
            try {
                const info = await api.get('/settings/frontend-info').catch(() => null);
                if (info?.data?.frontendUrl) setFrontendUrl(info.data.frontendUrl);
                await load();
            } catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
            finally { setLoading(false); }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshAccounts = useCallback(async () => {
        const d = await gameOverlaysApi.panel();
        setData(prev => prev ? { ...prev, accounts: d.accounts, catalog: d.catalog, detection: d.detection, limits: d.limits, tier: d.tier } : d);
    }, []);

    const updateGame = (game: GameId, patch: Partial<GameVisualConfig>) => {
        setGames(prev => prev ? { ...prev, [game]: { ...prev[game], ...patch } } : prev);
        setDirty(true);
    };
    const updateDraft = (patch: Partial<GameOverlayInstance>) => { setDraft(prev => prev ? { ...prev, ...patch } : prev); setDirty(true); };

    const save = async () => {
        if (!draft || !games) return;
        setSaving(true); setSaveMsg(null);
        try {
            const res = await gameOverlaysApi.updateInstance(draft.slug, {
                name: draft.name, isEnabled: draft.isEnabled, detectionMode: draft.detectionMode, forcedGame: draft.forcedGame ?? '',
                idleBehavior: draft.idleBehavior, canvas: draft.canvas, games,
            });
            if (!res.success) { setSaveMsg({ type: 'err', text: res.message || 'Error al guardar' }); return; }
            setSaveMsg({ type: 'ok', text: res.adjustments?.length ? `Guardado con ajustes: ${res.adjustments.join(' ')}` : 'Guardado' });
            await load(draft.slug);
        } catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
        finally { setSaving(false); setTimeout(() => setSaveMsg(null), 6000); }
    };

    const createInstance = async () => {
        try {
            const res = await gameOverlaysApi.createInstance({ name: newName.trim() || undefined });
            if (!res.success) { setSaveMsg({ type: 'err', text: res.message }); return; }
            setNewName('');
            await load(res.instance.slug);
        } catch (e) { setSaveMsg({ type: 'err', text: errorMessage(e) }); }
    };

    const deleteInstance = async (s: string) => {
        if (!confirm(`¿Eliminar el overlay "${s}"? La URL dejará de funcionar en OBS.`)) return;
        await gameOverlaysApi.deleteInstance(s);
        await load(data?.instances.find(i => i.slug !== s)?.slug);
    };

    const switchInstance = (s: string) => {
        if (dirty && !confirm('Tienes cambios sin guardar. ¿Cambiar de overlay igual?')) return;
        const inst = data?.instances.find(i => i.slug === s);
        if (!inst) return;
        setSlug(s); setDraft(inst); setGames(resolveAll(inst)); setDirty(false);
    };

    const overlayUrl = useMemo(() => data && draft ? `${frontendUrl}${data.overlayUrlTemplate.replace('{slug}', draft.slug)}` : '', [data, draft, frontendUrl]);
    const enabledGames = useMemo(() => games ? GAME_IDS.filter(g => games[g].enabled) : [], [games]);

    if (loading) {
        return (
            <div className="space-y-6 max-w-[1400px] mx-auto">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-[#94a3b8] font-medium">Cargando Game Overlays...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return <div className="text-red-400">No se pudo cargar. {saveMsg?.text}</div>;

    const tierLabel = data.tier === 'admin' ? 'Admin' : data.tier.charAt(0).toUpperCase() + data.tier.slice(1);

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/overlays')} className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f1f5f9] dark:hover:bg-[#262626] transition-colors">
                        <ArrowLeft className="w-5 h-5 text-[#94a3b8]" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-2">
                            <Gamepad2 className="w-6 h-6 text-blue-400" /> Game Overlays
                        </h1>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                            Rango, sesión y partidas en pantalla, del juego que estás jugando · canal <b>{data.channel.displayName}</b> ({data.channel.platform}) · plan {tierLabel}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saveMsg && (
                        <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${saveMsg.type === 'ok' ? 'bg-green-900/30 text-green-400 border border-green-500/20' : 'bg-red-900/30 text-red-400 border border-red-500/20'}`}>{saveMsg.text}</span>
                    )}
                    {draft && (
                        <button onClick={save} disabled={saving || !dirty} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl transition-colors flex items-center gap-2 font-bold">
                            <Save className="w-4 h-4" /> {saving ? 'Guardando...' : dirty ? 'Guardar' : 'Guardado'}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-6">
                <div className="w-48 flex-shrink-0">
                    <nav className="bg-[#1B1C1D] rounded-xl border border-[#374151] p-2 space-y-1 sticky top-8">
                        {TABS.map(t => {
                            const Icon = t.icon; const active = tab === t.id;
                            return (
                                <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:bg-[#262626] hover:text-[#f8fafc]'}`}>
                                    <Icon className="w-4 h-4 flex-shrink-0" /><span>{t.label}</span>{active && <ChevronRight className="w-3 h-3 ml-auto" />}
                                </button>
                            );
                        })}
                    </nav>
                    {data.instances.length > 1 && draft && (
                        <div className="mt-3 bg-[#1B1C1D] rounded-xl border border-[#374151] p-2">
                            <div className="text-[10px] uppercase tracking-wider text-[#6b7280] px-2 py-1">Overlay</div>
                            {data.instances.map(i => (
                                <button key={i.slug} onClick={() => switchInstance(i.slug)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${i.slug === slug ? 'bg-[#262626] text-white' : 'text-[#94a3b8] hover:text-white'}`}>{i.name}</button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    {tab === 'accounts' && (
                        <AccountsTab accounts={data.accounts} catalog={data.catalog} limits={data.limits} onChanged={refreshAccounts} />
                    )}

                    {tab !== 'accounts' && !draft && (
                        <Card>
                            <SectionTitle>Crea tu primer overlay</SectionTitle>
                            <SubLabel>Una instancia = una URL para OBS. Con una alcanza; los planes superiores permiten varias (por ejemplo, una compacta y una grande para la pantalla de espera).</SubLabel>
                            <div className="flex items-center gap-2 mt-3">
                                <TextInput value={newName} onChange={setNewName} placeholder="Principal" />
                                <button onClick={createInstance} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Crear</button>
                            </div>
                        </Card>
                    )}

                    {tab === 'games' && draft && games && (
                        <GamesTab games={games} accounts={data.accounts} catalog={data.catalog} limits={data.limits} onChange={updateGame} onDesign={g => { setDesignGame(g); setTab('design'); }} />
                    )}
                    {tab === 'detection' && draft && (
                        <DetectionTab instance={draft} detection={data.detection} enabledGames={enabledGames} onChange={updateDraft} onRefresh={refreshAccounts} />
                    )}
                    {tab === 'design' && draft && games && (
                        <DesignTab slug={draft.slug} game={designGame} games={games} canvas={draft.canvas} canHidePromo={data.limits.canHidePromo !== false} onSelectGame={setDesignGame} onChange={updateGame} onCanvasChange={c => updateDraft({ canvas: c })} />
                    )}
                    {tab === 'overlay' && draft && (
                        <div className="space-y-5">
                            <Card>
                                <SectionTitle>URL para OBS</SectionTitle>
                                <SubLabel>Agrega una fuente de navegador con esta URL y el tamaño del lienzo ({draft.canvas.width}×{draft.canvas.height}). Una sola fuente para todos los juegos.</SubLabel>
                                <div className="flex items-center gap-2 mt-3">
                                    <input readOnly value={overlayUrl} className="flex-1 bg-[#111214] border border-[#374151] rounded-lg px-3 py-2 text-sm text-[#e6edf3] font-mono" />
                                    <button onClick={() => navigator.clipboard.writeText(overlayUrl)} className="p-2.5 bg-[#262626] hover:bg-[#333] rounded-lg border border-[#374151] text-white" title="Copiar"><Copy className="w-4 h-4" /></button>
                                    <a href={`${overlayUrl}&preview=${enabledGames[0] ?? 'lol'}`} target="_blank" rel="noreferrer" className="p-2.5 bg-[#262626] hover:bg-[#333] rounded-lg border border-[#374151] text-white" title="Abrir con datos de ejemplo"><ExternalLink className="w-4 h-4" /></a>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><Label>Nombre</Label><TextInput value={draft.name} onChange={v => updateDraft({ name: v })} /></div>
                                    <div className="flex items-end"><Toggle checked={draft.isEnabled} onChange={v => updateDraft({ isEnabled: v })} label="Overlay activo" description="Desactivado = nunca se muestra" size="sm" /></div>
                                </div>
                            </Card>

                            <Card>
                                <SectionTitle>Instancias <span className="text-[#6b7280] font-normal text-sm">({data.instances.length}{data.limits.maxInstances ? `/${data.limits.maxInstances}` : ''})</span></SectionTitle>
                                <div className="space-y-2 mt-3">
                                    {data.instances.map(i => (
                                        <div key={i.slug} className="flex items-center justify-between rounded-lg border border-[#374151] bg-[#111214] px-3 py-2">
                                            <div>
                                                <div className="text-sm text-[#f8fafc] font-medium">{i.name} <span className="text-[#6b7280] font-mono text-xs">· {i.slug}</span></div>
                                                <div className="text-[11px] text-[#94a3b8]">{i.isEnabled ? 'activo' : 'desactivado'} · {Object.entries(i.games ?? {}).filter(([, g]) => g?.enabled).length} juego(s)</div>
                                            </div>
                                            <button onClick={() => deleteInstance(i.slug)} className="p-2 rounded-lg text-[#94a3b8] hover:text-red-400 hover:bg-red-900/20" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                                {(data.limits.maxInstances == null || data.instances.length < data.limits.maxInstances) ? (
                                    <div className="flex items-center gap-2 mt-3">
                                        <TextInput value={newName} onChange={setNewName} placeholder="Nombre del nuevo overlay" />
                                        <button onClick={createInstance} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo</button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-[#94a3b8] mt-3">Tu plan permite {data.limits.maxInstances} overlay(s). <a href="/supporters" className="text-blue-400 underline">Ver planes</a></p>
                                )}
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameOverlays;
