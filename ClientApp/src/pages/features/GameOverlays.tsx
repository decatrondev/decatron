/**
 * Game Overlays — panel de configuracion (/overlays/games).
 * Pestañas: Cuentas (de la persona), Juegos, Detección, Diseño, Overlay (URL e instancias).
 * Ver .dev/plans/GAME_OVERLAYS_PLAN.md §4.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Gamepad2, Users, Radar, Palette, Monitor, Save, Loader2, ChevronRight, Copy, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MovedToLiveNotice } from './live-overlay/MovedToLiveNotice';
import api from '../../services/api';
import { Card, SectionTitle, SubLabel, Label, TextInput, Toggle } from './now-playing-extension/components/ui/SharedUI';
import { PanelData, gameOverlaysApi, errorMessage } from './game-overlays/api';
import { GAME_IDS, GameId, GameOverlayInstance, GameVisualConfig, resolveGameConfig } from './game-overlays/types';
import { AccountsTab } from './game-overlays/tabs/AccountsTab';
import { GamesTab } from './game-overlays/tabs/GamesTab';
import { DetectionTab } from './game-overlays/tabs/DetectionTab';
import { DesignTab } from './game-overlays/tabs/DesignTab';

type TabId = 'accounts' | 'games' | 'detection' | 'design' | 'overlay';

const TABS: { id: TabId; icon: React.FC<{ className?: string }> }[] = [
    { id: 'accounts', icon: Users },
    { id: 'games', icon: Gamepad2 },
    { id: 'detection', icon: Radar },
    { id: 'design', icon: Palette },
    { id: 'overlay', icon: Monitor },
];

function resolveAll(instance: GameOverlayInstance): Record<GameId, GameVisualConfig> {
    const out = {} as Record<GameId, GameVisualConfig>;
    for (const g of GAME_IDS) out[g] = resolveGameConfig(g, instance.games?.[g] ?? null);
    return out;
}

const GameOverlays: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('games', { keyPrefix: 'gameOverlays' });
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
            if (!res.success) { setSaveMsg({ type: 'err', text: res.message || t('saveError') }); return; }
            setSaveMsg({ type: 'ok', text: res.adjustments?.length ? `${t('savedWithAdjustments')}: ${res.adjustments.join(' ')}` : t('saved') });
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
        if (!confirm(t('confirmDelete', { slug: s }))) return;
        await gameOverlaysApi.deleteInstance(s);
        await load(data?.instances.find(i => i.slug !== s)?.slug);
    };

    const switchInstance = (s: string) => {
        if (dirty && !confirm(t('confirmSwitch'))) return;
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
                        <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text mx-auto mb-3" />
                        <p className="text-ds-soft font-medium">{t('loading')}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return <div className="text-ds-danger">{t('loadError')} {saveMsg?.text}</div>;

    const tierLabel = data.tier === 'admin' ? 'Admin' : data.tier.charAt(0).toUpperCase() + data.tier.slice(1);

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/overlays')} className="p-3 bg-ds-surface rounded-lg border border-ds-border hover:bg-ds-raised transition-colors">
                        <ArrowLeft className="w-5 h-5 text-ds-soft" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-ds-text flex items-center gap-2">
                            <Gamepad2 className="w-6 h-6 text-ds-accent-text" /> Game Overlays
                        </h1>
                        <p className="text-sm text-ds-soft mt-0.5">
                            {t('subtitle')} · {t('channel')} <b>{data.channel.displayName}</b> ({data.channel.platform}) · {t('plan')} {tierLabel}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saveMsg && (
                        <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${saveMsg.type === 'ok' ? 'bg-ds-ok/10 text-ds-ok border border-ds-ok/40' : 'bg-ds-danger/10 text-ds-danger border border-ds-danger/40'}`}>{saveMsg.text}</span>
                    )}
                    {draft && (
                        <button onClick={save} disabled={saving || !dirty} className="ds-btn ds-btn--primary">
                            <Save className="w-4 h-4" /> {saving ? t('saving') : dirty ? t('save') : t('saved')}
                        </button>
                    )}
                </div>
            </div>

            <MovedToLiveNotice />

            <div className="flex gap-6">
                <div className="w-48 flex-shrink-0">
                    <nav className="bg-ds-surface rounded-lg border border-ds-border p-2 space-y-1 sticky top-8">
                        {TABS.map(tb => {
                            const Icon = tb.icon; const active = tab === tb.id;
                            return (
                                <button key={tb.id} onClick={() => setTab(tb.id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-ds-accent text-ds-on-accent' : 'text-ds-soft hover:bg-ds-bg hover:text-ds-text'}`}>
                                    <Icon className="w-4 h-4 flex-shrink-0" /><span>{t(`tabs.${tb.id}`)}</span>{active && <ChevronRight className="w-3 h-3 ml-auto" />}
                                </button>
                            );
                        })}
                    </nav>
                    {data.instances.length > 1 && draft && (
                        <div className="mt-3 bg-ds-surface rounded-lg border border-ds-border p-2">
                            <div className="text-[10px] uppercase tracking-wider text-ds-soft px-2 py-1">Overlay</div>
                            {data.instances.map(i => (
                                <button key={i.slug} onClick={() => switchInstance(i.slug)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${i.slug === slug ? 'bg-ds-bg text-ds-text' : 'text-ds-soft hover:text-ds-text'}`}>{i.name}</button>
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
                            <SectionTitle>{t('first.title')}</SectionTitle>
                            <SubLabel>{t('first.hint')}</SubLabel>
                            <div className="flex items-center gap-2 mt-3">
                                <TextInput value={newName} onChange={setNewName} placeholder={t('first.placeholder')} />
                                <button onClick={createInstance} className="ds-btn ds-btn--primary"><Plus className="w-4 h-4" /> {t('first.create')}</button>
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
                                <SectionTitle>{t('url.title')}</SectionTitle>
                                <SubLabel>{t('url.hint', { size: `${draft.canvas.width}×${draft.canvas.height}` })}</SubLabel>
                                <div className="flex items-center gap-2 mt-3">
                                    <input readOnly value={overlayUrl} className="ds-input flex-1 font-mono" />
                                    <button onClick={() => navigator.clipboard.writeText(overlayUrl)} className="p-2.5 bg-ds-bg hover:bg-ds-raised rounded-lg border border-ds-border text-ds-text" title={t('url.copy')}><Copy className="w-4 h-4" /></button>
                                    <a href={`${overlayUrl}&preview=${enabledGames[0] ?? 'lol'}`} target="_blank" rel="noreferrer" className="p-2.5 bg-ds-bg hover:bg-ds-raised rounded-lg border border-ds-border text-ds-text" title={t('url.openPreview')}><ExternalLink className="w-4 h-4" /></a>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><Label>{t('url.name')}</Label><TextInput value={draft.name} onChange={v => updateDraft({ name: v })} /></div>
                                    <div className="flex items-end"><Toggle checked={draft.isEnabled} onChange={v => updateDraft({ isEnabled: v })} label={t('url.enabled')} description={t('url.enabledHint')} size="sm" /></div>
                                </div>
                            </Card>

                            <Card>
                                <SectionTitle>{t('instances.title')} <span className="text-ds-soft font-normal text-sm">({data.instances.length}{data.limits.maxInstances ? `/${data.limits.maxInstances}` : ''})</span></SectionTitle>
                                <div className="space-y-2 mt-3">
                                    {data.instances.map(i => (
                                        <div key={i.slug} className="flex items-center justify-between rounded-lg border border-ds-border bg-ds-bg px-3 py-2">
                                            <div>
                                                <div className="text-sm text-ds-text font-medium">{i.name} <span className="text-ds-soft font-mono text-xs">· {i.slug}</span></div>
                                                <div className="text-[11px] text-ds-soft">{i.isEnabled ? t('instances.enabled') : t('instances.disabled')} · {t('instances.games', { count: Object.entries(i.games ?? {}).filter(([, g]) => g?.enabled).length })}</div>
                                            </div>
                                            <button onClick={() => deleteInstance(i.slug)} className="p-2 rounded-lg text-ds-soft hover:text-ds-danger hover:bg-ds-danger/10" title={t('instances.delete')}><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                                {(data.limits.maxInstances == null || data.instances.length < data.limits.maxInstances) ? (
                                    <div className="flex items-center gap-2 mt-3">
                                        <TextInput value={newName} onChange={setNewName} placeholder={t('instances.newPlaceholder')} />
                                        <button onClick={createInstance} className="ds-btn ds-btn--primary"><Plus className="w-4 h-4" /> {t('instances.new')}</button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-ds-soft mt-3">{t('instances.limit', { count: data.limits.maxInstances })} <a href="/supporters" className="text-ds-accent-text underline">{t('instances.seePlans')}</a></p>
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
