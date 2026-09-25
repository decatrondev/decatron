import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import { useSongRequestConfig } from './song-request-extension/hooks/useSongRequestConfig';
import { useSongRequestWatch } from './song-request-extension/hooks/useSongRequestHub';
import { useLayoutFonts } from './song-request-extension/utils';
import SongRequestPreview from './song-request-extension/components/SongRequestPreview';
import QueueTab from './song-request-extension/components/tabs/QueueTab';
import { GuideTab, BasicTab, CommandsTab, MessagesTab } from './song-request-extension/components/tabs/SetupTabs';
import DownloadsTab from './song-request-extension/components/tabs/DownloadsTab';
import { FiltersTab, BlacklistTab, FallbackTab, HistoryTab } from './song-request-extension/components/tabs/LibraryTabs';
import { ThemeTab, ElementsTab, TypographyTab, AnimationsTab, EditorTab } from './song-request-extension/components/tabs/DesignTabs';
import type { OverlayLabels } from './song-request-extension/components/SongOverlayRenderer';
import type { OverlayKind, TabId } from './song-request-extension/types';

// Song Request (.dev/plans/SONG_REQUEST_PLAN.md, fase 2): mismo patrón que /overlays/timer —
// pestañas a la izquierda (2/3), vista previa en vivo a la derecha (1/3).

const TABS: { id: TabId; icon: string }[] = [
    { id: 'guide', icon: '📚' },
    { id: 'queue', icon: '🎵' },
    { id: 'basic', icon: '⚙️' },
    { id: 'filters', icon: '🚦' },
    { id: 'blacklist', icon: '⛔' },
    { id: 'fallback', icon: '🎶' },
    { id: 'history', icon: '📈' },
    { id: 'downloads', icon: '⬇️' },
    { id: 'commands', icon: '💬' },
    { id: 'messages', icon: '📢' },
    { id: 'theme', icon: '🎨' },
    { id: 'elements', icon: '🖼️' },
    { id: 'typography', icon: '🔤' },
    { id: 'animations', icon: '✨' },
    { id: 'editor', icon: '🖥️' },
];

export default function SongRequestConfig() {
    const { t } = useTranslation('overlays');
    const navigate = useNavigate();
    const cfg = useSongRequestConfig();
    const [tab, setTab] = useState<TabId>(() => (sessionStorage.getItem('sr-tab') as TabId) || 'guide');
    const [kind, setKind] = useState<OverlayKind>('player');
    // Link que se manda a Descargas desde la Cola o el Historial
    const [downloadInput, setDownloadInput] = useState<string | null>(null);
    const sendToDownloads = (url: string) => { setDownloadInput(url); setTab('downloads'); };
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const live = useSongRequestWatch(cfg.server?.channel ?? null);
    useLayoutFonts([cfg.overlay.player, cfg.overlay.nowPlaying]);

    useEffect(() => { try { sessionStorage.setItem('sr-tab', tab); } catch { /* sin storage */ } }, [tab]);

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

    const labels: OverlayLabels = useMemo(() => ({
        requestedBy: t('songRequest.overlayLabels.requestedBy', { user: '{{user}}' }),
        next: t('songRequest.overlayLabels.next'),
        fallback: t('songRequest.overlayLabels.fallback'),
        idle: t('songRequest.overlayLabels.idle'),
    }), [t]);

    const save = async () => {
        const ok = await cfg.save();
        setMessage({ ok, text: ok ? t('songRequest.saved') : t('songRequest.saveFailed') });
    };

    if (cfg.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (cfg.error || !cfg.server) {
        return (
            <div className="p-8">
                <div className="max-w-xl mx-auto p-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                    {cfg.error === 'forbidden' ? t('songRequest.forbidden') : t('songRequest.loadFailed')}
                </div>
            </div>
        );
    }

    const designProps = { cfg, kind, onKindChange: setKind };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6 lg:p-8">
            {/* panel-scale agranda todo en 2K/4K; el editor calcula el arrastre con el tamaño real en pantalla */}
            <div className="panel-scale max-w-[1920px] mx-auto">
                {/* Encabezado */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/overlays')}
                            className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                        >
                            <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                        <div>
                            <h1 className="text-3xl 3xl:text-4xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('songRequest.title')}</h1>
                            <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] mt-1">{t('songRequest.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {cfg.dirty && <span className="text-xs 3xl:text-sm font-bold text-amber-600 dark:text-amber-400">{t('songRequest.unsaved')}</span>}
                        <button
                            onClick={save}
                            disabled={cfg.saving || !cfg.dirty}
                            className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg ${cfg.saving || !cfg.dirty
                                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                                : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white'}`}
                        >
                            <Save className="w-5 h-5" />
                            {cfg.saving ? t('songRequest.saving') : t('songRequest.save')}
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
                                        {item.icon} {t(`songRequest.tabs.${item.id}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            {tab === 'guide' && <GuideTab cfg={cfg} onNavigate={setTab} />}
                            {tab === 'queue' && <QueueTab cfg={cfg} snapshot={live.snapshot} progress={live.progress} connected={live.connected} onDownload={sendToDownloads} />}
                            {tab === 'basic' && <BasicTab cfg={cfg} />}
                            {tab === 'filters' && <FiltersTab cfg={cfg} />}
                            {tab === 'blacklist' && <BlacklistTab />}
                            {tab === 'fallback' && <FallbackTab cfg={cfg} />}
                            {tab === 'history' && <HistoryTab onDownload={sendToDownloads} />}
                            {tab === 'downloads' && <DownloadsTab initialInput={downloadInput} onInputConsumed={() => setDownloadInput(null)} />}
                            {tab === 'commands' && <CommandsTab cfg={cfg} />}
                            {tab === 'messages' && <MessagesTab cfg={cfg} />}
                            {tab === 'theme' && <ThemeTab {...designProps} />}
                            {tab === 'elements' && <ElementsTab {...designProps} />}
                            {tab === 'typography' && <TypographyTab {...designProps} />}
                            {tab === 'animations' && <AnimationsTab {...designProps} />}
                            {tab === 'editor' && <EditorTab {...designProps} labels={labels} />}
                        </div>
                    </div>

                    <div className="xl:col-span-1 min-w-0">
                        <SongRequestPreview
                            kind={kind}
                            onKindChange={setKind}
                            layout={cfg.overlay[kind]}
                            labels={labels}
                            live={{ snapshot: live.snapshot, progress: live.progress }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
