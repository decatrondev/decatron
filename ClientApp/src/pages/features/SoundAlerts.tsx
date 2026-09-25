import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../services/api';
import type { ChannelPointsReward, SoundFile, TabId } from './sound-alerts-extension/types';
import { useSoundAlertsConfig } from './sound-alerts-extension/hooks/useSoundAlertsConfig';
import { RewardsTab, MediaTab, FileSelectionModal } from './sound-alerts-extension/components/tabs';
import EditSoundModal from './sound-alerts-extension/components/tabs/EditSoundModal';
import { GuideTab, BasicTab, TextsTab, BackgroundTab, AnimationTab } from './sound-alerts-extension/components/ConfigTabs';
import EditorTab from './sound-alerts-extension/components/EditorTab';
import SoundAlertPreview, { contentForFile } from './sound-alerts-extension/components/SoundAlertPreview';

// Sound Alerts (.dev/plans/SOUND_ALERTS_REDESIGN_PLAN.md, fase 2): mismo patrón que /overlays/timer y
// /overlays/song-request — pestañas a la izquierda (2/3), vista previa en vivo a la derecha (1/3).

const TABS: { id: TabId; icon: string }[] = [
    { id: 'guide', icon: '📚' },
    { id: 'rewards', icon: '🎁' },
    { id: 'library', icon: '📁' },
    { id: 'basic', icon: '⚙️' },
    { id: 'texts', icon: '🔤' },
    { id: 'background', icon: '🎨' },
    { id: 'animation', icon: '✨' },
    { id: 'editor', icon: '🖥️' },
];

