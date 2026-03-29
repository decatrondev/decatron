import {
    Gift, Eye, EyeOff, Trash2, Music, Video, Image as ImageIcon
} from 'lucide-react';
import type { ChannelPointsReward, SoundFile } from '../../types';

interface RewardsTabProps {
    rewards: ChannelPointsReward[];
    files: SoundFile[];
    uploading: { [key: string]: boolean };
    getRewardFile: (rewardId: string) => SoundFile | undefined;
    setSelectedRewardForFile: (reward: ChannelPointsReward | null) => void;
    setShowFileDialog: (show: boolean) => void;
    handleFileUpload: (rewardId: string, rewardTitle: string, file: File, fileType: string, imageFile?: File) => Promise<void>;
    handleDeleteFile: (rewardId: string) => Promise<void>;
    handleToggleFile: (rewardId: string) => Promise<void>;
    setPendingAudioUpload: (upload: { rewardId: string; rewardTitle: string; audioFile: File } | null) => void;
    setSelectedImageFile: (file: File | null) => void;
    setShowAudioImageModal: (show: boolean) => void;
}

export function RewardsTab({
    rewards,
    files,
    uploading,
    getRewardFile,
    setSelectedRewardForFile,
    setShowFileDialog,
    handleFileUpload,
    handleDeleteFile,
    handleToggleFile,
    setPendingAudioUpload,
    setSelectedImageFile,
    setShowAudioImageModal,
}: RewardsTabProps) {
    return (
        <div className="space-y-6">
            {/* Selector de Recompensas */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-[#2563eb]" />
                    Administrar Archivos de Alertas
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Selecciona una recompensa de puntos de canal para asignarle un archivo de sonido, video o imagen
                </p>

                {rewards.length === 0 ? (
                    <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-8 text-center">
                        <Gift className="w-12 h-12 text-[#64748b] dark:text-[#94a3b8] mx-auto mb-3" />
                        <p className="text-[#64748b] dark:text-[#94a3b8] font-semibold">
                            No hay recompensas de puntos de canal
                        </p>
                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm mt-1">
                            Crea recompensas en tu panel de Twitch primero
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Selector */}
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            Seleccionar Recompensa
                        </label>
                        <select
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] font-semibold mb-6"
                            value={rewards.find(r => getRewardFile(r.id))?.id || ''}
                            onChange={(e) => {
                                const selectedReward = rewards.find(r => r.id === e.target.value);
                                if (selectedReward) {
                                    setSelectedRewardForFile(selectedReward);
                                    setShowFileDialog(true);
                                }
                            }}
                        >
                            <option value="">-- Selecciona una recompensa --</option>
                            {rewards.map((reward) => (
                                <option key={reward.id} value={reward.id}>
                                    {reward.title} ({reward.cost} puntos) {getRewardFile(reward.id) ? '✓' : ''}
                                </option>
                            ))}
                        </select>

                        {/* Hidden file inputs for each reward */}
                        {rewards.map((reward) => {
                            const isUploading = uploading[reward.id] || false;
                            return (
                                <input
                                    key={reward.id}
                                    id={`file-upload-${reward.id}`}
                                    type="file"
                                    accept=".mp3,.wav,.ogg,.mp4,.webm,.png,.jpg,.jpeg"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const ext = file.name.split('.').pop()?.toLowerCase();
                                            let fileType = 'sound';
                                            if (['mp4', 'webm'].includes(ext || '')) fileType = 'video';
                                            else if (['png', 'jpg', 'jpeg'].includes(ext || '')) fileType = 'image';

                                            // Si es audio, abrir modal para opcionalmente agregar imagen
                                            if (fileType === 'sound') {
                                                setPendingAudioUpload({
                                                    rewardId: reward.id,
                                                    rewardTitle: reward.title,
                                                    audioFile: file
                                                });
                                                setSelectedImageFile(null);
                                                setShowAudioImageModal(true);
                                            } else {
                                                // Para video e imagen, subir directamente
                                                handleFileUpload(reward.id, reward.title, file, fileType);
                                            }
                                        }
                                        // Resetear input para permitir seleccionar el mismo archivo de nuevo
                                        e.target.value = '';
                                    }}
                                    className="hidden"
                                    disabled={isUploading}
                                />
                            );
                        })}

                        {/* Archivos Asignados */}
                        {files.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3">
                                    Archivos Asignados ({files.length})
                                </h4>
                                <div className="space-y-3">
                                    {files.map((file) => {
                                        const reward = rewards.find(r => r.id === file.rewardId);
                                        if (!reward) return null;

                                        return (
                                            <div
                                                key={file.id}
                                                className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg hover:border-[#2563eb] dark:hover:border-[#3b82f6] transition-all"
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div
                                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: reward.background_color }}
                                                    />
                                                    {file.fileType === 'sound' && <Music className="w-5 h-5 text-blue-600" />}
                                                    {file.fileType === 'video' && <Video className="w-5 h-5 text-purple-600" />}
                                                    {file.fileType === 'image' && <ImageIcon className="w-5 h-5 text-green-600" />}
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                                            {reward.title}
                                                        </p>
                                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                            {file.fileName} • {file.durationSeconds}s • {(file.fileSize / 1024 / 1024).toFixed(2)}MB
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleToggleFile(file.rewardId)}
                                                        className={`p-2 rounded-lg transition-colors ${
                                                            file.enabled
                                                                ? 'bg-green-100 dark:bg-green-900/40 hover:bg-green-200'
                                                                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'
                                                        }`}
                                                        title={file.enabled ? 'Desactivar' : 'Activar'}
                                                    >
                                                        {file.enabled ? (
                                                            <Eye className="w-4 h-4 text-green-600" />
                                                        ) : (
                                                            <EyeOff className="w-4 h-4 text-gray-400" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteFile(file.rewardId)}
                                                        className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Info */}
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                💡 <strong>Formatos aceptados:</strong> MP3/WAV/OGG (10MB), MP4/WEBM (50MB), PNG/JPG (5MB)
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
