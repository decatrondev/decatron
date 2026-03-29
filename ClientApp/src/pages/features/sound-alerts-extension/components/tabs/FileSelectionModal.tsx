import {
    Upload, Music, Video, Image as ImageIcon
} from 'lucide-react';
import type { ChannelPointsReward } from '../../types';

interface FileSelectionModalProps {
    showFileDialog: boolean;
    selectedRewardForFile: ChannelPointsReward | null;
    setShowFileDialog: (show: boolean) => void;
    setSelectedRewardForFile: (reward: ChannelPointsReward | null) => void;
    systemFiles: any[];
    uploading: { [key: string]: boolean };
    handleAssignSystemFile: (systemFile: any) => Promise<void>;
    // Audio Image Modal
    showAudioImageModal: boolean;
    pendingAudioUpload: { rewardId: string; rewardTitle: string; audioFile: File } | null;
    selectedImageFile: File | null;
    setShowAudioImageModal: (show: boolean) => void;
    setPendingAudioUpload: (upload: { rewardId: string; rewardTitle: string; audioFile: File } | null) => void;
    setSelectedImageFile: (file: File | null) => void;
    handleFileUpload: (rewardId: string, rewardTitle: string, file: File, fileType: string, imageFile?: File) => Promise<void>;
}

export function FileSelectionModal({
    showFileDialog,
    selectedRewardForFile,
    setShowFileDialog,
    setSelectedRewardForFile,
    systemFiles,
    uploading,
    handleAssignSystemFile,
    showAudioImageModal,
    pendingAudioUpload,
    selectedImageFile,
    setShowAudioImageModal,
    setPendingAudioUpload,
    setSelectedImageFile,
    handleFileUpload,
}: FileSelectionModalProps) {
    return (
        <>
            {/* File Selection Dialog */}
            {showFileDialog && selectedRewardForFile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                Seleccionar Archivo para "{selectedRewardForFile.title}"
                            </h3>
                            <button
                                onClick={() => {
                                    setShowFileDialog(false);
                                    setSelectedRewardForFile(null);
                                }}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* Upload Custom File */}
                            <div
                                className="p-6 border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-xl hover:border-[#2563eb] dark:hover:border-[#3b82f6] cursor-pointer transition-all text-center"
                                onClick={() => {
                                    const inputEl = document.getElementById(`file-upload-${selectedRewardForFile.id}`) as HTMLInputElement;
                                    inputEl?.click();
                                    setShowFileDialog(false);
                                }}
                            >
                                <Upload className="w-12 h-12 mx-auto mb-3 text-[#2563eb]" />
                                <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    Subir Archivo Propio
                                </h4>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    Sube tu propio archivo de sonido, video o imagen
                                </p>
                            </div>

                            {/* Use System File */}
                            <div className="p-6 border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-xl">
                                <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                                    <Music className="w-5 h-5 text-purple-600" />
                                    Archivos del Sistema
                                </h4>
                                {systemFiles.length === 0 ? (
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        No hay archivos del sistema disponibles
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {systemFiles.map((file, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleAssignSystemFile(file)}
                                                disabled={uploading[selectedRewardForFile.id]}
                                                className="w-full text-left p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all disabled:opacity-50"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {file.type === 'sound' && <Music className="w-4 h-4 text-blue-600" />}
                                                        {file.type === 'video' && <Video className="w-4 h-4 text-purple-600" />}
                                                        {file.type === 'image' && <ImageIcon className="w-4 h-4 text-green-600" />}
                                                        <span className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                        {(file.size / 1024 / 1024).toFixed(2)}MB
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowFileDialog(false);
                                    setSelectedRewardForFile(null);
                                }}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Subir Audio + Imagen Opcional */}
            {showAudioImageModal && pendingAudioUpload && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                📢 Subir Audio
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                ¿Quieres agregar una imagen para mostrar durante el audio?
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Info del archivo de audio */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <Music className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {pendingAudioUpload.audioFile.name}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {(pendingAudioUpload.audioFile.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Selector de imagen opcional */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Imagen (opcional)
                                </label>
                                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                                    <input
                                        type="file"
                                        accept=".png,.jpg,.jpeg"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            setSelectedImageFile(file || null);
                                        }}
                                        className="hidden"
                                        id="audio-image-upload"
                                    />
                                    <label
                                        htmlFor="audio-image-upload"
                                        className="cursor-pointer flex flex-col items-center gap-2"
                                    >
                                        {selectedImageFile ? (
                                            <>
                                                <ImageIcon className="w-8 h-8 text-green-600" />
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {selectedImageFile.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {(selectedImageFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-8 h-8 text-gray-400" />
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    Click para seleccionar imagen
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    PNG, JPG (máx. 5MB)
                                                </p>
                                            </>
                                        )}
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    💡 Si no seleccionas una imagen, se mostrará un ícono por defecto
                                </p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAudioImageModal(false);
                                    setPendingAudioUpload(null);
                                    setSelectedImageFile(null);
                                }}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (pendingAudioUpload) {
                                        await handleFileUpload(
                                            pendingAudioUpload.rewardId,
                                            pendingAudioUpload.rewardTitle,
                                            pendingAudioUpload.audioFile,
                                            'sound',
                                            selectedImageFile || undefined
                                        );
                                        setShowAudioImageModal(false);
                                        setPendingAudioUpload(null);
                                        setSelectedImageFile(null);
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Subir Audio
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
