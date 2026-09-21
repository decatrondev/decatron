import { useState, useRef } from 'react';
import { X, Upload, Link, Volume2 } from 'lucide-react';

interface SoundFile {
    id: number;
    rewardId: string;
    rewardTitle: string;
    fileType: string;
    fileName: string;
    showImage: boolean;
    imageUrl?: string;
    imageSource: 'upload' | 'url';
    imagePath?: string;
    volume?: number | null;
}

interface EditSoundModalProps {
    file: SoundFile;
    onClose: () => void;
    onSave: (rewardId: string, data: FormData) => Promise<void>;
    saving: boolean;
}

export default function EditSoundModal({ file, onClose, onSave, saving }: EditSoundModalProps) {
    const [showImage, setShowImage] = useState(file.showImage);
    const [imageSource, setImageSource] = useState<'upload' | 'url'>(file.imageSource || 'upload');
    const [imageUrlInput, setImageUrlInput] = useState(file.imageUrl || '');
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [volume, setVolume] = useState<number | null>(file.volume ?? null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const currentImagePreview = newImageFile
        ? URL.createObjectURL(newImageFile)
        : imageSource === 'url' && imageUrlInput
        ? imageUrlInput
        : file.imagePath
        ? file.imagePath
        : null;

    const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 10 * 1024 * 1024) { alert('La imagen no puede superar los 10MB'); return; }
        setNewImageFile(f);
    };

    const handleSave = async () => {
        const fd = new FormData();
        fd.append('showImage', String(showImage));
        fd.append('imageSource', imageSource);
        fd.append('imageUrl', imageSource === 'url' ? imageUrlInput : '');
        if (imageSource === 'upload' && newImageFile) fd.append('imageFile', newImageFile);
        if (volume !== null) fd.append('volume', String(volume));
        await onSave(file.rewardId, fd);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl w-full max-w-md border border-[#e2e8f0] dark:border-[#374151] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-lg">Editar sonido</h3>
                    <button onClick={onClose} className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-[#f8fafc] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Reward title */}
                    <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl px-4 py-2 text-sm text-[#1e293b] dark:text-[#f8fafc]">
                        🎵 {file.rewardTitle} — <span className="text-[#64748b] dark:text-[#94a3b8]">{file.fileName}</span>
                    </div>

                    {/* Show image toggle */}
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Mostrar imagen en overlay</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">Si está desactivado, no se mostrará ninguna imagen ni icono</p>
                        </div>
                        <button
                            onClick={() => setShowImage(!showImage)}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${showImage ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${showImage ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Image source (only if showImage) */}
                    {showImage && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Fuente de imagen</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setImageSource('upload')}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${imageSource === 'upload' ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-[#94a3b8]'}`}
                                >
                                    <Upload className="w-4 h-4" /> Subir archivo
                                </button>
                                <button
                                    onClick={() => setImageSource('url')}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${imageSource === 'url' ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-[#94a3b8]'}`}
                                >
                                    <Link className="w-4 h-4" /> URL externa
                                </button>
                            </div>

                            {imageSource === 'upload' && (
                                <div>
                                    <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,.gif" onChange={handleImageFile} className="hidden" />
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-xl p-4 text-center hover:border-[#2563eb] transition-colors group"
                                    >
                                        {newImageFile ? (
                                            <p className="text-sm text-green-600 dark:text-green-400">✓ {newImageFile.name}</p>
                                        ) : file.imagePath ? (
                                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Imagen actual: <span className="text-[#1e293b] dark:text-[#f8fafc]">{file.imagePath.split('/').pop()}</span> — click para cambiar</p>
                                        ) : (
                                            <p className="text-sm text-[#94a3b8] dark:text-[#64748b] group-hover:text-[#2563eb]">Click para subir PNG, JPG, JPEG o GIF (máx 10MB)</p>
                                        )}
                                    </button>
                                </div>
                            )}

                            {imageSource === 'url' && (
                                <input
                                    type="text"
                                    value={imageUrlInput}
                                    onChange={e => setImageUrlInput(e.target.value)}
                                    placeholder="https://ejemplo.com/imagen.gif"
                                    className="w-full bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl px-4 py-2.5 text-sm text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#2563eb]"
                                />
                            )}

                            {/* Preview */}
                            {currentImagePreview && (
                                <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-black/30 flex items-center justify-center h-32">
                                    <img src={currentImagePreview} alt="preview" className="max-h-full max-w-full object-contain" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Volume */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2"><Volume2 className="w-4 h-4" /> Volumen</p>
                            <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">{volume === null ? 'Global' : `${volume}%`}</span>
                        </div>
                        <input
                            type="range" min={0} max={100} value={volume ?? 70}
                            onChange={e => setVolume(Number(e.target.value))}
                            className="w-full accent-[#2563eb]"
                        />
                        {volume !== null && (
                            <button onClick={() => setVolume(null)} className="text-xs text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-[#f8fafc]">
                                Usar volumen global
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t border-[#e2e8f0] dark:border-[#374151]">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] text-sm font-medium hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                    >
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