export default function SoundAlerts() {
    const navigate = useNavigate();
    const { t } = useTranslation('overlays');
    const { t: tf } = useTranslation('features');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const cfg = useSoundAlertsConfig();
    const [tab, setTab] = useState<TabId>(() => (sessionStorage.getItem('sa-tab') as TabId) || 'guide');
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [testing, setTesting] = useState(false);
    const [previewFileId, setPreviewFileId] = useState<number | null>(null);

    // Archivos por recompensa (modales de antes)
    const [uploading, setUploading] = useState<Record<string, boolean>>({});
    const [showFileDialog, setShowFileDialog] = useState(false);
    const [selectedRewardForFile, setSelectedRewardForFile] = useState<ChannelPointsReward | null>(null);
    const [showAudioImageModal, setShowAudioImageModal] = useState(false);
    const [pendingAudioUpload, setPendingAudioUpload] = useState<{ rewardId: string; rewardTitle: string; audioFile: File } | null>(null);
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [editingFile, setEditingFile] = useState<SoundFile | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => { try { sessionStorage.setItem('sa-tab', tab); } catch { /* sin storage */ } }, [tab]);

    useEffect(() => {
        if (!permissionsLoading && !hasMinimumLevel('moderation')) navigate('/dashboard');
    }, [permissionsLoading, hasMinimumLevel, navigate]);

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

    const notify = (ok: boolean, text: string) => setMessage({ ok, text });

    const previewFile = cfg.files.find(f => f.id === previewFileId);
    const content = useMemo(
        () => contentForFile(previewFile, t('soundAlerts.preview.sampleUser'), t('soundAlerts.preview.sampleReward')),
        [previewFile, t],
    );

    const save = async () => {
        const err = await cfg.save();
        notify(!err, err === null ? t('soundAlerts.saved') : err === 'save_failed' ? t('soundAlerts.saveFailed') : err);
    };

    const test = async () => {
        setTesting(true);
        try {
            const res = await api.post('/soundalerts/test', null, { params: previewFile ? { rewardId: previewFile.rewardId } : undefined });
            if (res.data.success) notify(true, tf('soundAlerts.testSuccess'));
        } catch (e: any) {
            notify(false, e?.response?.data?.message || tf('soundAlerts.testError'));
        } finally {
            setTesting(false);
        }
    };

    // ── Archivos por recompensa ────────────────────────────────────────────────

    const busy = (rewardId: string, value: boolean) => setUploading(prev => ({ ...prev, [rewardId]: value }));

    const handleFileUpload = async (rewardId: string, rewardTitle: string, file: File, fileType: string, imageFile?: File, showImage: boolean = true, imageSource: 'upload' | 'url' = 'upload', imageUrl?: string) => {
        busy(rewardId, true);
        try {
            let duration = 0;
            if (fileType === 'sound' || fileType === 'video') {
                const el = document.createElement(fileType === 'sound' ? 'audio' : 'video');
                const src = URL.createObjectURL(file);
                await new Promise<void>(resolve => {
                    el.onloadedmetadata = () => { duration = isFinite(el.duration) ? Math.floor(el.duration) : 0; URL.revokeObjectURL(src); resolve(); };
                    el.onerror = () => { URL.revokeObjectURL(src); resolve(); };
                    el.src = src;
                });
            }
            const fd = new FormData();
            fd.append('File', file);
            fd.append('RewardId', rewardId);
            fd.append('RewardTitle', rewardTitle);
            fd.append('FileType', fileType);
            fd.append('DurationSeconds', duration.toString());
            fd.append('ShowImage', String(showImage));
            fd.append('ImageSource', imageSource);
            if (imageUrl) fd.append('ImageUrl', imageUrl);
            if (imageFile) fd.append('ImageFile', imageFile);
            await api.post('/soundalerts/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            notify(true, tf('soundAlerts.fileUploaded', { name: file.name }));
            await cfg.loadFiles();
        } catch (e: any) {
            notify(false, e?.response?.data?.message || tf('soundAlerts.fileUploadError'));
        } finally {
            busy(rewardId, false);
        }
    };

    const assign = async (url: string, body: Record<string, unknown>, okText: string) => {
        const reward = selectedRewardForFile;
        if (!reward) return;
        busy(reward.id, true);
        try {
            await api.post(url, { rewardId: reward.id, rewardTitle: reward.title, ...body });
            notify(true, okText);
            await cfg.loadFiles();
            setShowFileDialog(false);
            setSelectedRewardForFile(null);
        } catch (e: any) {
            notify(false, e?.response?.data?.message || tf('soundAlerts.systemFileError'));
        } finally {
            busy(reward.id, false);
        }
    };

    const handleDeleteFile = async (rewardId: string) => {
        if (!window.confirm(tf('soundAlerts.deleteConfirm'))) return;
        try {
            await api.delete(`/soundalerts/file/${rewardId}`);
            notify(true, tf('soundAlerts.fileDeleted'));
            await cfg.loadFiles();
        } catch (e: any) {
            notify(false, e?.response?.data?.message || tf('soundAlerts.fileDeleteError'));
        }
    };

    const handleToggleFile = async (rewardId: string) => {
        try {
            await api.patch(`/soundalerts/file/${rewardId}/toggle`);
            await cfg.loadFiles();
        } catch { /* queda como estaba */ }
    };

    const handleEditFile = async (rewardId: string, data: FormData) => {
        setSavingEdit(true);
        try {
            await api.patch(`/soundalerts/file/${rewardId}/edit`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            notify(true, t('soundAlerts.fileEdited'));
            await cfg.loadFiles();
            setEditingFile(null);
        } catch (e: any) {
            notify(false, e?.response?.data?.error || e?.response?.data?.message || t('soundAlerts.fileEditFailed'));
        } finally {
            setSavingEdit(false);
        }
    };

    if (permissionsLoading || cfg.loading) {
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
                    {cfg.error === 'forbidden' ? t('soundAlerts.forbidden') : t('soundAlerts.loadFailed')}
                </div>
            </div>
        );
    }

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
                            <h1 className="text-3xl 3xl:text-4xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('soundAlerts.title')}</h1>
                            <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] mt-1">{t('soundAlerts.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {cfg.dirty && <span className="text-xs 3xl:text-sm font-bold text-amber-600 dark:text-amber-400">{t('soundAlerts.unsaved')}</span>}
                        <button
                            onClick={save}
                            disabled={cfg.saving || !cfg.dirty}
                            className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg ${cfg.saving || !cfg.dirty
                                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                                : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white'}`}
                        >
                            <Save className="w-5 h-5" />
                            {cfg.saving ? t('soundAlerts.saving') : t('soundAlerts.save')}
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
                                        {item.icon} {t(`soundAlerts.tabs.${item.id}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            {tab === 'guide' && <GuideTab cfg={cfg} onNavigate={setTab} />}
                            {tab === 'rewards' && (
                                <RewardsTab
                                    rewards={cfg.rewards}
                                    files={cfg.files}
                                    uploading={uploading}
                                    getRewardFile={id => cfg.files.find(f => f.rewardId === id)}
                                    selectedRewardForFile={selectedRewardForFile}
                                    setSelectedRewardForFile={setSelectedRewardForFile}
                                    setShowFileDialog={setShowFileDialog}
                                    handleFileUpload={handleFileUpload}
                                    handleDeleteFile={handleDeleteFile}
                                    handleToggleFile={handleToggleFile}
                                    setPendingAudioUpload={setPendingAudioUpload}
                                    setSelectedImageFile={setSelectedImageFile}
                                    setShowAudioImageModal={setShowAudioImageModal}
                                    onEditFile={rewardId => { const f = cfg.files.find(x => x.rewardId === rewardId); if (f) setEditingFile(f); }}
                                    onPreview={file => setPreviewFileId(file.id)}
                                />
                            )}
                            {tab === 'library' && <MediaTab />}
                            {tab === 'basic' && <BasicTab cfg={cfg} />}
                            {tab === 'texts' && <TextsTab cfg={cfg} />}
                            {tab === 'background' && <BackgroundTab cfg={cfg} onNavigate={setTab} />}
                            {tab === 'animation' && <AnimationTab cfg={cfg} />}
                            {tab === 'editor' && <EditorTab cfg={cfg} content={content} />}
                        </div>
                    </div>

                    <div className="xl:col-span-1 min-w-0">
                        <SoundAlertPreview
                            design={cfg.settings.design}
                            files={cfg.files}
                            selectedFileId={previewFile ? previewFile.id : null}
                            onSelectFile={setPreviewFileId}
                            content={content}
                            dirty={cfg.dirty}
                            testing={testing}
                            onTest={test}
                        />
                    </div>
                </div>
            </div>

            <FileSelectionModal
                showFileDialog={showFileDialog}
                selectedRewardForFile={selectedRewardForFile}
                setShowFileDialog={setShowFileDialog}
                setSelectedRewardForFile={setSelectedRewardForFile}
                systemFiles={cfg.systemFiles}
                uploading={uploading}
                handleAssignSystemFile={sf => assign('/soundalerts/assign-system-file',
                    { systemFilePath: sf.path, systemFileName: sf.name, fileType: sf.type },
                    tf('soundAlerts.systemFileAssigned', { name: sf.name }))}
                handleAssignMediaFile={mediaFileId => assign('/soundalerts/assign-media-file',
                    { mediaFileId },
                    tf('soundAlerts.fileUploaded', { name: selectedRewardForFile?.title ?? '' }))}
                showAudioImageModal={showAudioImageModal}
                pendingAudioUpload={pendingAudioUpload}
                selectedImageFile={selectedImageFile}
                setShowAudioImageModal={setShowAudioImageModal}
                setPendingAudioUpload={setPendingAudioUpload}
                setSelectedImageFile={setSelectedImageFile}
                handleFileUpload={handleFileUpload}
            />

            {editingFile && (
                <EditSoundModal file={editingFile} onClose={() => setEditingFile(null)} onSave={handleEditFile} saving={savingEdit} />
            )}
        </div>
    );
}
