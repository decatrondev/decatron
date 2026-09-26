import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import * as Design from '../../components/music-overlay/DesignTabs';
import type { OverlayLabels } from '../../components/music-overlay/MusicOverlayRenderer';
import { SAMPLE_TRACKS } from '../../components/music-overlay/defaults';
import { useLayoutFonts } from '../../components/music-overlay/utils';
import { useNowPlayingConfig } from './now-playing-extension/hooks/useNowPlayingConfig';
import { NP_ELEMENT_IDS } from './now-playing-extension/convertLegacy';
import { nowPlayingPresets } from './now-playing-extension/presets';
import { GuideTab, ConnectionTab, type NowPlayingTabId } from './now-playing-extension/components/SetupTabs';
import NowPlayingPreview from './now-playing-extension/components/NowPlayingPreview';

// Now Playing (.dev/plans/NOW_PLAYING_REDESIGN_PLAN.md, fase 2): mismo patrón que /overlays/song-request —
// pestañas a la izquierda (2/3), vista previa en vivo a la derecha (1/3), diseño con el motor compartido.

const TABS: { id: NowPlayingTabId; icon: string }[] = [
    { id: 'guide', icon: '📚' },
    { id: 'connection', icon: '🔌' },
    { id: 'theme', icon: '🎨' },
    { id: 'elements', icon: '🖼️' },
    { id: 'typography', icon: '🔤' },
    { id: 'animations', icon: '✨' },
    { id: 'editor', icon: '🖥️' },
];

export default function NowPlayingConfig() {
    const { t } = useTranslation('overlays');
    const navigate = useNavigate();
    const cfg = useNowPlayingConfig();
    const [tab, setTab] = useState<NowPlayingTabId>(() => (sessionStorage.getItem('np-tab') as NowPlayingTabId) || 'guide');
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    useLayoutFonts([cfg.layout]);

    useEffect(() => { try { sessionStorage.setItem('np-tab', tab); } catch { /* sin storage */ } }, [tab]);

    useEffect(() => {
        if (!cfg.dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [cfg.dirty]);

    useEffect(() => {
        if (!message) return;
        const id = window.setTimeout(() => setMessage(null), 4000);
        return () => window.clearTimeout(id);
    }, [message]);

    const labels: OverlayLabels = useMemo(() => ({ requestedBy: '', next: '', fallback: '', idle: t('nowPlaying.idle') }), [t]);

    const save = async () => {
        const ok = await cfg.save();
        setMessage({ ok, text: ok ? t('nowPlaying.saved') : t('nowPlaying.saveFailed') });
    };

    if (cfg.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (cfg.error) {
        return (
            <div className="p-8">
                <div className="max-w-xl mx-auto p-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                    {cfg.error === 'forbidden' ? t('nowPlaying.forbidden') : t('nowPlaying.loadFailed')}
                </div>
            </div>
        );
    }

    const design: Design.DesignProps = { layout: cfg.layout, onChange: cfg.updateLayout, elementIds: NP_ELEMENT_IDS };
    const sampleTrack = SAMPLE_TRACKS[0];

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6 lg:p-8">
            {/* panel-scale agranda todo en 2K/4K; el editor calcula el arrastre con el tamaño real en pantalla */}
            <div className="panel-scale max-w-[1920px] mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/overlays')}
                            className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                        >
                            <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                        <div>
                            <h1 className="text-3xl 3xl:text-4xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('nowPlaying.title')}</h1>
                            <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] mt-1">{t('nowPlaying.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {cfg.dirty && <span className="text-xs 3xl:text-sm font-bold text-amber-600 dark:text-amber-400">{t('nowPlaying.unsaved')}</span>}
                        <button
                            onClick={save}
                            disabled={cfg.saving || !cfg.dirty}
                            className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg ${cfg.saving || !cfg.dirty
                                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                                : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white'}`}
                        >
                            <Save className="w-5 h-5" />
                            {cfg.saving ? t('nowPlaying.saving') : t('nowPlaying.save')}
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl border ${message.ok
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
                        {message.text}
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
                                        {item.icon} {t(`nowPlaying.tabs.${item.id}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            {tab === 'guide' && <GuideTab cfg={cfg} onNavigate={setTab} />}
                            {tab === 'connection' && <ConnectionTab cfg={cfg} />}
                            {tab === 'theme' && <Design.ThemeTab {...design} templates={{ list: cfg.templates, onChange: cfg.updateTemplates }} />}
                            {tab === 'elements' && <Design.ElementsTab {...design} labels={labels} />}
                            {tab === 'typography' && <Design.TypographyTab {...design} />}
                            {tab === 'animations' && <Design.AnimationsTab {...design} />}
                            {tab === 'editor' && (
                                <Design.EditorTab
                                    {...design}
                                    labels={labels}
                                    presets={nowPlayingPresets(cfg.layout.canvas)}
                                    sample={{
                                        current: sampleTrack,
                                        queue: [],
                                        progress: { itemId: sampleTrack.id, position: 80, duration: sampleTrack.durationSeconds ?? 200, playing: false },
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    <div className="xl:col-span-1 min-w-0">
                        <NowPlayingPreview layout={cfg.layout} labels={labels} channel={cfg.channel} dirty={cfg.dirty} />
                    </div>
                </div>
            </div>
        </div>
    );
}
