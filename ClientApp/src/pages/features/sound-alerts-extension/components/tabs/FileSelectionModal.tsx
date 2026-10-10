import { useRef, useState } from 'react';
import {
    Upload, Music, Video, Image as ImageIcon, Link, FolderOpen, ChevronLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChannelPointsReward } from '../../types';
import MediaGallery from '../../../../../components/timer/MediaGallery';

interface FileSelectionModalProps {
    showFileDialog: boolean;
    selectedRewardForFile: ChannelPointsReward | null;
    setShowFileDialog: (show: boolean) => void;
    setSelectedRewardForFile: (reward: ChannelPointsReward | null) => void;
    systemFiles: any[];
    uploading: { [key: string]: boolean };
    handleAssignSystemFile: (systemFile: any) => Promise<void>;
    handleAssignMediaFile: (mediaFileId: number) => Promise<void>;
    // Audio Image Modal
    showAudioImageModal: boolean;
    pendingAudioUpload: { rewardId: string; rewardTitle: string; audioFile: File } | null;
    selectedImageFile: File | null;
    setShowAudioImageModal: (show: boolean) => void;
    setPendingAudioUpload: (upload: { rewardId: string; rewardTitle: string; audioFile: File } | null) => void;
    setSelectedImageFile: (file: File | null) => void;
    handleFileUpload: (rewardId: string, rewardTitle: string, file: File, fileType: string, imageFile?: File, showImage?: boolean, imageSource?: 'upload' | 'url', imageUrl?: string) => Promise<void>;
}

