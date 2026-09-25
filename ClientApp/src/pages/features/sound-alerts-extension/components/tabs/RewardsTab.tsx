import { useState } from 'react';
import {
    Gift, Eye, EyeOff, Trash2, Music, Video, Image as ImageIcon, Pencil, Upload, ChevronLeft, ChevronRight, MonitorPlay
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChannelPointsReward, SoundFile } from '../../types';

interface RewardsTabProps {
    rewards: ChannelPointsReward[];
    files: SoundFile[];
    uploading: { [key: string]: boolean };
    getRewardFile: (rewardId: string) => SoundFile | undefined;
    selectedRewardForFile: ChannelPointsReward | null;
    setSelectedRewardForFile: (reward: ChannelPointsReward | null) => void;
    setShowFileDialog: (show: boolean) => void;
    handleFileUpload: (rewardId: string, rewardTitle: string, file: File, fileType: string, imageFile?: File, showImage?: boolean, imageSource?: 'upload' | 'url', imageUrl?: string) => Promise<void>;
    handleDeleteFile: (rewardId: string) => Promise<void>;
    handleToggleFile: (rewardId: string) => Promise<void>;
    setPendingAudioUpload: (upload: { rewardId: string; rewardTitle: string; audioFile: File } | null) => void;
    setSelectedImageFile: (file: File | null) => void;
    setShowAudioImageModal: (show: boolean) => void;
    onEditFile: (rewardId: string) => void;
    /** Muestra esa alerta en la vista previa. */
    onPreview: (file: SoundFile) => void;
}

function detectFileType(file: File): string {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['mp4', 'webm'].includes(ext)) return 'video';
    if (['png', 'jpg', 'jpeg'].includes(ext)) return 'image';
    return 'sound';
}