export function FileSelectionModal({
    showFileDialog,
    selectedRewardForFile,
    setShowFileDialog,
    setSelectedRewardForFile,
    systemFiles,
    uploading,
    handleAssignSystemFile,
    handleAssignMediaFile,
    showAudioImageModal,
    pendingAudioUpload,
    selectedImageFile,
    setShowAudioImageModal,
    setPendingAudioUpload,
    setSelectedImageFile,
    handleFileUpload,
}: FileSelectionModalProps) {
    const { t } = useTranslation('features');
    const [showImage, setShowImage] = useState(true);
    const [imageSource, setImageSource] = useState<'upload' | 'url'>('upload');
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [showGallery, setShowGallery] = useState(false);
    const uploadInputRef = useRef<HTMLInputElement>(null);

    const detectType = (file: File): string => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (['mp4', 'webm'].includes(ext)) return 'video';
        if (['png', 'jpg', 'jpeg'].includes(ext)) return 'image';
        return 'sound';
    };

    const closeDialog = () => {
        setShowFileDialog(false);
        setSelectedRewardForFile(null);
        setShowGallery(false);
    };

    return (
        <>
            {/* File Selection Dialog */}
            {showFileDialog && selectedRewardForFile && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-ds-text flex items-center gap-2">
                                {showGallery && (
                                    <button onClick={() => setShowGallery(false)} className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm">
                                        <ChevronLeft className="w-5 h-5 text-ds-soft" />
                                    </button>
                                )}
                                {t('soundAlertsTabs.selectFileFor', { title: selectedRewardForFile.title })}
                            </h3>
                            <button
                                onClick={closeDialog}
                                className="text-ds-soft hover:text-ds-soft"
                            >
                                ✕
                            </button>
                        </div>

                        {showGallery ? (
                            <MediaGallery
                                selectedCategory="sound-alerts"
                                onFileSelect={(file) => {
                                    handleAssignMediaFile(file.id);
                                    closeDialog();
                                }}
                            />
                        ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {/* Upload Custom File */}
                            <div
                                className="p-6 border-2 border-dashed border-ds-border rounded-lg hover:border-ds-accent cursor-pointer transition-all text-center"
                                onClick={() => uploadInputRef.current?.click()}
                            >
                                <input
                                    ref={uploadInputRef}
                                    type="file"
                                    accept=".mp3,.wav,.ogg,.mp4,.webm,.png,.jpg,.jpeg"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (!file || !selectedRewardForFile) return;

                                        const fileType = detectType(file);
                                        if (fileType === 'sound') {
                                            setPendingAudioUpload({
                                                rewardId: selectedRewardForFile.id,
                                                rewardTitle: selectedRewardForFile.title,
                                                audioFile: file
                                            });
                                            setSelectedImageFile(null);
                                            setShowAudioImageModal(true);
                                            closeDialog();
                                        } else {
                                            handleFileUpload(selectedRewardForFile.id, selectedRewardForFile.title, file, fileType);
                                            closeDialog();
                                        }
                                    }}
                                />
                                <Upload className="w-12 h-12 mx-auto mb-3 text-ds-accent-text" />
                                <h4 className="font-bold text-ds-text mb-2">
                                    {t('soundAlertsTabs.uploadOwnFile')}
                                </h4>
                                <p className="text-sm text-ds-soft">
                                    {t('soundAlertsTabs.uploadOwnFileDesc')}
                                </p>
                            </div>

                            {/* Choose from shared gallery */}
                            <div
                                className="p-6 border-2 border-dashed border-ds-border rounded-lg hover:border-ds-accent cursor-pointer transition-all text-center"
                                onClick={() => setShowGallery(true)}
                            >
                                <FolderOpen className="w-12 h-12 mx-auto mb-3 text-ds-accent-text" />
                                <h4 className="font-bold text-ds-text mb-2">
                                    Elegir de tu galería
                                </h4>
                                <p className="text-sm text-ds-soft">
                                    Reusa un archivo que ya subiste (para Sound Alerts, Timer, Event Alerts, Goals o Discord)
                                </p>
                            </div>

                            {/* Use System File */}
                            <div className="p-6 border-2 border-dashed border-ds-border rounded-lg">
                                <h4 className="font-bold text-ds-text mb-3 flex items-center gap-2">
                                    <Music className="w-5 h-5 text-ds-accent-text" />
                                    {t('soundAlertsTabs.systemFiles')}
                                </h4>
                                {systemFiles.length === 0 ? (
                                    <p className="text-sm text-ds-soft">
                                        {t('soundAlertsTabs.noSystemFiles')}
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {systemFiles.map((file, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleAssignSystemFile(file)}
                                                disabled={uploading[selectedRewardForFile.id]}
                                                className="w-full text-left p-3 bg-ds-bg hover:bg-ds-accent/10 rounded-lg transition-all disabled:opacity-50"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {file.type === 'sound' && <Music className="w-4 h-4 text-ds-accent-text" />}
                                                        {file.type === 'video' && <Video className="w-4 h-4 text-ds-accent-text" />}
                                                        {file.type === 'image' && <ImageIcon className="w-4 h-4 text-ds-accent-text" />}
                                                        <span className="text-sm font-semibold text-ds-text">
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-ds-soft">
                                                        {(file.size / 1024 / 1024).toFixed(2)}MB
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={closeDialog}
                                className="ds-btn ds-btn--secondary"
                            >
                                {t('soundAlertsTabs.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Upload Audio + Optional Image */}
            {showAudioImageModal && pendingAudioUpload && (
                <div className="fixed inset-0 bg-ds-input/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-ds-border">
                            <h3 className="text-xl font-bold text-ds-text">
                                {t('soundAlertsTabs.uploadAudio')}
                            </h3>
                            <p className="text-sm text-ds-soft mt-1">
                                {t('soundAlertsTabs.addImageQuestion')}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Audio file info */}
                            <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <Music className="w-5 h-5 text-ds-accent-text" />
                                    <div>
                                        <p className="text-sm font-semibold text-ds-text">
                                            {pendingAudioUpload.audioFile.name}
                                        </p>
                                        <p className="text-xs text-ds-soft">
                                            {(pendingAudioUpload.audioFile.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Show image toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-ds-soft">Mostrar imagen en overlay</p>
                                    <p className="text-xs text-ds-soft mt-0.5">Si está desactivado, solo se escuchará el sonido</p>
                                </div>
                                <button
                                    onClick={() => setShowImage(!showImage)}
                                    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${showImage ? 'bg-ds-accent' : 'bg-ds-raised '}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-ds-surface rounded-full transition-transform ${showImage ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Image options (only when showImage) */}
                            {showImage && (
                                <div className="space-y-3">
                                    {/* Image source selector */}
                                    <div>
                                        <label className="block text-sm font-semibold text-ds-soft mb-2">
                                            Fuente de imagen
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setImageSource('upload')}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${imageSource === 'upload' ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text' : 'border-ds-border text-ds-soft'}`}
                                            >
                                                <Upload className="w-4 h-4" /> Subir archivo
                                            </button>
                                            <button
                                                onClick={() => setImageSource('url')}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${imageSource === 'url' ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text' : 'border-ds-border text-ds-soft'}`}
                                            >
                                                <Link className="w-4 h-4" /> URL externa
                                            </button>
                                        </div>
                                    </div>

                                    {/* Upload file */}
                                    {imageSource === 'upload' && (
                                        <div>
                                            <label className="block text-sm font-semibold text-ds-soft mb-2">
                                                {t('soundAlertsTabs.imageOptional')}
                                            </label>
                                            <div className="border-2 border-dashed border-ds-border rounded-lg p-4 hover:border-ds-accent transition-colors">
                                                <input
                                                    type="file"
                                                    accept=".png,.jpg,.jpeg,.gif"
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
                                                            <ImageIcon className="w-8 h-8 text-ds-accent-text" />
                                                            <p className="text-sm font-medium text-ds-text">
                                                                {selectedImageFile.name}
                                                            </p>
                                                            <p className="text-xs text-ds-soft">
                                                                {(selectedImageFile.size / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-8 h-8 text-ds-soft" />
                                                            <p className="text-sm text-ds-soft">
                                                                {t('soundAlertsTabs.clickToSelectImage')}
                                                            </p>
                                                            <p className="text-xs text-ds-soft">PNG, JPG, JPEG, GIF — máx 10MB</p>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* URL input */}
                                    {imageSource === 'url' && (
                                        <div>
                                            <label className="block text-sm font-semibold text-ds-soft mb-2">
                                                URL de imagen / GIF
                                            </label>
                                            <input
                                                type="text"
                                                value={imageUrlInput}
                                                onChange={e => setImageUrlInput(e.target.value)}
                                                placeholder="https://ejemplo.com/imagen.gif"
                                                className="ds-input w-full"
                                            />
                                        </div>
                                    )}

                                    {/* Preview */}
                                    {(imageSource === 'upload' && selectedImageFile) || (imageSource === 'url' && imageUrlInput) ? (
                                        <div className="rounded-lg overflow-hidden border border-ds-border bg-ds-input/20 flex items-center justify-center h-24">
                                            <img
                                                src={imageSource === 'upload' && selectedImageFile ? URL.createObjectURL(selectedImageFile) : imageUrlInput}
                                                alt="preview"
                                                className="max-h-full max-w-full object-contain"
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-ds-border flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAudioImageModal(false);
                                    setPendingAudioUpload(null);
                                    setSelectedImageFile(null);
                                    setShowImage(true);
                                    setImageSource('upload');
                                    setImageUrlInput('');
                                }}
                                className="ds-btn ds-btn--secondary"
                            >
                                {t('soundAlertsTabs.cancel')}
                            </button>
                            <button
                                onClick={async () => {
                                    if (pendingAudioUpload) {
                                        await handleFileUpload(
                                            pendingAudioUpload.rewardId,
                                            pendingAudioUpload.rewardTitle,
                                            pendingAudioUpload.audioFile,
                                            'sound',
                                            imageSource === 'upload' ? (selectedImageFile || undefined) : undefined,
                                            showImage,
                                            imageSource,
                                            imageSource === 'url' ? imageUrlInput : undefined
                                        );
                                        setShowAudioImageModal(false);
                                        setPendingAudioUpload(null);
                                        setSelectedImageFile(null);
                                        setShowImage(true);
                                        setImageSource('upload');
                                        setImageUrlInput('');
                                    }
                                }}
                                className="ds-btn ds-btn--primary"
                            >
                                <Upload className="w-4 h-4" />
                                {t('soundAlertsTabs.uploadAudio')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