export function RewardsTab({
    rewards,
    uploading,
    getRewardFile,
    setSelectedRewardForFile,
    setShowFileDialog,
    handleFileUpload,
    handleDeleteFile,
    handleToggleFile,
    onEditFile,
    onPreview,
}: RewardsTabProps) {
    const { t } = useTranslation('features');
    const [dragOverRewardId, setDragOverRewardId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 9;

    const openPicker = (reward: ChannelPointsReward) => {
        setSelectedRewardForFile(reward);
        setShowFileDialog(true);
    };

    const totalPages = Math.max(1, Math.ceil(rewards.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
    const pagedRewards = rewards.slice(pageStart, pageStart + ITEMS_PER_PAGE);

    const handleDrop = (e: React.DragEvent, reward: ChannelPointsReward) => {
        e.preventDefault();
        setDragOverRewardId(null);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileUpload(reward.id, reward.title, file, detectFileType(file));
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-5 3xl:p-6 shadow-lg">
                <h3 className="text-base 3xl:text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-[#2563eb]" />
                    {t('soundAlertsTabs.manageAlertFiles')}
                </h3>
                <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] mb-4">
                    {t('soundAlertsTabs.manageAlertFilesDesc')}. También puedes arrastrar un archivo directo sobre una recompensa para asignarlo.
                </p>

                {rewards.length === 0 ? (
                    <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-8 text-center">
                        <Gift className="w-12 h-12 text-[#64748b] dark:text-[#94a3b8] mx-auto mb-3" />
                        <p className="text-[#64748b] dark:text-[#94a3b8] font-semibold">
                            {t('soundAlertsTabs.noRewards')}
                        </p>
                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm mt-1">
                            {t('soundAlertsTabs.createRewardsFirst')}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pagedRewards.map((reward) => {
                                const file = getRewardFile(reward.id);
                                const isUploading = uploading[reward.id] || false;
                                const isDragOver = dragOverRewardId === reward.id;

                                return (
                                    <div
                                        key={reward.id}
                                        className={`rounded-xl border-2 p-4 transition-all ${
                                            isDragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-[#e2e8f0] dark:border-[#374151]'
                                        } bg-[#f8fafc] dark:bg-[#262626]`}
                                        onDragOver={(e) => { e.preventDefault(); setDragOverRewardId(reward.id); }}
                                        onDragLeave={() => setDragOverRewardId(null)}
                                        onDrop={(e) => handleDrop(e, reward)}
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: reward.background_color }} />
                                            <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] truncate flex-1">
                                                {reward.title}
                                            </h4>
                                            <span className="text-xs text-[#64748b] dark:text-[#94a3b8] shrink-0">{reward.cost} pts</span>
                                        </div>

                                        {file ? (
                                            <>
                                                <div className="aspect-video bg-white dark:bg-[#1B1C1D] rounded-lg mb-2 flex items-center justify-center overflow-hidden border border-[#e2e8f0] dark:border-[#374151]">
                                                    {file.fileType === 'image' || file.fileType === 'gif' ? (
                                                        <img src={file.fileUrl} alt={file.fileName} className="w-full h-full object-cover" />
                                                    ) : file.fileType === 'video' ? (
                                                        <video
                                                            src={file.fileUrl}
                                                            muted
                                                            loop
                                                            playsInline
                                                            className="w-full h-full object-cover"
                                                            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                                                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                                        />
                                                    ) : (
                                                        <audio src={file.fileUrl} controls className="w-full px-2" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3 flex items-center gap-1">
                                                    {file.fileType === 'sound' && <Music className="w-3 h-3" />}
                                                    {file.fileType === 'video' && <Video className="w-3 h-3" />}
                                                    {(file.fileType === 'image' || file.fileType === 'gif') && <ImageIcon className="w-3 h-3" />}
                                                    <span className="truncate">{file.fileName} • {file.durationSeconds}s • {(file.fileSize / 1024 / 1024).toFixed(2)}MB</span>
                                                </p>
                                                <div className="grid grid-cols-4 gap-1">
                                                    <button
                                                        onClick={() => onPreview(file)}
                                                        className="p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors flex items-center justify-center"
                                                        title="Ver en la vista previa"
                                                    >
                                                        <MonitorPlay className="w-4 h-4 text-[#2563eb]" />
                                                    </button>
                                                    <button
                                                        onClick={() => onEditFile(file.rewardId)}
                                                        className="p-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg transition-colors flex items-center justify-center"
                                                        title="Editar imagen y opciones"
                                                    >
                                                        <Pencil className="w-4 h-4 text-purple-600" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleFile(file.rewardId)}
                                                        className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                                                            file.enabled ? 'bg-green-100 dark:bg-green-900/40 hover:bg-green-200' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'
                                                        }`}
                                                        title={file.enabled ? t('soundAlertsTabs.deactivate') : t('soundAlertsTabs.activate')}
                                                    >
                                                        {file.enabled ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteFile(file.rewardId)}
                                                        className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors flex items-center justify-center"
                                                        title={t('soundAlertsTabs.delete')}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => openPicker(reward)}
                                                disabled={isUploading}
                                                className="w-full aspect-video border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-lg flex flex-col items-center justify-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:border-[#2563eb] dark:hover:border-[#3b82f6] hover:text-[#2563eb] transition-all disabled:opacity-50"
                                            >
                                                <Upload className="w-6 h-6" />
                                                <span className="text-xs font-semibold">
                                                    {isUploading ? 'Subiendo...' : 'Sin archivo: arrástralo aquí o haz clic'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 mt-2">
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    {pageStart + 1}-{Math.min(pageStart + ITEMS_PER_PAGE, rewards.length)} de {rewards.length}
                                </p>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={safePage === 1}
                                        className="p-1.5 rounded-md border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-8 h-8 rounded-md text-xs font-bold transition-colors ${
                                                safePage === page
                                                    ? 'bg-[#2563eb] text-white'
                                                    : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safePage === totalPages}
                                        className="p-1.5 rounded-md border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Info */}
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                {t('soundAlertsTabs.acceptedFormats')}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
